import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installDesignFixtures, requireLocal, recordId } from './local-design-fixtures.mjs';

const base = process.env.BLOODLINK_LOCAL_URL ?? 'http://127.0.0.1:5284';
requireLocal(base);
const output = new URL('../../artifacts/ui-parity/structural-public-2026-10-04/', import.meta.url);
mkdirSync(output, { recursive: true });
const widths = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1700, 1920];
const routes = [
    ['/', 'home', 'A clearer way to coordinate blood supply.'],
    ['/about', 'about', 'Built to make blood coordination clearer.'],
    ['/how-it-works', 'how-it-works', 'From shortage to fulfilment, in one workflow.'],
    ['/features', 'features', 'Practical tools.Connected work.'],
    ['/account/login', 'login', 'Sign in'],
    ['/facility/register', 'register', 'Register your facility'],
    ['/facilities/register', 'register-alias', 'Register your facility']
];
const browser = await chromium.launch();
const prior = process.env.BLOODLINK_RESUME === '1' ? JSON.parse(readFileSync(new URL('browser-verification.json', output))) : {};
const checks = prior.checks ?? [], accessibility = prior.accessibility ?? [], routing = prior.routing ?? [], screenshots = prior.screenshots ?? [], errors = prior.errors ?? [];
const watch = page => {
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', r => { if (!r.failure()?.errorText?.includes('ERR_ABORTED')) errors.push(r.url()); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
};
const save = () => writeFileSync(new URL('browser-verification.json', output), JSON.stringify({ base, widths, checks, accessibility, routing, screenshots, errors }, null, 2));
async function ready(page, route, heading) {
    await page.waitForURL(base + route);
    await page.waitForFunction(heading => document.querySelector('main h1')?.textContent.trim().replace(/\s+/g, ' ') === heading, heading);
    await page.locator('.bl-public-header').waitFor();
    await page.evaluate(() => Promise.all([...document.images].map(img => { img.loading = 'eager'; return img.decode().catch(() => {}); })));
}
async function primary(page, href) {
    const mobile = await page.locator('.bl-menu-toggle').isVisible();
    if (mobile) await page.locator('.bl-menu-toggle').click();
    const link = page.locator(`${mobile ? '#public-mobile-menu' : '.bl-public-header'} a[href="${href}"]`).filter({ visible: true }).first();
    await link.focus(); await page.keyboard.press('Enter');
    await ready(page, href, routes.find(r => r[0] === href)[2]);
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.bl-menu-toggle').getAttribute('aria-expanded'), 'false');
    const active = page.locator(`${mobile ? '#public-mobile-menu' : '.bl-header-inner'} a[href="${href}"][aria-current="page"]`);
    assert.equal(await active.count(), 1);
}
async function go(page, route) {
    if (page.url() === 'about:blank') await page.goto(base + route, { waitUntil: 'networkidle' });
    else await page.evaluate(href => {
        const link = document.createElement('a'); link.href = href;
        document.body.append(link); link.click(); link.remove();
    }, route);
    await ready(page, route, routes.find(r => r[0] === route)[2]);
}
async function screenshot(page, name) {
    const path = fileURLToPath(new URL(name + '.png', output));
    await page.screenshot({ path, fullPage: true }); screenshots.push({ name, path });
}
try {
    for (const scheme of ['light', 'dark']) {
        const context = await browser.newContext({ colorScheme: scheme, timezoneId: 'Africa/Accra' });
        await installDesignFixtures(context, base, 'FacilityAdmin', { restore: false });
        const page = await context.newPage(); watch(page);
        for (const width of widths) {
            if (routes.every(([route]) => checks.some(c => c.route === route && c.scheme === scheme && c.width === width)) && routing.filter(r => r.scheme === scheme && r.width === width).length === 5) continue;
            await page.setViewportSize({ width, height: 1000 });
            for (const [route, name, heading] of routes) {
                if (checks.some(c => c.route === route && c.scheme === scheme && c.width === width)) continue;
                if (width === widths[0]) {
                    assert.equal((await page.goto(base + route, { waitUntil: 'networkidle' })).status(), 200);
                    await ready(page, route, heading);
                    assert.equal((await page.reload({ waitUntil: 'networkidle' })).status(), 200);
                    await ready(page, route, heading);
                } else await go(page, route);
                const state = await page.evaluate(() => {
                    const visible = e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
                    const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, right: r.right, width: r.width }; };
                    const controls = [...document.querySelectorAll('main input, main select, main textarea, main button, main a.bl-btn')].filter(visible);
                    const header = document.querySelector('.bl-header-inner');
                    const publicSite = document.querySelector('.bl-public-site');
                    return { viewport: innerWidth, document: document.documentElement.scrollWidth,
                        header: rect(header), headerHeight: header.getBoundingClientRect().height,
                        background: getComputedStyle(publicSite).backgroundColor,
                        colorScheme: getComputedStyle(publicSite).colorScheme,
                        titleCount: document.querySelectorAll('main h1').length,
                        clippedControls: controls.filter(e => rect(e).x < -1 || rect(e).right > innerWidth + 1).map(e => e.id || e.textContent),
                        brokenImages: [...document.images].filter(e => !e.naturalWidth).map(e => e.src),
                        emptyIcons: [...document.querySelectorAll('svg.bl-icon')].filter(e => !e.children.length).length,
                        loginPanel: document.querySelector('.bl-auth-panel') ? rect(document.querySelector('.bl-auth-panel')) : null };
                });
                assert(state.document <= width, `${route} ${scheme} ${width}: overflow ${state.document}`);
                assert.equal(state.background, 'rgb(255, 255, 255)');
                assert.equal(state.colorScheme, 'light');
                assert.equal(state.titleCount, 1);
                assert.deepEqual(state.clippedControls, []);
                assert.deepEqual(state.brokenImages, []);
                assert.equal(state.emptyIcons, 0);
                assert(state.headerHeight >= 72 && state.headerHeight <= 80);
                if (width === 1700) { assert.equal(state.header.width, 1560); assert.equal(state.header.x, 70); }
                if (state.loginPanel && width <= 768) {
                    assert(Math.abs(state.loginPanel.x - (width - state.loginPanel.right)) <= 2, 'Login must stay centered');
                    assert(state.loginPanel.width <= 432);
                }
                checks.push({ route, scheme, width, directAndRefresh: width === widths[0] ? 'pass' : 'covered by direct/refresh routing sweep', ...state });
                if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: fileURLToPath(new URL('./node_modules/axe-core/axe.min.js', import.meta.url)) });
                const audit = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
                accessibility.push({ route, scheme, width, violations: audit.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
                if (scheme === 'light' && name !== 'register-alias' && ([390, 1700].includes(width) || (width === 1440 && name === 'home'))) await screenshot(page, `${name}-light-${width}`);
                save();
            }
            await go(page, '/');
            for (const destination of ['/about', '/how-it-works', '/features', '/account/login', '/facility/register']) {
                const prior = new URL(page.url()).pathname;
                await primary(page, destination);
                await page.goBack(); await ready(page, prior, routes.find(r => r[0] === prior)[2]);
                await page.waitForTimeout(350);
                await page.goForward(); await ready(page, destination, routes.find(r => r[0] === destination)[2]);
                await page.waitForTimeout(350);
                routing.push({ width, scheme, destination, keyboardNav: 'pass', active: 'pass', backForward: 'pass' });
            }
            await go(page, '/');
            await page.getByRole('link', { name: 'See how BloodLink works', exact: true }).click(); await page.waitForURL(base + '/how-it-works');
            await go(page, '/');
            await page.getByRole('link', { name: 'Explore all features', exact: true }).click(); await page.waitForURL(base + '/features');
            for (const destination of ['/about', '/how-it-works', '/features', '/account/login', '/facility/register']) {
                await page.locator(`.bl-footer a[href="${destination}"]`).click(); await page.waitForURL(base + destination);
            }
            if (await page.locator('.bl-menu-toggle').isVisible()) {
                await page.locator('.bl-menu-toggle').click();
                await page.locator('#public-mobile-menu a[href="/about"]').focus();
                await page.keyboard.press('Escape');
                assert.equal(await page.locator('.bl-menu-toggle').getAttribute('aria-expanded'), 'false');
                assert(await page.locator('.bl-menu-toggle').evaluate(e => e === document.activeElement));
            }
            console.log(`PASS public ${scheme} ${width}px: all routes, keyboard navigation, history, geometry and axe`);
        }
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await go(page, '/how-it-works');
        assert.equal(await page.locator('.public-text-link').first().evaluate(e => getComputedStyle(e).transitionDuration), '1e-05s');
        await context.close();
        const authContext = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 900 } });
        await installDesignFixtures(authContext, base);
        const authPage = await authContext.newPage(); watch(authPage);
        for (const [route, name] of [['/dashboard', 'dashboard'], ['/inventory', 'inventory'], [`/needs/${recordId}`, 'need-detail'], ['/requests/received', 'requests-received']]) {
            await authPage.goto(base + route, { waitUntil: 'networkidle' }); await authPage.locator('main h1').waitFor();
            assert(await authPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            if (scheme === 'dark') assert.notEqual(await authPage.locator('.bl-sidebar').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(255, 255, 255)');
            await screenshot(authPage, `${name}-${scheme}-1440`);
            await authPage.addScriptTag({ path: fileURLToPath(new URL('./node_modules/axe-core/axe.min.js', import.meta.url)) });
            const audit = await authPage.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
            accessibility.push({ route, scheme, width: 1440, role: 'FacilityAdmin', violations: audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
            save();
        }
        await authContext.close();
    }
    assert.deepEqual(accessibility.filter(a => a.violations.length), [], 'Accessibility violations');
    assert.deepEqual(errors, [], 'Browser errors');
    save(); console.log(`PASS: ${checks.length} public checks; ${accessibility.length} accessibility audits; ${routing.length} history/navigation checks; ${screenshots.length} screenshots`);
} finally { save(); await browser.close(); }
