import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.PUBLIC_BASE_URL ?? 'https://d2z1pcfp95dfwd.cloudfront.net';
const apiUrl = 'https://wvsrmqrfc0.execute-api.eu-north-1.amazonaws.com';
const sizes = [[375, 667], [768, 1024], [1440, 900], [1920, 1080]];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidenceDir = path.join(root, 'artifacts', 'ui-parity', process.env.BLOODLINK_FIXTURES === '1' ? 'structural-public-2026-10-04/legacy-public-local' : '.');
const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('Set CHROME_PATH to the installed Chrome or Chromium executable.');
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
const browserErrors = [];
const failedAssets = [];
let corsStatus = null;

async function serviceWorkerState(page) {
  await page.evaluate(() => window.bloodLinkServiceWorkerCleanup ?? Promise.resolve());
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  return await page.evaluate(async () => ({
    registrations: 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0,
    caches: 'caches' in window ? await caches.keys() : [],
  }));
}

try {
  for (const [width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width === 375, hasTouch: width === 375 });
    if (process.env.BLOODLINK_FIXTURES === '1') {
      const { installDesignFixtures } = await import('./local-design-fixtures.mjs');
      await installDesignFixtures(context, baseUrl, 'FacilityAdmin', { restore: false });
    }
    const page = await context.newPage();
    page.on('pageerror', () => browserErrors.push(`page-exception:${width}x${height}`));
    page.on('console', message => {
      if (message.type() === 'error' && /content security policy|csp|mixed content/i.test(message.text()))
        browserErrors.push(`policy-console:${width}x${height}`);
      else if (message.type() === 'error' && !message.text().includes('401'))
        browserErrors.push(`console-error:${width}x${height}`);
    });
    page.on('requestfailed', request => {
      if (!request.failure()?.errorText?.includes('ERR_ABORTED')) failedAssets.push(`request-failed:${width}x${height}`);
    });
    page.on('response', response => {
      const url = new URL(response.url());
      if (response.status() >= 400 && url.origin !== apiUrl)
        failedAssets.push(`asset-${response.status()}:${width}x${height}`);
    });

    const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    if (response?.status() !== 200) throw new Error(`Production home returned HTTP ${response?.status()}.`);
    await page.locator('.bl-public-header').waitFor({ state: 'visible' });
    await page.locator('.public-home-image img').waitFor({ state: 'visible' });
    const design = await page.evaluate(() => {
      const primary = document.querySelector('.bl-btn-primary');
      return {
        heading: document.querySelector('h1')?.innerText?.trim() ?? '',
        header: Boolean(document.querySelector('.bl-public-header')),
        heroGraphic: Boolean(document.querySelector('.public-home-image img')?.naturalWidth),
        register: [...document.querySelectorAll('a')].some(a => new URL(a.href).pathname === '/facility/register'),
        login: [...document.querySelectorAll('a')].some(a => new URL(a.href).pathname === '/account/login'),
        redAccent: getComputedStyle(document.documentElement).getPropertyValue('--bl-brand').trim(),
        width: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        scrollHeight: document.documentElement.scrollHeight,
      };
    });
    if (!design.heading || !design.header || !design.heroGraphic || !design.register || !design.login)
      throw new Error(`Public design/action check failed at ${width}x${height}.`);
    if (design.width > width) throw new Error(`Horizontal page overflow at ${width}x${height}.`);
    if (!design.redAccent) throw new Error(`BloodLink red accent missing at ${width}x${height}.`);
    const workers = await serviceWorkerState(page);
    if (workers.registrations !== 0) throw new Error('A service worker is registered and may retain stale UI.');

    const cors = await page.evaluate(async api => {
      try {
        const response = await fetch(`${api}/api/v1/auth/me`, { headers: { Authorization: 'Bearer public-verification-invalid' } });
        return { resolved: true, status: response.status };
      } catch {
        return { resolved: false, status: 0 };
      }
    }, apiUrl);
    if (!cors.resolved || ![200, 401, 403].includes(cors.status)) throw new Error('Cross-origin API request did not pass the CloudFront-origin CORS check.');
    corsStatus = cors.status;

    await page.locator('a[href="/facility/register"]:visible').first().click();
    await page.waitForURL('**/facility/register');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Register your facility', exact: true }).waitFor({ state: 'visible' });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('a[href="/account/login"]:visible').first().click();
    await page.waitForURL('**/account/login');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor({ state: 'visible' });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('.bl-public-header').waitFor({ state: 'visible' });

    if (design.scrollHeight > height + 100) {
      await page.evaluate(() => window.scrollTo(0, 0));
      const start = await page.evaluate(() => scrollY);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(100);
      const wheel = await page.evaluate(() => scrollY);
      if (wheel <= start) throw new Error(`Mouse-wheel scrolling failed at ${width}x${height}.`);

      await page.keyboard.press('PageDown');
      await page.waitForTimeout(100);
      const pageDown = await page.evaluate(() => scrollY);
      if (pageDown <= wheel) throw new Error(`Page Down scrolling failed at ${width}x${height}.`);

      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);
      const keyboard = await page.evaluate(() => scrollY);
      if (keyboard <= pageDown) throw new Error(`Keyboard scrolling failed at ${width}x${height}.`);

      await page.evaluate(() => window.scrollTo(0, 0));
      const scrollbar = await page.evaluate(() => ({ viewport: innerHeight, client: document.documentElement.clientHeight, total: document.documentElement.scrollHeight, width: innerWidth - document.documentElement.clientWidth }));
      if (scrollbar.width > 0) {
        const thumb = Math.max(18, scrollbar.client * scrollbar.client / scrollbar.total);
        const x = width - Math.max(2, scrollbar.width / 2);
        await page.mouse.move(x, thumb / 2);
        await page.mouse.down();
        await page.mouse.move(x, Math.max(thumb, height * 0.55), { steps: 5 });
        await page.mouse.up();
        if ((await page.evaluate(() => scrollY)) <= 0) throw new Error(`Scrollbar dragging failed at ${width}x${height}.`);
      }

      if (width === 375) {
        await page.evaluate(() => window.scrollTo(0, 0));
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: width / 2, y: height * 0.8, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: width / 2, y: height * 0.35, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(150);
        if ((await page.evaluate(() => scrollY)) <= 0) throw new Error('Touch-emulated scrolling failed at 375x667.');
        await cdp.detach();
      }
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(evidenceDir, `production-public-${width}x${height}.png`), fullPage: false });
    await context.close();
  }

  if (browserErrors.length) throw new Error(`Browser console/policy failures: ${browserErrors.join(', ')}.`);
  if (failedAssets.length) throw new Error(`Missing or failed public assets: ${failedAssets.join(', ')}.`);
  const result = { production: baseUrl, viewports: sizes.map(([width, height]) => `${width}x${height}`), corsHttpStatus: corsStatus, browserErrors: 0, failedAssets: 0, serviceWorkers: 0, screenshots: sizes.map(([width, height]) => `artifacts/ui-parity/production-public-${width}x${height}.png`) };
  await writeFile(path.join(evidenceDir, 'production-public-verification.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'w' });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
