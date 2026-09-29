import { chromium } from 'playwright';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = 'https://d2z1pcfp95dfwd.cloudfront.net';
const apiUrl = 'https://wvsrmqrfc0.execute-api.eu-north-1.amazonaws.com';
const sizes = [[375, 667], [768, 1024], [1440, 900], [1920, 1080]];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidenceDir = path.join(root, 'artifacts', 'ui-parity');

const input = await new Promise((resolve, reject) => {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    try { resolve(JSON.parse(raw)); }
    catch (error) { reject(new Error(`Credential input was not valid JSON: ${error.message}`)); }
  });
});

if (!input.email || !input.password) throw new Error('Email and password are required.');
if (!input.chromePath) throw new Error('Chrome path is required.');
await mkdir(evidenceDir, { recursive: true });

const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'bloodlink-auth-verification-'));
const errors = [];
const failedAssets = [];
const steps = [];
const workerEvents = [];
const apiObservations = {
  facilityList: null,
};
let context;

function sanitizeUrl(value) {
  const url = new URL(value);
  url.search = '';
  url.hash = '';
  return url.pathname;
}

async function attachGuards(page) {
  page.on('pageerror', error => errors.push(`page-exception:${error.name}`));
  page.on('console', message => {
    const text = message.text();
    if (message.type() === 'error' && /content security policy|csp|mixed content|cors/i.test(text))
      errors.push(`policy-console:${text.slice(0, 120)}`);
    else if (message.type() === 'error' && !/401|403/.test(text))
      errors.push(`console-error:${text.slice(0, 120)}`);
  });
  page.on('requestfailed', request => {
    const failure = request.failure()?.errorText ?? '';
    if (!failure.includes('ERR_ABORTED')) failedAssets.push(`request-failed:${sanitizeUrl(request.url())}:${failure}`);
  });
  page.on('response', response => {
    const url = new URL(response.url());
    if (response.status() >= 400 && url.origin !== apiUrl)
      failedAssets.push(`asset-${response.status()}:${sanitizeUrl(response.url())}`);
    if (url.origin === apiUrl && url.pathname === '/api/v1/system/facilities') {
      apiObservations.facilityList = {
        status: response.status(),
        itemCount: null,
        parseError: null,
      };
      void response.json().then(body => {
        apiObservations.facilityList.itemCount = Array.isArray(body?.items) ? body.items.length : null;
      }).catch(() => {
        apiObservations.facilityList.parseError = 'json-parse-failed';
      });
    }
  });
}

function sanitizedErrors() {
  return {
    consoleOrPageErrors: errors.slice(0, 8),
    failedAssets: failedAssets.slice(0, 8),
  };
}

async function facilityGovernanceState(page) {
  return await page.evaluate(() => {
    const detailLinks = [...document.querySelectorAll('a[href^="/system/facilities/"]')];
    const detailButtons = [...document.querySelectorAll('a[aria-label^="View "]')].filter(link => {
      try { return new URL(link.href).pathname.startsWith('/system/facilities/'); }
      catch { return false; }
    });
    return {
      route: location.pathname,
      heading: document.querySelector('h1')?.textContent?.trim() ?? '',
      loadingCompleted: !document.querySelector('.bl-loading-state'),
      emptyStatePresent: Boolean([...document.querySelectorAll('.bl-dash-empty-state,.bl-empty-state')].find(item => /no facilities/i.test(item.textContent ?? ''))),
      errorStatePresent: Boolean(document.querySelector('.bl-alert-danger')),
      errorText: document.querySelector('.bl-alert-danger')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160) ?? null,
      detailLinkCount: detailLinks.length,
      detailActionCount: detailButtons.length,
      tableRows: document.querySelectorAll('.bl-table tbody tr').length,
      statusText: document.querySelector('[role="status"]')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160) ?? null,
    };
  });
}

function sanitizedFacilityDiagnostics(state) {
  return {
    route: state.route,
    apiStatus: apiObservations.facilityList?.status ?? null,
    apiFacilityCount: apiObservations.facilityList?.itemCount ?? null,
    apiParseError: apiObservations.facilityList?.parseError ?? null,
    loadingCompleted: state.loadingCompleted,
    emptyStatePresent: state.emptyStatePresent,
    errorStatePresent: state.errorStatePresent,
    detailLinkCount: state.detailLinkCount,
    detailActionCount: state.detailActionCount,
    tableRows: state.tableRows,
    heading: state.heading,
    statusText: state.statusText,
    uiError: state.errorText,
    ...sanitizedErrors(),
  };
}

