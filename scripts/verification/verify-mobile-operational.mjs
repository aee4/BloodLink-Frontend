import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const appUrl = process.env.BLOODLINK_LOCAL_URL ?? 'http://127.0.0.1:5274';
if (!['localhost', '127.0.0.1'].includes(new URL(appUrl).hostname)) throw new Error('This verifier requires a local frontend.');
const config = JSON.parse(readFileSync(new URL('../../src/BloodLink.Web/wwwroot/appsettings.json', import.meta.url)));
const apiOrigin = new URL(config.Api.BaseUrl).origin;
const output = new URL('../../artifacts/ui-parity/mobile-operational/', import.meta.url);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const widths = process.env.BLOODLINK_VIEWPORT_WIDTHS?.split(',').map(Number) ?? [320, 360, 375, 390, 430, 768, 1440];
const results = [];
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const facilityId = id(50);
const createdAtUtc = '2026-10-03T23:39:00Z';
const longName = 'Pamela Odamten Nancy Drew Senior Facility Operations Administrator';
const facilityName = 'Greater Accra Regional Teaching Hospital and Emergency Blood Coordination Centre';
const note = 'A long decision note explaining the need for emergency blood and coordination between facilities. '.repeat(8);
const needs = [0, 1, 3].map((status, i) => ({ id: id(i + 1), facilityId, bloodType: 0,
  unitsNeeded: 1, urgency: 2, status, createdAtUtc, creatorDisplayName: i ? longName : 'Pamela Odamten',
  neededByUtc: i === 2 ? null : '2026-10-04T23:55:00Z' }));
const requests = [0, 3, 2].map((status, i) => ({ id: id(i + 10), bloodNeedId: id(1),
  requestingFacilityId: id(60), requestingFacilityName: facilityName, sourceFacilityId: facilityId,
  sourceFacilityName: facilityName, bloodType: 0, unitsRequested: 1, unitsAccepted: status === 3 ? 1 : null,
  priority: 2, status, responseNote: note, createdAtUtc }));
const requestDetails = [requests[0], { ...requests[0], status: 1, unitsAccepted: 1 }, requests[1], requests[2]];
const inventory = [{ id: id(20), facilityId, bloodType: 0, totalUnits: 125, reservedUnits: 5,
  availableUnits: 120, lowStockThreshold: 10, updatedAtUtc: createdAtUtc, rowVersion: '' }];
const facility = { id: facilityId, name: facilityName, facilityType: 0, registrationNumber: 'LOCAL-001',
  region: 'Greater Accra', city: 'Accra', address: note, contactEmail: 'local@example.test',
  contactPhone: '0200000000', status: 1, createdAtUtc };
const paged = items => ({ items, pageNumber: 1, pageSize: 25, hasNext: false });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
let variant = 0;

