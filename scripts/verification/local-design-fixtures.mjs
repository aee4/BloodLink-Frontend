import { readFileSync } from 'node:fs';

export const apiOrigin = new URL(JSON.parse(readFileSync(new URL('../../src/BloodLink.Web/wwwroot/appsettings.json', import.meta.url))).Api.BaseUrl).origin;
export const recordId = '00000000-0000-0000-0000-000000000001';
export const facilityId = '00000000-0000-0000-0000-000000000050';
const date = '2026-10-04T08:00:00Z';
const paged = items => ({ items, pageNumber: 1, pageSize: 25, hasNext: false });
export function requireLocal(base) {
    if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Design fixtures require a local frontend.');
}

// These fixtures intercept every configured API request. No production data is read or written.
export async function installDesignFixtures(context, base, role = 'FacilityAdmin', { restore = true } = {}) {
    requireLocal(base);
    if (restore) await context.addInitScript(() => sessionStorage.setItem('bloodlink.refresh', 'local-design-refresh'));
    const calls = [];
    const state = { needStatus: 0, requestStatus: 0, facilityStatus: 1, staffStatus: 1, empty: false, error: false, delay: 0, loggedOut: false };
    const user = { id: 'local-design-user', firstName: 'Ama', lastName: 'Mensah', email: 'ama@example.test', roles: [role], facilityId: role === 'SystemAdmin' ? null : facilityId, facilityStatus: role === 'SystemAdmin' ? null : 1, mustChangePassword: false };
    const facility = () => ({ id: facilityId, name: 'Accra Regional Hospital', facilityType: 0, registrationNumber: 'LOCAL-CLINICAL-001', region: 'Greater Accra', city: 'Accra', address: 'Hospital Road, Accra', contactEmail: 'hospital@example.test', contactPhone: '0200000000', status: state.facilityStatus, createdAtUtc: date });
    const need = () => ({ id: recordId, facilityId, facilityName: facility().name, bloodType: 6, unitsNeeded: 4, urgency: 2, status: state.needStatus, neededByUtc: '2030-10-04T20:00:00Z', creatorDisplayName: 'Ama Mensah', createdAtUtc: date, updatedAtUtc: date, note: 'Emergency department coordination.', inventoryTotalUnits: 32, inventoryReservedUnits: 4, inventoryAvailableUnits: 28 });
    const request = () => ({ id: recordId, bloodNeedId: recordId, requestingFacilityId: '00000000-0000-0000-0000-000000000060', requestingFacilityName: 'Tema General Hospital', sourceFacilityId: facilityId, sourceFacilityName: facility().name, bloodType: 6, unitsRequested: 4, unitsAccepted: state.requestStatus === 1 || state.requestStatus === 3 ? 4 : null, priority: 2, status: state.requestStatus, responseNote: state.requestStatus === 2 ? 'Stock allocated to local emergency care.' : null, createdAtUtc: date, fulfilledAtUtc: state.requestStatus === 3 ? date : null });
    const stock = Array.from({ length: 8 }, (_, bloodType) => ({ id: recordId, facilityId, bloodType, totalUnits: bloodType === 7 ? 4 : 32, reservedUnits: bloodType === 7 ? 0 : 4, availableUnits: bloodType === 7 ? 4 : 28, lowStockThreshold: 10, updatedAtUtc: date, rowVersion: '' }));
    const token = () => ({ accessToken: 'local-design-access', tokenType: 'Bearer', expiresIn: 3600, refreshToken: 'local-design-refresh', refreshTokenExpiresAtUtc: '2030-01-01T00:00:00Z', user });
    await context.route(`${apiOrigin}/**`, async route => {
        const req = route.request();
        const url = new URL(req.url());
        const path = url.pathname.replace('/api/v1', '');
        const method = req.method();
        const headers = { 'Access-Control-Allow-Origin': new URL(base).origin, 'Access-Control-Allow-Headers': 'authorization,content-type,x-bloodlink-suppress-session-expired', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Content-Type': 'application/json' };
        if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
        calls.push({ path, method, query: url.search, body: req.postDataJSON() });
        if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
        let body;
        if (path === '/auth/login') { state.loggedOut = false; body = token(); }
        else if (path === '/auth/refresh') {
            if (state.loggedOut) return route.fulfill({ status: 401, headers, body: JSON.stringify({ message: 'Local session ended.' }) });
            body = token();
        }
        else if (path === '/auth/me') body = user;
        else if (path === '/auth/logout' || path === '/auth/change-password') { state.loggedOut = true; return route.fulfill({ status: 204, headers }); }
        else if (path === '/notifications/unread-count') body = { count: 0 };
        else if (path === '/facilities/register') body = facility();
        else if (path === '/facilities/me') body = facility();
        else if (path.endsWith('/suspend')) { state.facilityStatus = 3; body = facility(); }
        else if (path.endsWith('/restore')) { state.facilityStatus = 1; body = facility(); }
        else if (path === '/system/facilities') body = paged(state.empty ? [] : [facility()]);
        else if (path.startsWith('/system/facilities/')) body = facility();
        else if (path === '/dashboard') body = { activeFacilities: 12, suspendedFacilities: 1, totalFacilities: 13, activeRequests: 6, openNeeds: 3, sentRequests: 5, receivedRequests: 2, lowStockItems: 1, totalInventoryUnits: 228, availableInventoryUnits: 200, unreadNotifications: 0, myOpenNeeds: 3, pendingReviewNeeds: 1, searchingNeeds: 2, pendingNeeds: state.empty ? [] : [need()], recentNeeds: state.empty ? [] : [need()], recentActivity: state.empty ? [] : [{ action: 'InventoryAdjusted', summary: 'O+ inventory updated by Ama Mensah.', createdAtUtc: date }] };
        else if (path === '/inventory') body = state.empty ? [] : stock;
        else if (path === '/inventory/low-stock') body = state.empty ? [] : [{ bloodType: 7, availableUnits: 4, lowStockThreshold: 10 }];
        else if (path === '/inventory/history') body = paged(state.empty ? [] : [{ id: recordId, bloodType: 6, totalUnitsChange: 8, totalAfter: 32, reservedAfter: 4, reason: 'Morning stock reconciliation.', actorDisplayName: 'Ama Mensah', createdAtUtc: date }]);
        else if (path === '/inventory/search') body = paged(state.empty ? [] : [{ facilityId: '00000000-0000-0000-0000-000000000060', facilityName: 'Tema General Hospital', facilityType: 0, bloodType: 6, availableUnits: 28, city: 'Tema', region: 'Greater Accra', updatedAtUtc: date }]);
        else if (path === '/inventory/adjustments') body = stock[6];
        else if (path === '/needs' && method === 'POST') body = need();
        else if (path === '/needs' || path === '/needs/mine') body = paged(state.empty ? [] : [need()]);
        else if (path.endsWith('/timeline')) body = [{ fromStatus: null, toStatus: path.startsWith('/requests/') ? state.requestStatus : state.needStatus, actorDisplayName: 'Ama Mensah', note: 'Recorded in the facility workspace.', changedAtUtc: date }];
        else if (path.startsWith('/needs/')) {
            if (path.endsWith('/start-search') || path.endsWith('/search')) state.needStatus = 1;
            if (path.endsWith('/fulfil-internally')) state.needStatus = 2;
            if (path.endsWith('/reject')) state.needStatus = 4;
            if (path.endsWith('/cancel')) state.needStatus = 5;
            body = need();
        }
        else if (path === '/requests/sent' || path === '/requests/received') body = paged(state.empty ? [] : [request()]);
        else if (path.startsWith('/requests/')) {
            if (path.endsWith('/accept')) state.requestStatus = 1;
            if (path.endsWith('/reject')) state.requestStatus = 2;
            if (path.endsWith('/fulfil')) state.requestStatus = 3;
            if (path.endsWith('/cancel')) state.requestStatus = 4;
            body = request();
        }
        else if (path === '/requests') body = request();
        else if (path === '/staff') body = method === 'GET' ? paged(state.empty ? [] : [{ userId: 'local-staff', facilityId, fullName: 'Kojo Asante', email: 'kojo@example.test', status: state.staffStatus, createdAtUtc: date }]) : { userId: 'local-staff', facilityId, fullName: 'Kojo Asante', status: 1, createdAtUtc: date };
        else if (path.startsWith('/staff/')) { state.staffStatus = path.endsWith('/activate') ? 1 : 2; return route.fulfill({ status: 204, headers }); }
        else if (path === '/activity') body = paged(state.empty ? [] : [{ action: 'InventoryAdjusted', summary: 'O+ inventory updated by Ama Mensah.', createdAtUtc: date }]);
        else if (path === '/notifications') body = paged([]);
        else if (path.startsWith('/notifications/')) return route.fulfill({ status: 204, headers });
        else throw new Error(`Unmocked local design API: ${method} ${path}`);
        if (state.error && !path.startsWith('/auth/') && !path.startsWith('/notifications')) return route.fulfill({ status: 500, headers, body: JSON.stringify({ title: 'Local verification error', detail: 'The local fixture is intentionally unavailable.' }) });
        await route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
    });
    // Also stop unexpected external requests; app assets and imagery must be served locally.
    await context.route('**/*', async route => {
        const origin = new URL(route.request().url()).origin;
        if (origin === new URL(base).origin || origin === apiOrigin) return route.fallback();
        throw new Error(`Unexpected external request: ${origin}`);
    });
    return { calls, state, user };
}