async function waitForFacilityGovernanceState(page) {
  await page.goto(`${baseUrl}/system/facilities`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Facility governance', exact: true }).waitFor({ state: 'visible' });
  for (let attempt = 0; attempt < 120; attempt++) {
    const state = await facilityGovernanceState(page);
    if (state.loadingCompleted && (state.detailLinkCount > 0 || state.emptyStatePresent || state.errorStatePresent))
      return state;
    await page.waitForTimeout(250);
  }
  const state = await facilityGovernanceState(page);
  throw new Error(`Facility governance did not reach a terminal state: ${JSON.stringify(sanitizedFacilityDiagnostics(state))}`);
}

async function waitForFacilityApiObservation() {
  for (let attempt = 0; attempt < 80; attempt++) {
    const api = apiObservations.facilityList;
    if (api && (api.status >= 400 || api.itemCount !== null || api.parseError)) return api;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return apiObservations.facilityList;
}

async function verifyFacilityGovernance(page) {
  let state = await waitForFacilityGovernanceState(page);
  const diagnostics = () => sanitizedFacilityDiagnostics(state);
  const api = await waitForFacilityApiObservation();
  if (!api) throw new Error(`Facility list API was not observed: ${JSON.stringify(diagnostics())}`);
  if (api.parseError) throw new Error(`Facility list API response could not be counted: ${JSON.stringify(diagnostics())}`);
  if (api.status >= 400 || state.errorStatePresent) throw new Error(`Facility list failed: ${JSON.stringify(diagnostics())}`);
  if (api.itemCount === 0) {
    if (!state.emptyStatePresent) throw new Error(`Facility API returned zero but empty state was not rendered: ${JSON.stringify(diagnostics())}`);
    steps.push('facility-governance-detail-not-applicable-no-production-facilities');
    return { state: 'empty', apiStatus: api.status, apiFacilityCount: 0 };
  }
  if ((api.itemCount ?? 0) > 0 && state.detailLinkCount === 0)
    throw new Error(`Facility API returned records but no detail links rendered: ${JSON.stringify(diagnostics())}`);
  if (state.detailActionCount === 0)
    throw new Error(`Facility records rendered but stable detail action selector found none: ${JSON.stringify(diagnostics())}`);

  const firstDetailAction = page.locator('a[aria-label^="View "][href^="/system/facilities/"]').first();
  await firstDetailAction.click();
  await page.waitForURL('**/system/facilities/**');
  await page.getByRole('heading', { name: 'Facility governance', exact: true }).waitFor({ state: 'visible' });
  state = await facilityGovernanceState(page);
  steps.push('facility-governance-list-detail');
  return { state: 'populated', apiStatus: api.status, apiFacilityCount: api.itemCount };
}

function sanitizeWorkerState(state) {
  return {
    registrationCount: state.registrationCount,
    controller: state.controller,
    profileDirectoryId: path.basename(userDataDir),
    registrations: state.registrations.map(registration => ({
      scope: registration.scope,
      scriptURL: registration.scriptURL,
      installingState: registration.installingState,
      waitingState: registration.waitingState,
      activeState: registration.activeState,
    })),
  };
}

async function inspectServiceWorkers(page) {
  return await page.evaluate(async currentOrigin => {
    const registrations = 'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistrations()
      : [];
    const sameOrigin = registrations.filter(registration => {
      try { return new URL(registration.scope).origin === currentOrigin; }
      catch { return false; }
    });
    return {
      registrationCount: sameOrigin.length,
      controller: navigator.serviceWorker?.controller
        ? {
            scriptURL: new URL(navigator.serviceWorker.controller.scriptURL).pathname,
            state: navigator.serviceWorker.controller.state,
          }
        : null,
      registrations: sameOrigin.map(registration => {
        const worker = registration.active ?? registration.waiting ?? registration.installing;
        return {
          scope: new URL(registration.scope).pathname,
          scriptURL: worker ? new URL(worker.scriptURL).pathname : null,
          installingState: registration.installing?.state ?? null,
          waitingState: registration.waiting?.state ?? null,
          activeState: registration.active?.state ?? null,
        };
      }),
    };
  }, new URL(baseUrl).origin);
}

async function stabilizeServiceWorkerState(page, label, { forceReload = false } = {}) {
  await page.evaluate(() => window.bloodLinkServiceWorkerCleanup ?? Promise.resolve());
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  let state = await inspectServiceWorkers(page);
  if (forceReload || state.registrationCount > 0 || state.controller !== null) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.bl-sidebar').waitFor({ state: 'visible', timeout: 30000 });
    await page.evaluate(() => window.bloodLinkServiceWorkerCleanup ?? Promise.resolve());
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    state = await inspectServiceWorkers(page);
  }
  if (state.registrationCount !== 0 || state.controller !== null)
    throw new Error(`${label}: service-worker final state is not clean: ${JSON.stringify(sanitizeWorkerState(state))}`);
  return state;
}

async function ensureShell(page, label, options = {}) {
  await page.locator('.bl-sidebar').waitFor({ state: 'visible', timeout: 30000 });
  await stabilizeServiceWorkerState(page, label, options);
  const shell = await page.evaluate(() => ({
    heading: document.querySelector('h1')?.textContent?.trim() ?? '',
    sidebar: Boolean(document.querySelector('.bl-sidebar')),
    navLinks: [...document.querySelectorAll('#workspace-navigation a')].map(link => new URL(link.href).pathname),
    width: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  }));
  if (!shell.sidebar || !shell.heading) throw new Error(`${label}: authenticated shell did not render.`);
  if (shell.width > shell.viewportWidth) throw new Error(`${label}: global horizontal overflow.`);
  if (!shell.navLinks.includes('/dashboard') || !shell.navLinks.includes('/system/facilities') || !shell.navLinks.includes('/account/manage'))
    throw new Error(`${label}: SystemAdmin navigation is incomplete.`);
  return shell;
}

async function scrollChecks(page, label, width, height) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const geometry = await page.evaluate(() => ({ max: document.documentElement.scrollHeight - innerHeight, bodyWidth: document.body.scrollWidth, viewport: innerWidth }));
  if (geometry.bodyWidth > geometry.viewport) throw new Error(`${label}: horizontal overflow at ${width}x${height}.`);
  if (geometry.max <= 0) return;
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(100);
  const wheel = await page.evaluate(() => scrollY);
  if (wheel <= 0) throw new Error(`${label}: mouse-wheel scrolling failed at ${width}x${height}.`);
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(100);
  const pageDown = await page.evaluate(() => scrollY);
  if (pageDown <= wheel) throw new Error(`${label}: Page Down scrolling failed at ${width}x${height}.`);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);
  const key = await page.evaluate(() => scrollY);
  if (key <= pageDown) throw new Error(`${label}: keyboard scrolling failed at ${width}x${height}.`);
  await page.evaluate(() => window.scrollTo(0, 0));
  if (width === 375) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: width / 2, y: height * 0.8, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: width / 2, y: height * 0.35, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);
    if ((await page.evaluate(() => scrollY)) <= 0) throw new Error(`${label}: touch scrolling failed at ${width}x${height}.`);
    await cdp.detach();
  }
}