try {
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ timezoneId: 'Africa/Accra', colorScheme });
    await context.addInitScript(() => sessionStorage.setItem('bloodlink.refresh', 'local-mobile-verification'));
    const user = { id: 'local-mobile', email: 'local@example.test', firstName: 'Pamela', lastName: 'Odamten',
      facilityId, roles: ['FacilityAdmin'], facilityStatus: 1, mustChangePassword: false };
    await context.route(`${apiOrigin}/**`, async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace('/api/v1', '');
      const headers = { 'Access-Control-Allow-Origin': new URL(appUrl).origin,
        'Access-Control-Allow-Headers': 'authorization,content-type,x-bloodlink-suppress-session-expired',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      let body;
      if (path === '/auth/refresh') body = { accessToken: 'local-access', tokenType: 'Bearer', expiresIn: 3600,
        refreshToken: 'local-refresh', refreshTokenExpiresAtUtc: '2027-01-01T00:00:00Z', user };
      else if (path === '/auth/me') body = user;
      else if (path === '/facilities/me' || path.startsWith('/system/facilities/')) body = facility;
      else if (path === '/system/facilities') body = paged([facility]);
      else if (path === '/notifications/unread-count') body = { count: 0 };
      else if (path === '/notifications') body = paged([{ id: id(80), notificationType: 0, title: 'Need update', message: note, isRead: false, createdAtUtc }]);
      else if (path === '/needs' || path === '/needs/mine') body = paged(needs);
      else if (path.startsWith('/needs/') && path.endsWith('/timeline')) body = [0, 1, 3].map((toStatus, i) => ({
        fromStatus: i ? i - 1 : null, toStatus, actorDisplayName: longName, note: i ? note : null, changedAtUtc: createdAtUtc }));
      else if (path.startsWith('/needs/')) body = { ...needs[variant % 3], id: id(1), facilityName,
        creatorDisplayName: variant % 2 ? longName : 'Pamela Odamten', note: variant % 2 ? null : note,
        inventoryAvailableUnits: variant % 2 ? 125 : 0, neededByUtc: '2026-10-04T23:55:00Z' };
      else if (path === '/requests/received' || path === '/requests/sent') body = paged(requests);
      else if (path.startsWith('/requests/') && path.endsWith('/timeline')) body = [{ fromStatus: null, toStatus: 0, actorDisplayName: longName, changedAtUtc: createdAtUtc }];
      else if (path.startsWith('/requests/')) body = requestDetails[variant % 4];
      else if (path === '/inventory') body = inventory;
      else if (path === '/inventory/low-stock') body = [];
      else if (path === '/inventory/history') body = paged([{ id: id(30), bloodType: 0, totalUnitsChange: 120,
        totalAfter: 125, reservedAfter: 5, reason: note, actorDisplayName: longName, createdAtUtc }]);
      else if (path === '/inventory/search') body = paged([{ facilityId, facilityName, facilityType: 0,
        city: 'Accra', region: 'Greater Accra', bloodType: 0, availableUnits: 120, updatedAtUtc: createdAtUtc }]);
      else if (path === '/staff') body = paged([{ userId: 'local-staff', facilityId, fullName: longName,
        email: 'long.local.staff@example.test', status: 1, createdAtUtc }]);
      else if (path === '/activity') body = paged([{ action: 'BloodNeedSubmitted', summary: note, createdAtUtc }]);
      else if (path === '/dashboard') body = { openNeeds: 3, sentRequests: 3, receivedRequests: 3,
        lowStockItems: 0, totalInventoryUnits: 125, availableInventoryUnits: 120, unreadNotifications: 0,
        pendingNeeds: needs, recentActivity: [{ action: 'BloodNeedSubmitted', summary: note, createdAtUtc }] };
      else throw new Error(`Unmocked API request: ${path}`);
      await route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.setDefaultTimeout(15000);
    const check = async (route, width) => {
      if (page.url() === 'about:blank') {
        await page.goto(`${appUrl}${route}`, { waitUntil: 'networkidle' });
      } else if (new URL(page.url()).pathname === route) {
        await page.getByRole('button', { name: 'Refresh', exact: true }).click();
        await page.waitForTimeout(100);
      } else {
        await page.evaluate(href => {
          const link = document.createElement('a');
          link.href = href;
          document.body.append(link);
          link.click();
          link.remove();
        }, route);
        await page.waitForURL(`${appUrl}${route}`);
        await page.waitForTimeout(100);
      }
      await page.waitForLoadState('networkidle');
      await page.locator('.bl-workspace-page, .bl-activity-page').first().waitFor();
      await page.waitForFunction(expected => document.querySelector('.bl-sidebar')?.dataset.currentPath === expected, route);
      await page.waitForFunction(() => !document.querySelector('.bl-loading-state'));
      const geometry = await page.evaluate(() => {
        const visible = e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
        const fields = [...document.querySelectorAll('.bl-facts dd, .bl-timeline-item > div, .bl-request-card-facts dd')].filter(visible);
        const cards = [...document.querySelectorAll('.bl-card')].filter(visible);
        return { viewport: innerWidth, document: document.documentElement.scrollWidth,
          narrowFields: fields.filter(e => e.getBoundingClientRect().width < 120).map(e => e.textContent),
          clippedCards: cards.filter(e => e.scrollWidth > e.clientWidth + 1).length,
          clippedActions: [...document.querySelectorAll('button, .bl-btn')].filter(visible).filter(e => {
            const r = e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth + 1;
          }).length };
      });
      assert(geometry.document <= geometry.viewport, `${route}/${width}: document overflow ${JSON.stringify(geometry)}`);
      assert(!geometry.narrowFields.length && !geometry.clippedCards && !geometry.clippedActions, `${route}/${width}: compressed/clipped content ${JSON.stringify(geometry)}`);
      if (route.startsWith('/requests/') && !['/requests/sent', '/requests/received'].includes(route)) {
        const summary = await page.locator('.bl-request-detail-flow').boundingBox();
        const history = await page.locator('.bl-history-card').boundingBox();
        assert(history.y >= summary.y + summary.height, 'Request history overlaps summary/actions');
      }
      if (route.startsWith('/needs/') && route !== '/needs/mine' && route !== '/needs/new') {
        await page.locator('.bl-facts dd').getByText(variant % 2 ? longName : 'Pamela Odamten', { exact: true }).waitFor();
        await page.locator('.bl-facts dd').getByText(variant % 2 ? '125 units' : '0 units', { exact: true }).waitFor();
        assert(await page.locator('.bl-facts dt').getByText('Note', { exact: true }).count() === (variant % 2 ? 0 : 1), 'Need note fixture not loaded');
        const details = await page.locator('.bl-record-detail').boundingBox();
        const history = await page.locator('.bl-detail-aside').boundingBox();
        assert(details && history, 'Need details/history not loaded');
        if (width <= 768) assert(history.y >= details.y + details.height, 'History overlaps details');
        else assert(history.x >= details.x + details.width, 'Desktop details grid changed');
        const actions = await page.locator('.bl-workflow-actions').boundingBox();
        assert(actions.y + actions.height <= details.y, 'Need actions must precede summary');
      }
      if (route === '/needs' || route === '/needs/mine') {
        assert(await page.getByRole('link', { name: 'View details', exact: true }).count() === 3, 'Missing explicit need actions');
        const display = await page.locator('.bl-record-table tbody tr').first().evaluate(e => getComputedStyle(e).display);
        assert(display === (width <= 768 ? 'grid' : 'table-row'), 'Incorrect needs breakpoint');
      }
      if (route === '/requests/received' || route === '/requests/sent') {
        assert(await page.locator(width <= 768 ? '.bl-request-cards' : '.bl-request-table').isVisible(), 'Incorrect request layout');
        assert(await page.locator(`${width <= 768 ? '.bl-request-cards' : '.bl-request-table'} a`).count() === 3, 'Missing View request actions');
        assert(await page.locator('a .bl-status-badge').count() === 0, 'Status badge used as navigation');
      }
      results.push({ route, width, colorScheme, variant, ...geometry });
    };
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/needs', '/needs/mine', '/requests/received', '/requests/sent', '/inventory', '/inventory/history', '/facility/staff', '/notifications', '/activity', '/account/manage', '/facility/profile', '/dashboard', '/needs/new', '/inventory/adjust', '/inventory/search']) {
        await check(route, width);
        if (['/needs', '/requests/received'].includes(route) && [320, 1440].includes(width)) {
          await page.screenshot({ path: new URL(`${route.slice(1).replaceAll('/', '-')}-${colorScheme}-${width}.png`, output).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
        }
        if (route === '/inventory/search') {
          await page.getByRole('button', { name: 'Search facilities', exact: true }).click();
          await page.locator('.bl-record-table').waitFor();
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Network search overflow');
        }
      }
      for (variant = 0; variant < 4; variant++) await check(`/needs/${id(1)}`, width);
      for (variant = 0; variant < 4; variant++) await check(`/requests/${id(10)}`, width);
      if ([320, 768, 1440].includes(width)) {
        variant = 0;
        await check(`/needs/${id(1)}`, width);
        await page.screenshot({ path: new URL(`need-${colorScheme}-${width}.png`, output).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
      }
      if (width <= 768) {
        await page.getByRole('button', { name: 'Open navigation menu' }).click();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Open menu overflow');
        await page.getByRole('button', { name: 'Close navigation menu' }).click();
        assert(await page.getByRole('button', { name: 'Sign out' }).isVisible(), 'Sign out inaccessible');
      }
      console.log(`PASS: ${colorScheme} ${width}px operational pages and detail scenarios`);
    }
    user.roles = ['SystemAdmin'];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${appUrl}/system/facilities`, { waitUntil: 'networkidle' });
      await check('/system/facilities', width);
      await page.locator('.bl-record-table').waitFor();
      await check(`/system/facilities/${facilityId}`, width);
    }
    assert(errors.length === 0, errors.join('\n'));
    await context.close();
  }
  writeFileSync(new URL('results.json', output), JSON.stringify(results, null, 2));
  console.log(`PASS: ${results.length} page/scenario checks; ${widths.join('/')}px; light/dark; no overflow, compressed fields, overlapping history or clipped actions.`);
} finally {
  await browser.close();
}
