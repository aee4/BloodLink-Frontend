import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const appUrl = process.env.BLOODLINK_LOCAL_URL ?? 'http://127.0.0.1:5274';
const apiConfiguration = JSON.parse(readFileSync(new URL('../../src/BloodLink.Web/wwwroot/appsettings.json', import.meta.url), 'utf8'));
const apiOrigin = process.env.BLOODLINK_LOCAL_API_ORIGIN ?? new URL(apiConfiguration.Api.BaseUrl).origin;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ timezoneId: 'Africa/Accra' });
await context.addInitScript(() => sessionStorage.setItem('bloodlink.refresh', 'local-activity-verification'));
const page = await context.newPage();
page.setDefaultTimeout(7000);
const errors = [];
const documentRequests = [];
let eventCount = 8;
let emptyActivity = false;
let singlePageActivity = false;
let activityRequests = [];
const apiCalls = [];
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
page.on('pageerror', error => errors.push(`page: ${error.message}`));
page.on('requestfailed', request => errors.push(`request: ${request.url()}`));
page.on('request', request => { if (request.resourceType() === 'document') documentRequests.push(request.url()); });

const user = {
  id: 'local-verification', email: 'local@example.test', firstName: 'Local', lastName: 'Reviewer',
  facilityId: null, roles: ['SystemAdmin'], facilityStatus: null, mustChangePassword: false
};
const events = count => Array.from({ length: count }, (_, index) => ({
  action: index % 2 ? 'BloodNeedSubmitted' : 'AccountLogin',
  summary: `Audit event ${index + 1}`,
  createdAtUtc: new Date(Date.UTC(2026, 8, 30, 14, index)).toISOString(),
  entityType: 'User', entityId: null
}));
const corsHeaders = {
  'Access-Control-Allow-Origin': new URL(appUrl).origin,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'authorization,content-type,x-bloodlink-suppress-session-expired',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Content-Type': 'application/json'
};
const json = body => JSON.stringify(body);

