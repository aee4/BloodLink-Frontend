import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const appUrl = process.env.BLOODLINK_LOCAL_URL ?? 'http://127.0.0.1:5083';
const apiOrigin = 'https://wvsrmqrfc0.execute-api.eu-north-1.amazonaws.com';
const facilityId = '91dce448-6d17-4ce9-94b1-82216b93c123';
const requestId = 'efb867d1-e8e5-4c37-bd95-892a77a90001';
const historyItem = notification('00000000-0000-0000-0000-000000000001', 2, 'Old request history', 'A prior request notification.', requestId, '2026-01-01T00:00:00Z');
let notificationItems = [historyItem];
let notificationPolls = 0;
const methods = [];
const pageErrors = [];
let documentNavigations = 0;
const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('Set CHROME_PATH to the installed Chrome or Chromium executable.');

function notification(id, type, title, message, relatedId, createdAtUtc) {
  return { id, notificationType: type, title, message, isRead: false, createdAtUtc, relatedEntityType: 'BloodRequest', relatedEntityId: relatedId };
}

function response(body, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

function user() {
  return { id: 'mock-facility-admin', email: 'mock@example.test', firstName: 'Mock', lastName: 'Admin', facilityId, roles: ['FacilityAdmin'], facilityStatus: 1, mustChangePassword: false };
}

function tokenResponse() {
  return { accessToken: 'local-mock-access', tokenType: 'Bearer', expiresIn: 3600, refreshToken: 'local-mock-refresh', refreshTokenExpiresAtUtc: '2027-01-01T00:00:00Z', user: user() };
}

async function waitFor(predicate, label, timeout = 35000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: process.env.BLOODLINK_COLOR_SCHEME ?? 'light' });
const page = await context.newPage();
page.on('pageerror', error => pageErrors.push(error.name));
page.on('request', request => {
  if (request.isNavigationRequest() && request.resourceType() === 'document') documentNavigations++;
  if (new URL(request.url()).origin === apiOrigin) methods.push(`${request.method()} ${new URL(request.url()).pathname}`);
});
await page.addInitScript(() => sessionStorage.setItem('bloodlink.refresh', 'local-mock-refresh'));
await page.route(`${apiOrigin}/**`, async route => {
  const request = route.request();
  const { pathname } = new URL(request.url());
  if (pathname === '/api/v1/auth/refresh' || pathname === '/api/v1/auth/login') return route.fulfill(response(tokenResponse()));
  if (pathname === '/api/v1/auth/me') return route.fulfill(response(user()));
  if (pathname === '/api/v1/auth/logout') return route.fulfill({ status: 204, body: '' });
  if (pathname === '/api/v1/facilities/me') return route.fulfill(response({ id: facilityId, name: 'Mock Blood Bank', facilityType: 1, registrationNumber: 'MOCK-1', region: 'Mock Region', city: 'Mock City', address: '', contactEmail: 'mock@example.test', contactPhone: '', status: 1, rejectionReason: null, createdAtUtc: '2026-01-01T00:00:00Z', approvedAtUtc: null }));
  if (pathname === '/api/v1/dashboard') return route.fulfill(response({ openNeeds: 0, sentRequests: 0, receivedRequests: 0, lowStockItems: 0, totalInventoryUnits: 0, availableInventoryUnits: 0, unreadNotifications: notificationItems.filter(item => !item.isRead).length, pendingNeeds: [], recentActivity: [] }));
  if (pathname === '/api/v1/notifications') {
    notificationPolls++;
    const items = [...notificationItems].sort((a, b) => Date.parse(b.createdAtUtc) - Date.parse(a.createdAtUtc));
    return route.fulfill(response({ items, pageNumber: 1, pageSize: 25, hasNext: false }));
  }
  if (pathname === '/api/v1/requests/' + requestId) return route.fulfill(response({ id: requestId, bloodNeedId: 'f83683f2-59e4-4bd6-9027-9e039675f5a2', requestingFacilityId: '934d2fbd-60df-40c7-8a82-ef115758550a', requestingFacilityName: 'Mock Hospital', sourceFacilityId: facilityId, sourceFacilityName: 'Mock Blood Bank', bloodType: 0, unitsRequested: 1, unitsAccepted: null, priority: 1, status: 0, requestNote: null, responseNote: null, createdAtUtc: '2026-06-01T00:00:00Z', respondedAtUtc: null, fulfilledAtUtc: null }));
  if (pathname.endsWith('/timeline') || pathname === '/api/v1/inventory') return route.fulfill(response([]));
  if (pathname === '/api/v1/inventory/search') return route.fulfill(response({ items: [], pageNumber: 1, pageSize: 25, hasNext: false }));
  return route.fulfill(response({ title: 'Not found', status: 404 }, 404));
});

