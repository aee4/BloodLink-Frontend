import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installDesignFixtures, requireLocal, recordId, facilityId } from './local-design-fixtures.mjs';

const base = process.env.BLOODLINK_LOCAL_URL ?? 'http://127.0.0.1:5274';
requireLocal(base);
const widths = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1700, 1920];
const output = new URL('../../artifacts/ui-parity/structural-public-2026-10-04/design-system/', import.meta.url);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const checks = [], accessibility = [], flows = [], errors = [];
const screenshotWidths = [320, 768, 1440];
async function checkPage(page, route, width, scheme, role) {
    await page.setViewportSize({ width, height: 900 });
    if (page.url() === 'about:blank') await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    else {
        await page.evaluate(href => {
            const link = document.createElement('a'); link.href = href;
            document.body.append(link); link.click(); link.remove();
        }, route);
        await page.waitForURL(`${base}${route}`);
    }
    const heading = ({ '/': 'A clearer way to coordinate blood supply.', '/how-it-works': 'From shortage to fulfilment, in one workflow.', '/features': 'Practical tools.Connected work.', '/about': 'Built to make blood coordination clearer.', '/account/login': 'Sign in', '/facility/register': 'Register your facility', '/facilities/register': 'Register your facility', '/dashboard': 'Dashboard', '/inventory': 'Inventory', '/inventory/adjust': 'Adjust inventory', '/inventory/history': 'Inventory history', '/inventory/search': 'Find blood availability', '/needs': 'Facility needs', '/needs/new': 'Submit a need', '/needs/mine': 'My needs', '/requests/sent': 'Requests sent', '/requests/received': 'Requests received', '/facility/profile': 'Facility profile', '/facility/staff': 'Staff', '/facility/staff/create': 'Staff', '/notifications': 'Notifications', '/activity': 'Activity', '/account/manage': 'Account', '/account/change-password': 'Change password' })[route] ?? (route.startsWith('/system/') ? 'Facility governance' : route.startsWith('/needs/') ? 'Need details' : 'Request details');
    await page.waitForFunction(({ route, heading }) => location.pathname === route && document.querySelector('main h1')?.textContent.trim().replace(/\s+/g, ' ') === heading && !document.querySelector('.bl-loading-state'), { route, heading });
    const geometry = await page.evaluate(() => {
        const visible = el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
        const controls = [...document.querySelectorAll('main button, main input, main select, main textarea, main a.bl-btn')].filter(visible);
        return { viewport: innerWidth, document: document.documentElement.scrollWidth,
            clipped: controls.filter(el => { const r = el.getBoundingClientRect(); return r.x < -1 || r.right > innerWidth + 1; }).map(el => el.textContent || el.tagName),
            narrow: controls.filter(el => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && el.getBoundingClientRect().width < 120).map(el => el.tagName),
            text: getComputedStyle(document.body).color, surface: getComputedStyle(document.querySelector('.bl-auth-panel,.bl-card,.bl-panel,.bl-public-header') ?? document.body).backgroundColor,
            invalidIcons: [...document.querySelectorAll('svg.bl-icon')].filter(el => !el.children.length).length,
            headings: [...document.querySelectorAll('main h1')].length };
    });
    assert(geometry.document <= width, `${role} ${scheme} ${route} ${width}px overflow`);
    assert.equal(geometry.clipped.length, 0, `Clipped controls ${route}: ${geometry.clipped}`);
    assert.equal(geometry.narrow.length, 0, `Narrow fields ${route}`);
    assert.equal(geometry.invalidIcons, 0, `Unresolved icons ${route}`);
    assert.equal(geometry.headings, 1, `Page title hierarchy ${route}`);
    if (scheme === 'dark' && role !== 'public') assert.notEqual(geometry.surface, 'rgb(255, 255, 255)', `Light-only surface ${route}`);
    checks.push({ route, width, scheme, role, ...geometry });
    if (screenshotWidths.includes(width)) {
        const name = `${role}-${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}-${scheme}-${width}`;
        await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), fullPage: true });
        if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: fileURLToPath(new URL('./node_modules/axe-core/axe.min.js', import.meta.url)) });
        const result = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
        accessibility.push({ route, width, scheme, role, violations: result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
        writeFileSync(new URL('accessibility-progress.json', output), JSON.stringify(accessibility, null, 2));
    }
}
function watch(page) {
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/500 \(Internal Server Error\)|401 \(Unauthorized\)/.test(m.text())) errors.push(m.text()); });
}
try {
    for (const scheme of ['light', 'dark']) {
        const publicContext = await browser.newContext({ colorScheme: scheme, timezoneId: 'Africa/Accra' });
        await installDesignFixtures(publicContext, base, 'FacilityAdmin', { restore: false });
        const page = await publicContext.newPage(); watch(page);
        for (const width of widths) for (const route of ['/', '/about', '/how-it-works', '/features', '/account/login', '/facility/register', '/facilities/register']) await checkPage(page, route, width, scheme, 'public');
        console.log(`PASS: ${scheme} public pages across ${widths.length} widths`);
        await publicContext.close();
        for (const role of ['FacilityAdmin', 'FacilityStaff', 'SystemAdmin']) {
            const context = await browser.newContext({ colorScheme: scheme, timezoneId: 'Africa/Accra' });
            const fixture = await installDesignFixtures(context, base, role);
            const page = await context.newPage(); watch(page);
            const routes = role === 'SystemAdmin' ? ['/dashboard', '/system/facilities', `/system/facilities/${facilityId}`, '/activity', '/account/manage', '/account/change-password']
                : role === 'FacilityStaff' ? ['/dashboard', '/inventory', '/needs/new', '/needs/mine', `/needs/${recordId}`, '/notifications', '/account/manage', '/account/change-password']
                    : ['/dashboard', '/inventory', '/inventory/adjust', '/inventory/history', '/inventory/search', '/needs', '/needs/new', `/needs/${recordId}`, '/requests/sent', '/requests/received', `/requests/${recordId}`, '/facility/profile', '/facility/staff', '/facility/staff/create', '/notifications', '/activity', '/account/manage', '/account/change-password'];
            for (const width of widths) for (const route of routes) await checkPage(page, route, width, scheme, role);
            fixture.state.empty = true;
            for (const route of role === 'SystemAdmin' ? ['/system/facilities', '/activity', '/dashboard'] : role === 'FacilityStaff' ? ['/needs/mine', '/notifications', '/dashboard'] : ['/needs', '/requests/received', '/facility/staff', '/activity', '/dashboard']) await checkPage(page, route, 320, scheme, `${role}-empty`);
            fixture.state.empty = false; fixture.state.error = true;
            await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
            await page.locator('.bl-alert-danger').waitFor();
            fixture.state.error = false;
            await page.getByRole('button', { name: 'Refresh', exact: true }).click();
            await page.locator('.bl-stat-card').first().waitFor();
            flows.push({ scheme, role, errorAndRefresh: 'pass', emptyStates: 'pass' });
            console.log(`PASS: ${scheme} ${role} geometry, empty/error states and refresh`);
            await context.close();
        }
    }
    // Actions are exercised against local fixtures and the original API payloads are recorded.
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const fixture = await installDesignFixtures(context, base, 'FacilityAdmin', { restore: false });
    const page = await context.newPage(); watch(page);
    await page.goto(`${base}/account/login`, { waitUntil: 'networkidle' });
    await page.getByLabel('Email', { exact: true }).fill('ama@example.test');
    await page.getByLabel('Password', { exact: true }).fill('LocalPass123!');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/dashboard');
    await page.goto(`${base}/inventory/adjust`, { waitUntil: 'networkidle' });
    await page.getByLabel('Change in total units').fill('8');
    await page.getByLabel('Reason', { exact: true }).fill('Local presentation verification');
    await page.getByRole('button', { name: 'Adjust inventory', exact: true }).click();
    await page.locator('.bl-alert-success').waitFor();
    await page.goto(`${base}/requests/${recordId}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Accept full request' }).click();
    await page.getByRole('button', { name: 'Confirm handover', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Confirm handover', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm handover', exact: true }).click();
    await page.locator('.bl-request-final-state').waitFor();
    fixture.state.requestStatus = 0;
    await page.goto(`${base}/requests/${recordId}`, { waitUntil: 'networkidle' });
    assert(await page.getByRole('button', { name: 'Reject request' }).isDisabled());
    await page.getByLabel('Rejection reason').fill('Local fixture stock allocated.');
    await page.getByRole('button', { name: 'Reject request' }).click();
    await page.locator('.bl-request-final-state').waitFor();
    fixture.state.requestStatus = 1;
    await page.goto(`${base}/requests/${recordId}`, { waitUntil: 'networkidle' });
    await page.getByText('More actions', { exact: true }).click();
    await page.getByRole('button', { name: 'Cancel request', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click();
    await page.locator('.bl-request-final-state').waitFor();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.waitForURL('**/account/login**');
    await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForURL('**/account/login**');
    for (const suffix of ['/auth/login', '/inventory/adjustments', `/requests/${recordId}/accept`, `/requests/${recordId}/fulfil`, `/requests/${recordId}/reject`, `/requests/${recordId}/cancel`, '/auth/logout']) assert(fixture.calls.some(c => c.path === suffix && c.method === 'POST'), `Missing action ${suffix}`);
    const accepted = fixture.calls.find(c => c.path.endsWith('/accept'));
    assert.equal(accepted.body.unitsAccepted, 4);
    flows.push({ actions: 'login, adjust, accept full amount, handover, reject with required reason, cancel, logout, protected route', result: 'pass', requests: fixture.calls.filter(c => c.method !== 'GET').map(({ path, method }) => ({ path, method })) });
    await context.close();
    const report = { base, widths, themes: ['light', 'dark'], checks: checks.length, accessibility, flows, errors, approvedBaselines: false };
    writeFileSync(new URL('design-verification.json', output), JSON.stringify(report, null, 2));
    const violations = accessibility.filter(a => a.violations.length);
    assert.equal(errors.length, 0, errors.join('\n'));
    assert.equal(violations.length, 0, `Accessibility violations: ${JSON.stringify(violations.slice(0, 4))}`);
    console.log(`PASS: ${checks.length} geometry/theme checks, ${accessibility.length} WCAG audits, ${flows.length} flow scenarios; no production requests.`);
} finally { await browser.close(); }
