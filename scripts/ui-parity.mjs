import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const origin = process.env.UI_PARITY_ORIGIN ?? 'http://127.0.0.1:5180';
const chrome = process.env.CHROME_PATH;
if (!chrome) throw new Error('Set CHROME_PATH to a local Chromium or Chrome executable.');
const root = process.cwd();
const output = path.join(root, 'artifacts', 'ui-parity');
await mkdir(output, { recursive: true });

const fixtures = {
  SystemAdmin: { id: 'fixture-system-admin', email: 'system-admin@example.test', firstName: 'Alex', lastName: 'System', facilityId: null, roles: ['SystemAdmin'], facilityStatus: null, mustChangePassword: false },
  FacilityAdmin: { id: 'fixture-facility-admin', email: 'facility-admin@example.test', firstName: 'Sam', lastName: 'Admin', facilityId: '11111111-1111-4111-8111-111111111111', roles: ['FacilityAdmin'], facilityStatus: 1, mustChangePassword: false },
  FacilityStaff: { id: 'fixture-facility-staff', email: 'facility-staff@example.test', firstName: 'Taylor', lastName: 'Staff', facilityId: '11111111-1111-4111-8111-111111111111', roles: ['FacilityStaff'], facilityStatus: 1, mustChangePassword: false }
};

const guid = '22222222-2222-4222-8222-222222222222';
const now = '2026-09-29T12:00:00Z';
const paged = items => ({ items, pageNumber: 1, pageSize: 25, hasNext: false });
const facility = { id: guid, name: 'Test Blood Centre', facilityType: 1, registrationNumber: 'FIXTURE-001', region: 'Greater Accra', city: 'Accra', address: 'Test Road', contactEmail: 'centre@example.test', contactPhone: '+233000000000', status: 0, rejectionReason: null, createdAtUtc: now, approvedAtUtc: null };
const need = { id: guid, facilityId: fixtures.FacilityAdmin.facilityId, facilityName: 'Test Blood Centre', bloodType: 6, unitsNeeded: 4, urgency: 2, status: 0, neededByUtc: '2026-09-29T16:00:00Z', note: 'Sanitized fixture', decisionReason: null, creatorDisplayName: 'Taylor Staff', createdAtUtc: now, updatedAtUtc: now, inventoryTotalUnits: 3, inventoryReservedUnits: 0, inventoryAvailableUnits: 3 };
const request = { id: guid, bloodNeedId: guid, requestingFacilityId: fixtures.FacilityAdmin.facilityId, requestingFacilityName: 'Test Blood Centre', sourceFacilityId: '33333333-3333-4333-8333-333333333333', sourceFacilityName: 'Sample Regional Hospital', bloodType: 6, unitsRequested: 4, unitsAccepted: null, priority: 2, status: 0, requestNote: 'Sanitized fixture', responseNote: null, createdAtUtc: now, respondedAtUtc: null, fulfilledAtUtc: null };
const bloodTypes = ['APositive', 'ANegative', 'BPositive', 'BNegative', 'ABPositive', 'ABNegative', 'OPositive', 'ONegative'];