await page.route(`${apiOrigin}/**`, async route => {
  const request = route.request();
  if (request.method() === 'OPTIONS') {
    apiCalls.push(`OPTIONS ${new URL(request.url()).pathname}`);
    return route.fulfill({ status: 204, headers: corsHeaders });
  }
  const url = new URL(request.url());
  const path = url.pathname;
  apiCalls.push(`${request.method()} ${path}`);
  if (path === '/api/v1/auth/refresh') {
    return route.fulfill({ status: 200, headers: corsHeaders, body: json({
      accessToken: 'local-access', tokenType: 'Bearer', expiresIn: 3600,
      refreshToken: 'local-refresh-next', refreshTokenExpiresAtUtc: '2027-01-01T00:00:00Z', user
    }) });
  }
  if (path === '/api/v1/auth/me') return route.fulfill({ status: 200, headers: corsHeaders, body: json(user) });
  if (path === '/api/v1/dashboard') {
    return route.fulfill({ status: 200, headers: corsHeaders, body: json({
      activeFacilities: 1, suspendedFacilities: 0, totalFacilities: 1, activeRequests: 0,
      recentActivity: events(eventCount)
    }) });
  }
  if (path === '/api/v1/notifications') {
    return route.fulfill({ status: 200, headers: corsHeaders, body: json({ items: [], pageNumber: 1, pageSize: 25, hasNext: false }) });
  }
  if (path === '/api/v1/notifications/unread-count') {
    return route.fulfill({ status: 200, headers: corsHeaders, body: json({ count: 0 }) });
  }
  if (path === '/api/v1/activity') {
    const requestedPage = Number(url.searchParams.get('page') ?? 1);
    activityRequests.push(requestedPage);
    const items = emptyActivity ? [] : singlePageActivity ? events(3) : requestedPage === 1 ? events(25) : requestedPage === 2 ? events(3) : [];
    return route.fulfill({ status: 200, headers: corsHeaders, body: json({
      items, pageNumber: requestedPage, pageSize: 25, hasNext: !emptyActivity && !singlePageActivity && requestedPage === 1
    }) });
  }
  return route.fulfill({ status: 404, headers: corsHeaders, body: json({ code: 'not_found' }) });
});

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const noOverflow = async label => {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert(dimensions.scroll <= dimensions.width, `${label}: horizontal overflow ${dimensions.scroll}px > ${dimensions.width}px`);
};
const gotoDashboard = async count => {
  eventCount = count;
  await page.goto(`${appUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Recent activity', exact: true }).waitFor();
  await page.waitForFunction(expected => document.querySelectorAll('.bl-dash-row').length === Math.min(expected, 5), count);
};

try {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const count of [0, 3, 5, 8]) {
      await gotoDashboard(count);
      const rows = await page.locator('.bl-dash-row').allTextContents();
      assert(rows.length === Math.min(count, 5), `dashboard count ${count} at ${width}px`);
      assert(rows.length === 0 || rows[0].includes(`Audit event ${count}`), `dashboard newest-first at ${width}px`);
      assert(await page.getByRole('link', { name: 'View all activity', exact: true }).isVisible(), `dashboard link at ${width}px`);
      if (rows.length) {
        const time = await page.locator('.bl-dash-time').first().innerText();
        assert(/30 Sep 2026, 2:\d{2} PM/.test(time), `readable dashboard timestamp at ${width}px: ${time}`);
        assert(!time.includes('T') && !time.includes('.'), `raw timestamp displayed at ${width}px`);
      }
      await noOverflow(`dashboard ${width}px/${count} events`);
    }
  }

  await page.setViewportSize({ width: 375, height: 900 });
  await gotoDashboard(8);
  const beforeNavigation = documentRequests.length;
  await page.getByRole('link', { name: 'View all activity', exact: true }).click();
  await page.getByRole('heading', { name: 'Activity', exact: true }).waitFor();
  assert(documentRequests.length === beforeNavigation, 'activity link caused document reload');
  assert(await page.getByRole('button', { name: 'Previous page' }).isDisabled(), 'first page Previous must be disabled');
  assert(await page.getByRole('button', { name: 'Next page' }).isEnabled(), 'first page Next must be enabled');
  assert(await page.locator('.bl-activity-item').count() === 25, 'activity page first result count');
  await noOverflow('activity page 375px');

  await page.getByRole('button', { name: 'Next page' }).click();
  await page.getByText('Page 2', { exact: true }).waitFor();
  assert(activityRequests.at(-1) === 2, 'Next did not fetch page 2');
  assert(await page.locator('.bl-activity-item').count() === 3, 'activity page second result count');
  assert(await page.getByRole('button', { name: 'Previous page' }).isEnabled(), 'page 2 Previous must be enabled');
  assert(await page.getByRole('button', { name: 'Next page' }).isDisabled(), 'last page Next must be disabled');
  await page.getByRole('button', { name: 'Previous page' }).click();
  await page.getByText('Page 1', { exact: true }).waitFor();
  assert(activityRequests.at(-1) === 1, 'Previous did not fetch page 1');

  singlePageActivity = true;
  await gotoDashboard(8);
  await page.getByRole('link', { name: 'View all activity', exact: true }).click();
  await page.getByRole('heading', { name: 'Activity', exact: true }).waitFor();
  assert(await page.locator('.bl-activity-item').count() === 3, 'single-page activity count');
  assert(await page.getByRole('button', { name: 'Previous page' }).isDisabled(), 'single-page Previous must be disabled');
  assert(await page.getByRole('button', { name: 'Next page' }).isDisabled(), 'single-page Next must be disabled');

  for (const width of [768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(`activity ${width}px`);
  }

  emptyActivity = true;
  singlePageActivity = false;
  await gotoDashboard(0);
  await page.getByRole('link', { name: 'View all activity', exact: true }).click();
  await page.getByText('No activity yet', { exact: true }).waitFor();
  assert(await page.getByRole('button', { name: 'Previous page' }).isDisabled(), 'empty Previous must be disabled');
  assert(await page.getByRole('button', { name: 'Next page' }).isDisabled(), 'empty Next must be disabled');
  await noOverflow('empty activity page');

  assert(errors.length === 0, errors.join('\n'));
  process.stdout.write('PASS: dashboard 0/3/5/8 events at 375/768/1440; activity empty/first/next/previous; client-side link; readable timestamps; no overflow or browser errors.\n');
} catch (error) {
  process.stderr.write(`FAILED at ${page.url()}\n${error.message}\nAPI calls: ${apiCalls.join(', ')}\nBrowser errors: ${errors.join(' | ')}\n`);
  throw error;
} finally {
  await context.close();
  await browser.close();
}
