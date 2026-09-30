import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const appUrl = process.env.BLOODLINK_LOCAL_URL ?? 'http://127.0.0.1:5083';
const apiOrigin = 'https://wvsrmqrfc0.execute-api.eu-north-1.amazonaws.com';
const facilityStatuses = [
  { id: '00000000-0000-0000-0000-000000000001', status: 1, name: 'Active Facility' },
  { id: '00000000-0000-0000-0000-000000000002', status: 3, name: 'Suspended Facility' },
  { id: '00000000-0000-0000-0000-000000000003', status: 0, name: 'Pending Legacy Facility' },
  { id: '00000000-0000-0000-0000-000000000004', status: 2, name: 'Rejected Legacy Facility' },
];
const calls = [];
const authCalls = [];
const errors = [];
const failedResponses = [];
let emptyPendingResult = false;
const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('Set CHROME_PATH to the installed Chrome or Chromium executable.');

function response(body, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

const systemUser = {
  id: 'mock-system-admin', email: 'mock@example.test', firstName: 'Mock', lastName: 'Admin',
  facilityId: null, roles: ['SystemAdmin'], facilityStatus: null, mustChangePassword: false,
};

function tokenResponse() {
  return {
    accessToken: 'local-mock-access', tokenType: 'Bearer', expiresIn: 3600,
    refreshToken: 'local-mock-refresh', refreshTokenExpiresAtUtc: '2027-01-01T00:00:00Z', user: systemUser,
  };
}

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.name));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) failedResponses.push(new URL(response.url()).pathname); });
await page.route('**/favicon.ico', route => route.fulfill({ status: 204, body: '' }));
await page.addInitScript(() => sessionStorage.setItem('bloodLink.refresh', 'local-mock-refresh'));
await page.route(`${apiOrigin}/**`, async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.pathname.includes('/auth/')) authCalls.push({ method: request.method(), path: url.pathname });
  if (url.pathname === '/api/v1/auth/refresh' || url.pathname === '/api/v1/auth/login')
    return route.fulfill(response(tokenResponse()));
  if (url.pathname === '/api/v1/auth/me') return route.fulfill(response(systemUser));
  if (url.pathname === '/api/v1/notifications')
    return route.fulfill(response({ items: [], pageNumber: 1, pageSize: 25, hasNext: false }));
  if (url.pathname === '/api/v1/system/facilities') {
    const status = url.searchParams.get('status');
    calls.push({ status, query: url.searchParams.toString() });
    if (status === '2') await new Promise(resolve => setTimeout(resolve, 450));
    if (status === '3') await new Promise(resolve => setTimeout(resolve, 75));
    const items = emptyPendingResult && status === '0'
      ? []
      : facilityStatuses.filter(item => status === null || item.status === Number(status));
    return route.fulfill(response({
      items: items.map(item => ({
        id: item.id, name: item.name, facilityType: 1, registrationNumber: `TEST-${item.status}`,
        region: 'Test Region', city: 'Test City', address: '', contactEmail: 'mock@example.test',
        contactPhone: '', status: item.status, rejectionReason: null,
        createdAtUtc: '2026-01-01T00:00:00Z', approvedAtUtc: null,
      })),
      pageNumber: 1, pageSize: 25, hasNext: false,
    }));
  }
  return route.fulfill(response({ title: 'Not found', status: 404 }, 404));
});

async function displayedStatuses() {
  return page.locator('.bl-table tbody tr td:nth-child(5) .bl-status-badge').allTextContents();
}

async function selectAndAssert(value, expectedLabel) {
  await page.getByLabel('Filter status').selectOption(value);
  await page.waitForFunction(expected => {
    const selected = document.querySelector('select')?.value;
    const rows = [...document.querySelectorAll('.bl-table tbody tr')];
    if (selected !== expected) return false;
    if (selected === '') return rows.length === 4;
    const wanted = { '1': 'Active', '3': 'Suspended', '0': 'Legacy pending', '2': 'Rejected (legacy)' }[selected];
    return rows.length === 1 && rows[0].querySelector('td:nth-child(5)')?.innerText.trim() === wanted;
  }, value, { timeout: 5000 }).catch(async error => {
    throw new Error(`Filter ${value} did not settle: ${JSON.stringify({ selected: await page.locator('select').inputValue(), rows: await displayedStatuses(), calls, errors })}; ${error.message}`);
  });
  const statuses = (await displayedStatuses()).map(value => value.trim());
  const expectedStatus = value === '' ? ['Active', 'Suspended', 'Legacy pending', 'Rejected (legacy)'] : [expectedLabel];
  assert.deepEqual(statuses, expectedStatus);
}

try {
  await page.goto(`${appUrl}/account/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).fill('mock@example.test');
  await page.getByLabel('Password', { exact: true }).fill('local-mock-password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await page.goto(`${appUrl}/system/facilities`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Facility governance', exact: true }).waitFor({ timeout: 8000 }).catch(async () => {
    const headings = await page.locator('h1').allTextContents();
    throw new Error(`Unexpected local route state: ${JSON.stringify({ path: new URL(page.url()).pathname, headings, authCalls })}`);
  });
  await page.getByText('Active Facility', { exact: true }).waitFor();

  await selectAndAssert('', 'Active');
  await selectAndAssert('1', 'Active');
  await selectAndAssert('3', 'Suspended');
  await selectAndAssert('0', 'Legacy pending');
  await selectAndAssert('2', 'Rejected (legacy)');
  await selectAndAssert('', 'Active');

  assert.ok(calls.some(call => call.query === 'page=1&pageSize=25'), 'All omits the status query');
  for (const status of ['0', '1', '2', '3'])
    assert.ok(calls.some(call => call.status === status), `numeric status ${status} is sent`);

  const switchSequenceStart = calls.length;
  await page.evaluate(() => {
    const select = document.querySelector('select');
    for (const value of ['2', '3', '']) {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await page.waitForTimeout(650);
  assert.equal(await page.locator('.bl-table tbody tr').count(), 4, 'late filtered responses do not overwrite final All result');
  assert.equal(await page.locator('select').inputValue(), '');
  assert.ok(calls.slice(switchSequenceStart).some(call => call.status === '2'));
  assert.ok(calls.slice(switchSequenceStart).some(call => call.status === '3'));
  assert.ok(calls.slice(switchSequenceStart).some(call => call.status === null));

  emptyPendingResult = true;
  await page.getByLabel('Filter status').selectOption('0');
  await page.getByText('No facilities in this status', { exact: true }).waitFor();

  const widths = [375, 768, 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 850 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal overflow at ${width}px`);
    assert.ok(await page.getByLabel('Filter status').isVisible(), `filter remains usable at ${width}px`);
  }
  assert.deepEqual(errors, [], JSON.stringify(failedResponses));
  console.log(JSON.stringify({
    result: 'PASS',
    route: '/system/facilities',
    queryStatuses: ['all', 'Approved=1', 'Suspended=3', 'Pending=0', 'Rejected=2'],
    rapidSwitchFinalResult: 'all',
    emptyState: true,
    widths,
    browserErrors: errors.length,
  }));
} finally {
  await context.close();
  await browser.close();
}
