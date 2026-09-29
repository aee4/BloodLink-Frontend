import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = 'https://d2z1pcfp95dfwd.cloudfront.net';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidenceDir = path.join(root, 'artifacts', 'ui-parity');
const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('Set CHROME_PATH to the installed Chrome or Chromium executable.');
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
const errors = [];
const failedAssets = [];

async function inspect(page) {
  return await page.evaluate(async () => ({
    registrations: 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).map(registration => ({
      scope: registration.scope,
      scriptURL: registration.active?.scriptURL ?? registration.waiting?.scriptURL ?? registration.installing?.scriptURL ?? null,
    })) : [],
    caches: 'caches' in window ? await caches.keys() : [],
    sessionMarker: sessionStorage.getItem('bloodlink.cleanup.marker'),
  }));
}

try {
  const context = await browser.newContext();
  await context.route(`${baseUrl}/service-worker.js?legacy-cleanup-test`, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `
      self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
      self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
      self.addEventListener('fetch', () => {});
    `,
  }));

  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`page-exception:${error.name}`));
  page.on('console', message => {
    if (message.type() === 'error' && !/401|403/.test(message.text())) errors.push(`console-error:${message.text().slice(0, 120)}`);
  });
  page.on('requestfailed', request => {
    const failure = request.failure()?.errorText ?? '';
    if (!failure.includes('ERR_ABORTED')) failedAssets.push(`request-failed:${new URL(request.url()).pathname}:${failure}`);
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    sessionStorage.setItem('bloodlink.cleanup.marker', 'preserve-me');
    await caches.open('offline-cache-legacy-bloodlink');
    await caches.open('bloodlink-runtime-legacy');
    await caches.open('unrelated-cache-must-remain');
    const registration = await navigator.serviceWorker.register('/service-worker.js?legacy-cleanup-test', { scope: '/' });
    await navigator.serviceWorker.ready;
    if (registration.active?.state !== 'activated') {
      await new Promise(resolve => {
        const worker = registration.installing ?? registration.waiting ?? registration.active;
        worker?.addEventListener('statechange', () => worker.state === 'activated' && resolve(), { once: true });
        setTimeout(resolve, 3000);
      });
    }
  });

  const before = await inspect(page);
  if (before.registrations.length === 0) throw new Error('Legacy service-worker simulation did not register.');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.bl-public-header').waitFor({ state: 'visible', timeout: 30000 });
  const cleanup = await page.evaluate(() => window.bloodLinkServiceWorkerCleanup ?? Promise.resolve());
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  const after = await inspect(page);
  if (after.registrations.length !== 0) throw new Error(`Cleanup left service workers registered: ${JSON.stringify(after.registrations)}.`);
  if (after.caches.some(name => /^offline-cache-|^bloodlink/i.test(name))) throw new Error(`Cleanup left BloodLink-owned caches: ${after.caches.join(', ')}.`);
  if (!after.caches.includes('unrelated-cache-must-remain')) throw new Error('Cleanup removed an unrelated same-origin cache.');
  if (after.sessionMarker !== 'preserve-me') throw new Error('Cleanup cleared sessionStorage.');
  if (errors.length) throw new Error(`Browser failures: ${errors.join(' | ')}`);
  if (failedAssets.length) throw new Error(`Failed browser requests: ${failedAssets.join(' | ')}`);

  const result = {
    production: baseUrl,
    beforeRegistrationCount: before.registrations.length,
    afterRegistrationCount: after.registrations.length,
    removedBloodLinkCaches: cleanup.cachesDeleted ?? [],
    unrelatedCachePreserved: after.caches.includes('unrelated-cache-must-remain'),
    sessionStoragePreserved: after.sessionMarker === 'preserve-me',
  };
  await writeFile(path.join(evidenceDir, 'production-service-worker-cleanup.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'w' });
  console.log(JSON.stringify(result, null, 2));
  await context.close();
} finally {
  await browser.close();
}