function fixtureFor(url, role, method = 'GET') {
  const user = fixtures[role];
  const api = new URL(url).pathname;
  if (api.endsWith('/auth/refresh')) return { accessToken: 'fixture-access-token', tokenType: 'Bearer', expiresIn: 300, refreshToken: 'fixture-refresh-token', refreshTokenExpiresAtUtc: '2026-09-30T00:00:00Z', user };
  if (api.endsWith('/auth/me')) return user;
  if (api.endsWith('/dashboard')) return role === 'SystemAdmin'
    ? { pendingFacilities: 1, approvedFacilities: 12, suspendedFacilities: 1, activeRequests: 3, pendingReviews: [{ id: guid, name: facility.name, city: facility.city, region: facility.region }], recentActivity: [] }
    : role === 'FacilityAdmin'
      ? { openNeeds: 1, sentRequests: 2, receivedRequests: 1, lowStockItems: 1, totalInventoryUnits: 40, availableInventoryUnits: 32, unreadNotifications: 1, pendingNeeds: [{ id: guid, bloodType: 'OPositive', unitsNeeded: 4, urgency: 'Emergency', status: 'PendingReview' }], recentActivity: [] }
      : { myOpenNeeds: 1, unreadNotifications: 1, pendingReviewNeeds: 1, searchingNeeds: 0, recentNeeds: [{ id: guid, bloodType: 'OPositive', unitsNeeded: 4, urgency: 'Emergency', status: 'PendingReview' }] };
  if (api.endsWith('/facilities/me')) return { ...facility, status: 1 };
  if (scenario === 'empty' && method === 'GET') {
    if (api.endsWith('/inventory') || api.endsWith('/inventory/low-stock')) return [];
    if (api.endsWith('/timeline')) return [];
    if (['/staff', '/inventory/history', '/inventory/search', '/needs', '/needs/mine', '/requests/sent', '/requests/received', '/notifications'].some(suffix => api.endsWith(suffix)) || api.includes('/system/facilities')) return paged([]);
  }
  if (scenario === 'error' && method === 'GET' && api.endsWith('/inventory')) return { __httpStatus: 500 };
  if (api.includes('/system/facilities/')) return facility;
  if (api.includes('/system/facilities')) return paged([{ ...facility, status: 0 }, { ...facility, id: '44444444-4444-4444-8444-444444444444', name: 'Approved Sample Hospital', status: 1 }, { ...facility, id: '55555555-5555-4555-8555-555555555555', name: 'Rejected Sample Clinic', status: 2 }, { ...facility, id: '66666666-6666-4666-8666-666666666666', name: 'Suspended Sample Centre', status: 3 }]);
  if (api.endsWith('/staff')) return paged([{ userId: 'fixture-staff-user', facilityId: user.facilityId, fullName: 'Taylor Staff', email: 'staff@example.test', status: 1, createdAtUtc: now, deactivatedAtUtc: null, statusReason: null }, { userId: 'fixture-pending-staff', facilityId: user.facilityId, fullName: 'Jordan Pending', email: 'pending@example.test', status: 0, createdAtUtc: now, deactivatedAtUtc: null, statusReason: null }, { userId: 'fixture-inactive-staff', facilityId: user.facilityId, fullName: 'Casey Inactive', email: 'inactive@example.test', status: 2, createdAtUtc: now, deactivatedAtUtc: now, statusReason: 'Sanitized fixture' }]);
  if (api.endsWith('/inventory/low-stock')) return [{ bloodType: 6, availableUnits: 3, lowStockThreshold: 10, updatedAtUtc: now }];
  if (api.endsWith('/inventory/history')) return paged([{ id: guid, bloodType: 6, transactionType: 0, totalUnitsChange: 4, reservedUnitsChange: 0, totalBefore: 0, reservedBefore: 0, totalAfter: 4, reservedAfter: 0, reason: 'Sanitized fixture', referenceType: null, referenceId: null, actorDisplayName: 'Sam Admin', createdAtUtc: now }]);
  if (api.endsWith('/inventory/search')) return paged([{ facilityId: '33333333-3333-4333-8333-333333333333', facilityName: 'Sample Regional Hospital', facilityType: 0, region: 'Ashanti', city: 'Kumasi', bloodType: 6, availableUnits: 8, updatedAtUtc: now }]);
  if (api.endsWith('/inventory')) return bloodTypes.map((_, bloodType) => ({ id: guid, facilityId: user.facilityId, bloodType, totalUnits: bloodType === 6 ? 4 : bloodType === 0 ? 10 : 0, reservedUnits: bloodType === 6 ? 1 : 0, availableUnits: bloodType === 6 ? 3 : bloodType === 0 ? 10 : 0, lowStockThreshold: 10, updatedAtUtc: now, rowVersion: '' }));
  if (api.includes('/needs/') && api.endsWith('/timeline')) return [{ fromStatus: null, toStatus: 0, actorDisplayName: 'Taylor Staff', note: 'Need created', changedAtUtc: now }];
  if (api.includes('/needs/') && api !== '/api/v1/needs/mine' && api !== '/api/v1/needs') return need;
  if (api.endsWith('/needs/mine') || api.endsWith('/needs')) return paged([0, 1, 2, 3, 4, 5].map((status, index) => ({ ...need, id: index ? `${index}2222222-2222-4222-8222-22222222222${index}` : guid, status, urgency: index % 3, bloodType: index % 8, creatorDisplayName: 'Taylor Staff' })));
  if (api.includes('/requests/') && api.endsWith('/timeline')) return [{ fromStatus: null, toStatus: 0, actorDisplayName: 'Sam Admin', note: 'Request sent', changedAtUtc: now }];
  if (api.includes('/requests/') && !api.endsWith('/sent') && !api.endsWith('/received')) return request;
  if (api.endsWith('/requests/sent') || api.endsWith('/requests/received')) return paged([0, 1, 2, 3, 4].map(status => ({ ...request, status, bloodType: status % 8, priority: status % 3, unitsAccepted: status === 1 ? 3 : null })));
  if (api.endsWith('/notifications/unread-count')) return { count: 1 };
  if (api.endsWith('/notifications')) return paged([{ id: guid, notificationType: 0, title: 'Need requires review', message: 'A sanitized sample need is awaiting review.', isRead: false, createdAtUtc: now, relatedEntityType: 'Need', relatedEntityId: guid }, { id: '44444444-4444-4444-8444-444444444444', notificationType: 1, title: 'Request updated', message: 'A sanitized sample request was updated.', isRead: true, createdAtUtc: now, relatedEntityType: 'Request', relatedEntityId: guid }]);
  return {};
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'bloodlink-chromium-'));
const profile = path.join(tempRoot, 'profile');
const portFile = path.join(profile, 'DevToolsActivePort');
const browser = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore' });
let socket;
let sequence = 0;
const pending = new Map();
const role = process.env.UI_PARITY_ROLE ?? 'FacilityAdmin';
if (!fixtures[role]) throw new Error(`Unknown role: ${role}`);
const scenario = process.env.UI_PARITY_STATE ?? 'populated';

