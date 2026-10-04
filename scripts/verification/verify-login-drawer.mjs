import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = process.env.BLOODLINK_LOCAL_URL ?? 'http://127.0.0.1:5274';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local verification only.');
const config = JSON.parse(readFileSync(new URL('../../src/BloodLink.Web/wwwroot/appsettings.json', import.meta.url)));
const api = new URL(config.Api.BaseUrl).origin;
const output = new URL('../../artifacts/ui-parity/login-drawer-polish/', import.meta.url);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const widths = [320, 360, 375, 390, 430, 768, 1440];
const results = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const errors = [];
const watch = page => {
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', r => { if (!r.failure()?.errorText?.includes('ERR_ABORTED')) errors.push(r.url()); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
};
const noOverflow = async page => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow: ${page.url()}`);
try {
    for (const colorScheme of ['light', 'dark']) {
        const publicContext = await browser.newContext({ colorScheme });
        const login = await publicContext.newPage();
        watch(login);
        let loginCalls = 0;
        await publicContext.route(`${api}/**`, route => { loginCalls++; return route.abort(); });
        for (const width of widths) {
            await login.setViewportSize({ width, height: 900 });
            await login.goto(`${base}/account/login`, { waitUntil: 'networkidle' });
            await login.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
            const layout = await login.evaluate(() => {
                const panel = document.querySelector('.bl-auth-panel').getBoundingClientRect();
                const section = document.querySelector('.bl-auth-content').getBoundingClientRect();
                return { center: panel.x + panel.width / 2, width: panel.width, viewport: innerWidth,
                    above: panel.y - section.y, below: section.bottom - panel.bottom,
                    asideVisible: document.querySelector('.bl-auth-aside').getBoundingClientRect().width > 0 };
            });
            if (width <= 768) {
                assert(Math.abs(layout.center - width / 2) <= 1, 'Login block is not centered');
                assert(layout.width <= 432 && Math.abs(layout.above - layout.below) <= 1, 'Login width/spacing unbalanced');
                assert(!layout.asideVisible, 'Mobile desktop aside visible');
            } else assert(layout.asideVisible, 'Desktop login aside missing');
            for (const text of ['Register a facility', 'Return to home']) assert(await login.getByRole('link', { name: text, exact: true }).isVisible(), `Missing helper: ${text}`);
            const email = login.getByRole('textbox', { name: 'Email', exact: true });
            await email.focus();
            await login.keyboard.press('Tab');
            assert(await login.locator('input[type=password]').evaluate(e => e === document.activeElement), 'Login field focus order');
            await login.keyboard.press('Tab');
            assert(await login.getByRole('button', { name: 'Sign In', exact: true }).evaluate(e => e === document.activeElement), 'Sign in focus order');
            await login.getByRole('button', { name: 'Sign In', exact: true }).click();
            assert(await email.evaluate(e => !e.validity.valid), 'Empty login validation lost');
            assert(loginCalls === 0, 'Invalid login submitted to API');
            await noOverflow(login);
            if ([320, 768, 1440].includes(width)) await login.screenshot({ path: fileURLToPath(new URL(`login-${colorScheme}-${width}.png`, output)), fullPage: true });
            results.push({ screen: 'login', colorScheme, width, ...layout });
        }
        await publicContext.close();

        const context = await browser.newContext({ colorScheme });
        await context.addInitScript(() => sessionStorage.setItem('bloodlink.refresh', 'local-drawer'));
        let logoutCalls = 0;
        const user = { id: 'local-user', firstName: 'Nancy', lastName: 'Drew Senior Facility Administrator', email: 'local@example.test',
            facilityId: '00000000-0000-0000-0000-000000000050', roles: ['FacilityAdmin'], facilityStatus: 1, mustChangePassword: false };
        await context.route(`${api}/**`, async route => {
            const path = new URL(route.request().url()).pathname;
            const headers = { 'Access-Control-Allow-Origin': new URL(base).origin, 'Access-Control-Allow-Headers': 'authorization,content-type,x-bloodlink-suppress-session-expired', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json' };
            if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
            let body;
            if (path.endsWith('/auth/refresh')) body = { accessToken: 'local-access', tokenType: 'Bearer', expiresIn: 3600, refreshToken: 'local-refresh', refreshTokenExpiresAtUtc: '2027-01-01T00:00:00Z', user };
            else if (path.endsWith('/auth/me')) body = user;
            else if (path.endsWith('/facilities/me')) body = { id: user.facilityId, name: 'Accra Regional Hospital and Blood Coordination Centre', status: 1 };
            else if (path.endsWith('/inventory') || path.endsWith('/inventory/low-stock')) body = [];
            else if (path.endsWith('/notifications/unread-count')) body = { count: 0 };
            else if (path.endsWith('/notifications')) body = { items: [], pageNumber: 1, pageSize: 25, hasNext: false };
            else if (path.endsWith('/auth/logout')) { logoutCalls++; return route.fulfill({ status: 204, headers }); }
            else throw new Error(`Unexpected API: ${path}`);
            await route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
        });
        const page = await context.newPage();
        watch(page);
        await page.goto(`${base}/inventory`, { waitUntil: 'networkidle' });
        await page.getByRole('heading', { name: 'Inventory', exact: true }).waitFor();
        for (const width of widths) {
            await page.setViewportSize({ width, height: 900 });
            const mobile = width <= 991;
            await page.waitForFunction(mobile => {
                const account = document.querySelector('.bl-sidebar-user');
                const nav = document.querySelector('#workspace-navigation');
                return !!account && (Boolean(account.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING) === mobile);
            }, mobile);
            assert(await page.locator('.bl-sidebar-user').count() === 1 && await page.getByRole('button', { name: 'Sign out', exact: true }).count() === 1, 'Duplicated account controls');
            if (mobile) {
                const toggle = page.getByRole('button', { name: 'Open navigation menu' });
                await toggle.focus();
                await page.keyboard.press('Enter');
                const account = await page.locator('.bl-sidebar-user').boundingBox();
                const brand = await page.locator('.bl-sidebar-brand').boundingBox();
                const nav = await page.locator('#workspace-navigation').boundingBox();
                assert(account.y >= brand.y + brand.height && nav.y >= account.y + account.height, 'Drawer order/overlap');
                await page.keyboard.press('Tab');
                assert(await page.getByRole('button', { name: 'Sign out', exact: true }).evaluate(e => e === document.activeElement), 'Sign out must precede nav in focus order');
                assert(await page.locator('.bl-nav-signout').evaluate(e => e.matches(':focus-visible') && getComputedStyle(e).outlineStyle !== 'none'), 'Sign out focus style missing');
                await page.keyboard.press('Tab');
                assert(await page.locator('#workspace-navigation a').first().evaluate(e => e === document.activeElement), 'Nav focus must follow Sign out');
                assert(await page.locator('#workspace-navigation a[href="/inventory"]').evaluate(e => e.classList.contains('active')), 'Active navigation lost');
                for (const name of ['Dashboard', 'Inventory', 'Facility needs', 'Requests sent', 'Requests received', 'Staff', 'Account', 'Notifications']) assert(await page.getByRole('link', { name, exact: true }).isVisible(), `Missing nav ${name}`);
                await noOverflow(page);
                if ([320, 768].includes(width)) await page.screenshot({ path: fileURLToPath(new URL(`drawer-${colorScheme}-${width}.png`, output)), fullPage: true });
                await page.keyboard.press('Escape');
                assert(await page.getByRole('button', { name: 'Open navigation menu' }).evaluate(e => e === document.activeElement), 'Escape did not restore toggle focus');
                assert(!await page.locator('#workspace-navigation').isVisible(), 'Escape failed to close');
                await page.getByRole('button', { name: 'Open navigation menu' }).click();
                await page.getByRole('button', { name: 'Close navigation menu' }).click();
                assert(!await page.locator('#workspace-navigation').isVisible(), 'Toggle failed to close');
                await page.getByRole('button', { name: 'Open navigation menu' }).click();
                await page.getByRole('link', { name: 'Inventory', exact: true }).click();
                assert(!await page.locator('#workspace-navigation').isVisible(), 'Navigation click failed to close');
            } else {
                assert(await page.locator('#workspace-navigation').isVisible(), 'Desktop nav hidden');
                assert(!await page.locator('.bl-sidebar-toggle').isVisible(), 'Desktop hamburger visible');
                const account = await page.locator('.bl-sidebar-user').boundingBox();
                const nav = await page.locator('#workspace-navigation').boundingBox();
                assert(account.y >= nav.y + nav.height - 1, 'Desktop account footer moved');
                await page.screenshot({ path: fileURLToPath(new URL(`drawer-${colorScheme}-${width}.png`, output)), fullPage: true });
            }
            await noOverflow(page);
            results.push({ screen: 'drawer', colorScheme, width });
        }
        // Cross the breakpoint with focus on Sign out: keep the single control focused.
        await page.getByRole('button', { name: 'Sign out', exact: true }).focus();
        await page.setViewportSize({ width: 320, height: 900 });
        await page.waitForFunction(() => {
            const account = document.querySelector('.bl-sidebar-user');
            const nav = document.querySelector('#workspace-navigation');
            return Boolean(account?.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING) && document.activeElement?.matches('.bl-nav-signout');
        });
        await page.getByRole('button', { name: 'Sign out', exact: true }).click();
        await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
        assert(logoutCalls === 1, 'Logout request duplicated');
        assert(await page.evaluate(() => !sessionStorage.getItem('bloodlink.refresh')), 'Logout refresh material retained');
        assert(await page.locator('.bl-sidebar').count() === 0, 'Logout shell retained');
        // Logout while the responsive helper import is still in flight.
        let releaseModule;
        const moduleGate = new Promise(resolve => { releaseModule = resolve; });
        await page.route('**/sidebar-layout.js', async route => { await moduleGate; await route.continue(); });
        await page.goto(`${base}/inventory`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Sign out', exact: true }).click();
        await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
        releaseModule();
        await page.waitForLoadState('networkidle');
        assert(logoutCalls === 2 && await page.locator('.bl-sidebar').count() === 0, 'Late helper import interfered with logout');
        results.push({ screen: 'logout-before-helper-load', colorScheme, width: 320 });
        await context.close();
        console.log(`PASS: ${colorScheme} login/drawer across ${widths.join('/')}px; keyboard order, Escape, resize and logout.`);
    }
    assert(errors.length === 0, errors.join('\n'));
    writeFileSync(new URL('results.json', output), JSON.stringify({ checks: results.length, errors, results }, null, 2));
    console.log(`PASS: ${results.length} login/drawer viewport checks; no errors/overflow.`);
} finally { await browser.close(); }