try {
  await page.goto(`${appUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  await waitFor(() => notificationPolls >= 1, 'initial notification baseline');
  assert.equal(await page.locator('.bl-toast').count(), 0, 'existing history must not replay after session restoration');

  await page.goto(`${appUrl}/notifications`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Notifications', exact: true }).waitFor();
  await page.getByText('Old request history', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Mark read' }).count(), 1, 'notification center retains its read control');

  notificationItems = [historyItem, ...Array.from({ length: 5 }, (_, index) => {
    const suffix = index + 2;
    const id = `00000000-0000-0000-0000-${String(suffix).padStart(12, '0')}`;
    const type = [2, 3, 3, 4, 3][index];
    const title = ['New blood request received', 'Blood request accepted', 'Blood request rejected', 'Blood request fulfilled', 'Blood request cancelled'][index];
    const message = `Mock request update ${suffix}.`;
    return notification(id, type, title, message, requestId, `2026-07-01T00:00:0${suffix}Z`);
  })];
  const beforeArrivalPoll = notificationPolls;
  await waitFor(async () => notificationPolls > beforeArrivalPoll && await page.locator('.bl-toast').count() > 0, 'new notification toast poll', 35000);
  assert.ok(await page.locator('.bl-toast').count() <= 3, 'at most three toasts may be visible');
  assert.equal(await page.locator('.bl-toast').count(), 3, 'overflow notifications are queued');
  assert.equal(await page.getByRole('button', { name: 'View request' }).count(), 3, 'request notifications expose deep links');

  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    const region = await page.locator('.bl-toast-region').boundingBox();
    assert.ok(region && region.width <= width, `toast region fits ${width}px viewport`);
    assert.ok(await page.locator('.bl-toast').count() <= 3);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal overflow at ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const documentsBeforeDeepLink = documentNavigations;
  await page.getByRole('button', { name: 'View request', exact: true }).first().click();
  await page.waitForURL(`**/requests/${requestId}`);
  await page.getByRole('heading', { name: 'Request details', exact: true }).waitFor();
  assert.equal(documentNavigations, documentsBeforeDeepLink, 'toast action navigates client-side');

  await page.goto(`${appUrl}/notifications`, { waitUntil: 'domcontentloaded' });
  await page.getByText('New blood request received', { exact: true }).waitFor();
  assert.equal(await page.locator('.bl-notification-row').count(), 6, 'new notifications remain in history');
  assert.equal(await page.getByRole('button', { name: 'Mark read' }).count(), 6, 'toasts do not mark history read');
  const pollsAfterBatch = notificationPolls;
  await waitFor(() => notificationPolls > pollsAfterBatch, 'repeat poll for duplicate check', 35000);
  await page.waitForTimeout(250);
  assert.equal(await page.locator('.bl-toast').count(), 0, 'repeated poll does not replay already-seen toast IDs');

  await page.goto(`${appUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  const pollsBeforeLogout = notificationPolls;
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForURL('**/account/login**');
  assert.equal(await page.locator('.bl-toast').count(), 0, 'logout clears notification toasts');
  await page.waitForTimeout(1500);
  assert.equal(notificationPolls, pollsBeforeLogout, 'logout stops notification polling');
  assert.equal(await page.getByText(/session has expired/i).count(), 0, 'logout does not show false session expiry');

  await page.getByLabel('Email', { exact: true }).fill('mock@example.test');
  await page.getByLabel('Password', { exact: true }).fill('local-mock-password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  await waitFor(() => notificationPolls > pollsBeforeLogout, 'post-login history baseline');
  assert.equal(await page.locator('.bl-toast').count(), 0, 'login baselines existing history without replay');
  assert.equal(await page.locator('.bl-toast-region .bl-toast').count(), 0, 'empty live region shows no toast');
  assert.ok(pageErrors.length === 0, `browser errors: ${pageErrors.join(',')}`);
  assert.ok(methods.filter(item => item.startsWith('POST /api/v1/notifications/')).length === 0, 'toast interaction does not change read state');
  console.log(JSON.stringify({
    result: 'PASS',
    baselineNoReplay: true,
    visibleToastMaximum: 3,
    queuePromotedThroughExpiry: true,
    requestDeepLinkClientSide: true,
    notificationHistoryRetainedUnread: true,
    mobileTabletDesktop: [375, 768, 1440],
    duplicatePollNoReplay: true,
    logoutStoppedPollingAndClearedToasts: true,
    loginRebaselineNoReplay: true,
    browserErrors: pageErrors.length,
    notificationReadMutations: methods.filter(item => item.startsWith('POST /api/v1/notifications/')).length
  }));
} finally {
  await context.close();
  await browser.close();
}