try {
  let devToolsPort;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { devToolsPort = Number((await readFile(portFile, 'utf8')).split('\n')[0]); break; }
    catch { await delay(100); }
  }
  if (!devToolsPort) throw new Error('Chromium did not expose its local DevTools endpoint.');
  const targets = await fetch(`http://127.0.0.1:${devToolsPort}/json/list`).then(response => response.json());
  const target = targets.find(item => item.type === 'page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await once(socket, 'open');
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === 'Fetch.requestPaused') void respond(message.params);
  });

  function command(method, params = {}) {
    const id = ++sequence;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 15000);
      pending.set(id, result => { clearTimeout(timer); result.error ? reject(new Error(result.error.message)) : resolve(result.result); });
    });
  }

  async function respond(request) {
    const url = request.request.url;
    const apiPath = new URL(url).pathname;
    const headers = [
      { name: 'Access-Control-Allow-Origin', value: origin },
      { name: 'Access-Control-Allow-Credentials', value: 'true' },
      { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' },
      { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,OPTIONS' },
      { name: 'Vary', value: 'Origin' },
      { name: 'Content-Type', value: 'application/json' }
    ];
    const response = request.request.method === 'OPTIONS' ? null : fixtureFor(url, role, request.request.method);
    const isConflict = scenario === 'conflict' && request.request.method === 'POST' && new RegExp(`/needs/${guid}/cancel$`).test(apiPath);
    const status = request.request.method === 'OPTIONS' ? 204 : isConflict ? 409 : response?.__httpStatus ?? 200;
    const body = request.request.method === 'OPTIONS' ? '' : JSON.stringify(isConflict ? {} : response);
    await command('Fetch.fulfillRequest', { requestId: request.requestId, responseCode: status, responseHeaders: headers, body: Buffer.from(body).toString('base64') });
  }

  await command('Page.enable');
  await command('Runtime.enable');
  await command('Log.enable');
  await command('Network.enable');
  await command('Fetch.enable', { patterns: [{ urlPattern: '*execute-api.eu-north-1.amazonaws.com/api/v1/*', requestStage: 'Request' }] });
  await command('Page.addScriptToEvaluateOnNewDocument', { source: "sessionStorage.setItem('bloodlink.refresh', 'fixture-refresh-token');" });
  const errors = [];
  const failedAssets = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error'
      && !(scenario === 'error' && message.params.entry.text.includes('500 (Internal Server Error)'))
      && !(scenario === 'conflict' && message.params.entry.text.includes('409 (Conflict)'))) errors.push(message.params.entry.text);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400 && !message.params.response.url.includes('execute-api.eu-north-1.amazonaws.com'))
      failedAssets.push(`${message.params.response.status} ${message.params.response.url}`);
    if (message.method === 'Network.loadingFailed' && !message.params.canceled)
      failedAssets.push(`${message.params.errorText} ${message.params.requestId}`);
  });

  const sizes = [[375, 667], [768, 1024], [1440, 900], [1920, 1080]];
  const routes = role === 'SystemAdmin'
    ? ['/dashboard', '/system/facilities', `/system/facilities/${guid}`, '/account/manage', '/account/change-password']
    : role === 'FacilityAdmin'
      ? ['/dashboard', '/facility/profile', '/facility/staff', '/facility/staff/create', '/inventory', '/inventory/adjust', '/inventory/history', '/inventory/search', '/needs', '/needs/new', '/needs/mine', `/needs/${guid}`, '/requests/sent', '/requests/received', `/requests/${guid}`, '/notifications', '/account/manage', '/account/change-password']
      : ['/dashboard', '/inventory', '/needs/new', '/needs/mine', `/needs/${guid}`, '/notifications', '/account/manage', '/account/change-password'];

  for (const [width, height] of sizes) {
    await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    for (const route of routes) {
      await command('Page.navigate', { url: `${origin}${route}` });
      let value;
      for (let attempt = 0; attempt < 40; attempt++) {
        await delay(250);
        const state = await command('Runtime.evaluate', { expression: `({url:location.href,title:document.title,heading:document.querySelector('h1')?.textContent?.trim(),ready:!document.querySelector('.bl-loading-state'),app:document.querySelector('#app')?.innerText?.slice(0,700),width:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,appWidth:document.querySelector('.bl-app-main')?.getBoundingClientRect().width,contentWidth:document.querySelector('.bl-app-content')?.getBoundingClientRect().width,workspaceWidth:document.querySelector('.bl-workspace-page')?.getBoundingClientRect().width,height:document.documentElement.scrollHeight,overflow:getComputedStyle(document.body).overflow,wraps:[...document.querySelectorAll('.bl-table-wrap')].map(el=>({width:Math.round(el.getBoundingClientRect().width),scrollWidth:el.scrollWidth,overflow:getComputedStyle(el).overflowX})),overflowing:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1&&!el.closest('.bl-table-wrap')).slice(0,8).map(el=>({tag:el.tagName,class:el.className,right:Math.round(el.getBoundingClientRect().right),width:Math.round(el.getBoundingClientRect().width)}))})`, returnByValue: true });
        value = state.result.value;
        if (value.heading && value.ready) break;
      }
      if (!value.heading || value.bodyWidth > width) throw new Error(`${role} ${route} failed at ${width}x${height}: ${JSON.stringify(value)}`);
      if (route === '/dashboard') {
        const navigation = await command('Runtime.evaluate', { expression: `({links:[...document.querySelectorAll('#workspace-navigation a')].map(link=>new URL(link.href).pathname),signout:[...document.querySelectorAll('.bl-nav-signout')].some(button=>button.textContent.toLowerCase().includes('sign out')),role:document.querySelector('.bl-sidebar-user-text span')?.textContent?.trim()})`, returnByValue: true });
        const nav = navigation.result.value;
        const required = role === 'SystemAdmin' ? ['/dashboard', '/system/facilities', '/account/manage'] : role === 'FacilityAdmin' ? ['/dashboard', '/inventory', '/inventory/adjust', '/inventory/history', '/inventory/search', '/needs', '/requests/sent', '/requests/received', '/facility/staff', '/facility/profile', '/notifications', '/account/manage'] : ['/dashboard', '/inventory', '/needs/new', '/needs/mine', '/notifications', '/account/manage'];
        const forbidden = role === 'SystemAdmin' ? ['/inventory', '/facility/staff', '/facility/profile', '/requests/sent', '/notifications'] : role === 'FacilityStaff' ? ['/inventory/adjust', '/inventory/history', '/inventory/search', '/needs', '/requests/sent', '/requests/received', '/facility/staff', '/facility/profile'] : [];
        if (required.some(item => !nav.links.includes(item)) || forbidden.some(item => nav.links.includes(item)) || !nav.signout)
          throw new Error(`${role}: role navigation contract failed: ${JSON.stringify(nav)}`);
      }
      const currentPath = route.split('?')[0];
      if (route !== '/requests/sent' && route !== '/requests/received' && !route.match(/^\/requests\/[0-9a-f-]+$/i)) {
        const active = await command('Runtime.evaluate', { expression: `({any:[...document.querySelectorAll('#workspace-navigation a')].some(link=>link.classList.contains('active')||link.getAttribute('aria-current')==='page'),path:document.querySelector('.bl-sidebar')?.dataset.currentPath,links:[...document.querySelectorAll('#workspace-navigation a')].map(link=>({href:new URL(link.href).pathname,class:link.className,current:link.getAttribute('aria-current')}))})`, returnByValue: true });
        if (!active.result.value.any) throw new Error(`${role} ${currentPath} has no active navigation item: ${JSON.stringify(active.result.value)}`);
      }
      if (width === 375 && route === '/system/facilities') {
        const cards = await command('Runtime.evaluate', { expression: `(()=>{const row=document.querySelector('.bl-record-table tbody tr');return {display:row?getComputedStyle(row).display:null,labels:[...document.querySelectorAll('.bl-record-table tbody td')].every(cell=>cell.hasAttribute('data-label')),body:document.body.scrollWidth,viewport:innerWidth}})()`, returnByValue: true });
        if (!(cards.result.value?.display === 'grid' && cards.result.value.labels && cards.result.value.body <= cards.result.value.viewport)) throw new Error(`${role}: facility mobile records failed: ${JSON.stringify(cards.result.value)}`);
      }
      const scroll = await command('Runtime.evaluate', { expression: `(()=>{const max=document.documentElement.scrollHeight-innerHeight;if(max<=0)return {required:false,works:true,max,body:document.body.scrollHeight};scrollTo({top:max,behavior:'instant'});const works=scrollY>0;const result={required:true,works,max,body:document.body.scrollHeight,scrollY};scrollTo({top:0,behavior:'instant'});return result})()`, returnByValue: true });
      if (!scroll.result.value.works) throw new Error(`${role} ${route} does not vertically scroll at ${width}x${height}: ${JSON.stringify(scroll.result.value)}.`);
      if (scenario === 'populated' && role === 'FacilityAdmin' && route === '/facility/staff' && width === 375) {
        await command('Runtime.evaluate', { expression: `(()=>{const button=document.querySelector('.bl-table button');button?.focus();button?.click()})()` });
        await delay(300);
        const modal = await command('Runtime.evaluate', { expression: `({visible:!!document.querySelector('[role=dialog]'),focus:!!document.querySelector('[role=dialog]')?.contains(document.activeElement)})`, returnByValue: true });
        if (!modal.result.value.visible || !modal.result.value.focus) throw new Error('Confirmation dialog did not open with focus inside.');
        await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await delay(150);
        const restored = await command('Runtime.evaluate', { expression: `({closed:!document.querySelector('[role=dialog]'),focus:document.activeElement?.textContent?.trim()==='Deactivate'})`, returnByValue: true });
        if (!restored.result.value.closed || !restored.result.value.focus) throw new Error('Dialog Escape did not restore focus to its trigger.');
      }
      if (scenario === 'empty' && width === 375 && ['/facility/staff', '/needs', '/requests/sent', '/notifications', '/system/facilities'].includes(route)) {
        const emptyState = await command('Runtime.evaluate', { expression: `document.querySelector('.bl-empty-state,.bl-dash-empty-state')?.textContent?.trim()??''`, returnByValue: true });
        if (!emptyState.result.value) throw new Error(`${role} ${route} did not show the empty state fixture.`);
      }
      if (scenario === 'validation' && role === 'FacilityAdmin' && route === '/facility/staff/create' && width === 375) {
        const valid = await command('Runtime.evaluate', { expression: `document.querySelector('form')?.checkValidity()`, returnByValue: true });
        if (valid.result.value !== false) throw new Error('Staff creation form did not expose native required-field validation.');
      }
      if (scenario === 'error' && route === '/inventory' && width === 375) {
        const failed = await command('Runtime.evaluate', { expression: `document.querySelector('.bl-alert-danger')?.textContent?.includes('could not complete')??false`, returnByValue: true });
        if (!failed.result.value) throw new Error('500 API fixture did not show the route error state.');
      }
      if (scenario === 'conflict' && role === 'FacilityAdmin' && route === `/needs/${guid}` && width === 375) {
        await command('Runtime.evaluate', { expression: `[...document.querySelectorAll('.bl-workflow-actions button')].find(button=>button.textContent.trim()==='Cancel need')?.click()` });
        await delay(150);
        await command('Runtime.evaluate', { expression: `document.querySelector('.bl-modal .bl-btn-danger')?.click()` });
        await delay(600);
        const conflict = await command('Runtime.evaluate', { expression: `({message:document.querySelector('.bl-alert-danger')?.textContent?.trim(),dialog:!!document.querySelector('[role=dialog]'),buttons:[...document.querySelectorAll('.bl-workflow-actions button')].map(button=>({text:button.textContent,disabled:button.disabled}))})`, returnByValue: true });
        if (!conflict.result.value.message?.includes('current status prevents')) throw new Error(`409 API fixture did not show the conflict/retry state: ${JSON.stringify(conflict.result.value)}`);
      }
      if (width === 375 && route === '/dashboard') {
        await command('Runtime.evaluate', { expression: `document.querySelector('.bl-sidebar-toggle')?.click()` });
        const open = await command('Runtime.evaluate', { expression: `document.querySelector('.bl-sidebar-toggle')?.getAttribute('aria-expanded')`, returnByValue: true });
        if (open.result.value !== 'true') throw new Error(`${role}: mobile navigation failed to open.`);
        await command('Runtime.evaluate', { expression: `document.querySelector('.bl-sidebar-toggle')?.focus()` });
        await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        const closed = await command('Runtime.evaluate', { expression: `({open:document.querySelector('.bl-sidebar-toggle')?.getAttribute('aria-expanded'),focus:document.activeElement===document.querySelector('.bl-sidebar-toggle')})`, returnByValue: true });
        if (closed.result.value.open !== 'false' || !closed.result.value.focus) throw new Error(`${role}: Escape did not close mobile navigation and return focus.`);
      }
      if ([375, 1440].includes(width) && ['/dashboard', '/inventory', '/notifications', '/facility/staff', '/system/facilities'].includes(route)) {
        await command('Runtime.evaluate', { expression: `document.activeElement?.blur();document.querySelectorAll('.bl-table-wrap').forEach(table=>table.scrollLeft=0);scrollTo({top:0,behavior:'instant'})` });
        const name = `${role.toLowerCase()}-${route.replaceAll('/', '_') || 'home'}-${width}x${height}.png`;
        const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await import('node:fs/promises').then(fs => fs.writeFile(path.join(output, name), Buffer.from(shot.data, 'base64')));
      }
    }
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
  if (failedAssets.length) throw new Error(`Failed browser requests: ${failedAssets.join(' | ')}`);
  console.log(`${role} (${scenario}): ${routes.length} authenticated routes passed at four viewport sizes; scroll, navigation, dialogs, assets and API requests were fixture-intercepted.`);
} finally {
  socket?.close();
  if (browser.exitCode === null) {
    const exited = once(browser, 'exit').catch(() => {});
    browser.kill();
    await exited;
  }
  if (path.resolve(tempRoot).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(tempRoot).startsWith('bloodlink-chromium-'))
    await rm(tempRoot, { recursive: true, force: true });
}