try {
  context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: input.chromePath,
    headless: true,
    args: ['--no-sandbox'],
  });
  context.on('serviceworker', worker => {
    workerEvents.push({
      scriptURL: sanitizeUrl(worker.url()),
      profileDirectoryId: path.basename(userDataDir),
    });
  });
  const page = await context.newPage();
  await attachGuards(page);
  await page.goto(`${baseUrl}/account/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).fill(input.email);
  await page.getByLabel('Password', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  await ensureShell(page, 'dashboard', { forceReload: true });
  steps.push('login-dashboard-shell');

  const cors = await page.evaluate(async api => {
    try {
      const response = await fetch(`${api}/api/v1/auth/me`, { headers: { Authorization: 'Bearer authenticated-verification-invalid' } });
      return { resolved: true, status: response.status };
    } catch {
      return { resolved: false, status: 0 };
    }
  }, apiUrl);
  if (!cors.resolved || ![200, 401, 403].includes(cors.status)) throw new Error(`Authenticated CORS/API check failed with status ${cors.status}.`);
  steps.push('authenticated-cors');

  const facilityGovernance = await verifyFacilityGovernance(page);

  await page.goto(`${baseUrl}/account/manage`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Account', exact: true }).waitFor({ state: 'visible' });
  steps.push('account-navigation');

  await page.goto(`${baseUrl}/system/facilities`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ensureShell(page, 'direct refresh');
  steps.push('direct-route-refresh-session-restoration');

  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
    await ensureShell(page, `dashboard ${width}x${height}`);
    await scrollChecks(page, 'dashboard', width, height);
    await page.goto(`${baseUrl}/system/facilities`, { waitUntil: 'domcontentloaded' });
    await scrollChecks(page, 'facility governance', width, height);
    if (width === 375) {
      await page.locator('.bl-sidebar-toggle').click();
      await page.locator('.bl-sidebar-toggle[aria-expanded="true"]').waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await page.locator('.bl-sidebar-toggle[aria-expanded="false"]').waitFor({ state: 'visible' });
      steps.push('mobile-navigation-open-close');
    }
  }
  steps.push('scrolling-all-viewports');

  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForURL('**/account/login**', { timeout: 30000 });
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/account/login**', { timeout: 30000 });
  steps.push('logout-protected-route-denial');

  if (errors.length) throw new Error(`Browser console/policy failures: ${errors.join(' | ')}`);
  if (failedAssets.length) throw new Error(`Missing or failed assets: ${failedAssets.join(' | ')}`);
  const result = {
    production: baseUrl,
    role: 'SystemAdmin',
    viewports: sizes.map(([width, height]) => `${width}x${height}`),
    steps,
    corsHttpStatus: cors.status,
    browserErrors: 0,
    failedAssets: 0,
    serviceWorkers: 0,
    serviceWorkerController: null,
    serviceWorkerEventsIgnored: workerEvents.length,
    facilityGovernance,
    screenshots: [],
  };
  await writeFile(path.join(evidenceDir, 'production-authenticated-verification.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'w' });
  console.log(`Authenticated production verification passed. Sanitized result: ${path.relative(root, path.join(evidenceDir, 'production-authenticated-verification.json'))}`);
} finally {
  await context?.close();
  if (path.resolve(userDataDir).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(userDataDir).startsWith('bloodlink-auth-verification-')) {
    await rm(userDataDir, { recursive: true, force: true });
  }
}
