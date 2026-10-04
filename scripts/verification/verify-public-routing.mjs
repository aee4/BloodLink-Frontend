import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const base = process.env.PUBLIC_BASE_URL ?? 'http://127.0.0.1:5081';
const baseline = process.env.PUBLIC_BASELINE_URL;
for (const address of [base, baseline].filter(Boolean)) {
    if (!['localhost', '127.0.0.1'].includes(new URL(address).hostname)) throw new Error('Local verification only.');
}
const output = new URL('../../artifacts/ui-parity/public-routing-2026-10-04/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [], visuals = [], errors = [];
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const pathOf = page => new URL(page.url()).pathname + new URL(page.url()).hash;
const routes = ['/', '/about', '/account/login', '/facility/register', '/facilities/register', '/#how-it-works', '/#features', '/#how'];
const expectedActive = route => route.startsWith('/#') ? '/' : route === '/facilities/register' ? '/facility/register' : route;
const ready = async page => {
    await page.locator('.bl-public-header').waitFor();
    await page.locator('h1').waitFor();
    await page.waitForTimeout(350);
};
async function record(page, width, scenario, route) {
    await ready(page);
    assert(pathOf(page) === route, `${scenario}: ${pathOf(page)} !== ${route}`);
    if (route.includes('#')) await page.waitForFunction(() => {
        const id = location.hash.slice(1);
        const target = document.getElementById(id === 'how' ? 'how-it-works' : id);
        const top = target?.getBoundingClientRect().top;
        const bottom = document.querySelector('.bl-public-header').getBoundingClientRect().bottom;
        return top >= bottom - 1 && top < bottom + 120;
    }, null, { timeout: 5000 });
    const state = await page.evaluate(() => {
        const visible = e => e.getClientRects().length > 0;
        const mobile = visible(document.querySelector('.bl-menu-toggle'));
        const active = [...document.querySelectorAll(mobile ? '#public-mobile-menu a[aria-current=page]' : '.bl-desktop-nav a[aria-current=page], .bl-header-actions a[aria-current=page]')].map(e => e.getAttribute('href'));
        const id = location.hash.slice(1);
        const section = document.getElementById(id === 'how' ? 'how-it-works' : id);
        return { url: location.pathname + location.hash, active, scrollY,
            section: section?.id ?? null, sectionTop: section?.getBoundingClientRect().top ?? null,
            headerBottom: document.querySelector('.bl-public-header').getBoundingClientRect().bottom,
            menuOpen: document.querySelector('.bl-menu-toggle').getAttribute('aria-expanded'),
            focus: document.activeElement?.tagName, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert(JSON.stringify(state.active) === JSON.stringify([expectedActive(route)]), `${scenario}: active ${JSON.stringify(state.active)}`);
    assert(state.menuOpen === 'false', `${scenario}: menu stayed open`);
    assert(!state.overflow, `${scenario}: overflow`);
    if (route.includes('#')) assert(state.sectionTop >= state.headerBottom - 1 && state.sectionTop < state.headerBottom + 120, `${scenario}: section obscured/offscreen ${JSON.stringify(state)}`);
    results.push({ width, scenario, ...state });
    await writeFile(new URL('verification-summary.json', output), JSON.stringify({ base, baseline, results, visuals, errors }, null, 2));
    console.log(`${width}: ${scenario} ${route}`);
}
async function primary(page, destination, keyboard = false) {
    const mobile = await page.locator('.bl-menu-toggle').isVisible();
    if (mobile) {
        await page.locator('.bl-menu-toggle').click();
        await page.waitForFunction(() => document.querySelector('.bl-menu-toggle').getAttribute('aria-expanded') === 'true');
    }
    const link = page.locator(`${mobile ? '#public-mobile-menu' : '.bl-public-header'} a[href="${destination}"]`).filter({ visible: true }).first();
    if (keyboard) { await link.focus(); await page.keyboard.press('Enter'); }
    else await link.click();
    await ready(page);
}
try {
    for (const width of [375, 768, 1440, 1920]) {
        const context = await browser.newContext({ viewport: { width, height: 1000 } });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(`${width}: ${error.message}`));
        page.on('console', message => { if (message.type() === 'error') errors.push(`${width}: ${message.text()}`); });
        page.on('requestfailed', request => { if (!request.failure()?.errorText?.includes('ERR_ABORTED')) errors.push(`${width}: ${request.url()}`); });
        page.on('response', response => { if (response.status() >= 400) errors.push(`${width}: ${response.status()} ${response.url()}`); });
        for (const route of routes) {
            await page.goto('about:blank');
            assert((await page.goto(base + route)).status() === 200, `Direct route ${route}`);
            await record(page, width, 'direct', route);
            await page.reload();
            await record(page, width, 'refresh', route);
        }
        await page.goto(base); await ready(page);
        await primary(page, '/about', true); await record(page, width, 'A-about', '/about');
        await primary(page, '/account/login'); await record(page, width, 'A-login', '/account/login');
        await page.goBack(); await record(page, width, 'A-back-about', '/about');
        await page.goBack(); await record(page, width, 'A-back-home', '/');
        await page.goForward(); await record(page, width, 'A-forward-about', '/about');
        const historyBefore = await page.evaluate(() => history.length);
        await primary(page, '/#how-it-works'); await record(page, width, 'cross-route-fragment', '/#how-it-works');
        assert(await page.evaluate(() => history.length) === historyBefore, 'Fragment scroll added unexpected history entries after replacing forward entry');
        await page.goBack(); await record(page, width, 'fragment-back-about', '/about');
        await page.goForward(); await record(page, width, 'fragment-forward-home', '/#how-it-works');
        await primary(page, '/'); await record(page, width, 'B-home', '/');
        const historyHome = await page.evaluate(() => history.length);
        await primary(page, '/#how-it-works', true); await record(page, width, 'B-same-home-fragment', '/#how-it-works');
        assert(await page.evaluate(() => history.length) === historyHome + 1, 'Same-page fragment should add exactly one entry');
        await primary(page, '/#how-it-works'); await record(page, width, 'repeat-fragment', '/#how-it-works');
        assert(await page.evaluate(() => history.length) === historyHome + 1, 'Repeated fragment added history');
        await page.goto(base + '/account/login'); await ready(page);
        await page.locator('.bl-login-links a[href="/facility/register"]').click(); await record(page, width, 'C-register', '/facility/register');
        await primary(page, '/about'); await record(page, width, 'C-about', '/about');
        for (const href of ['/about', '/account/login', '/facility/register', '/#features', '/#how-it-works']) {
            await page.locator(`.bl-footer a[href="${href}"]`).click();
            await record(page, width, 'footer', href);
        }
        if (await page.locator('.bl-menu-toggle').isVisible()) {
            await page.locator('.bl-menu-toggle').click();
            await page.locator('#public-mobile-menu a[href="/about"]').focus();
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => document.querySelector('.bl-menu-toggle').getAttribute('aria-expanded') === 'false');
            assert(await page.locator('.bl-menu-toggle').evaluate(e => e === document.activeElement), 'Escape focus not restored');
            await primary(page, '/facility/register'); await record(page, width, 'mobile-register', '/facility/register');
        }
        // Real anchors preserve browser modified-click behavior.
        await page.goto(base + '/about'); await ready(page);
        const popupEvent = context.waitForEvent('page');
        await page.locator('.bl-public-brand').first().click({ modifiers: ['Control'] });
        const popup = await popupEvent; await ready(popup);
        assert(pathOf(popup) === '/' && pathOf(page) === '/about', 'Ctrl-click changed source route');
        await popup.close();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await primary(page, '/#how-it-works'); await record(page, width, 'reduced-motion', '/#how-it-works');
        assert(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior) === 'auto', 'Reduced motion not honored');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        for (const route of ['/', '/about', '/account/login', '/facility/register']) {
            await page.goto(base + route); await ready(page); await page.mouse.move(0, 0);
            const name = `${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}-${width}`;
            const screenshot = await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), fullPage: true, animations: 'disabled' });
            if (route === '/account/login' && width <= 768) {
                const center = await page.locator('.bl-auth-panel').evaluate(e => { const b = e.getBoundingClientRect(); return b.x + b.width / 2; });
                assert(Math.abs(center - width / 2) <= 1, 'Mobile login centering changed');
            }
            if (baseline) {
                const before = await context.newPage();
                await before.goto(baseline + route); await ready(before);
                const original = await before.screenshot({ path: fileURLToPath(new URL(`${name}-baseline.png`, output)), fullPage: true, animations: 'disabled' });
                const hash = buffer => createHash('sha256').update(buffer).digest('hex');
                const unchanged = hash(original) === hash(screenshot);
                visuals.push({ width, route, unchanged });
                assert(unchanged, `Visual regression: ${route} at ${width}`);
                await before.close();
            }
        }
        await context.close();
    }
    assert(!errors.length, JSON.stringify(errors));
    console.log(JSON.stringify({ checks: results.length, visualComparisons: visuals.length, errors }, null, 2));
} finally {
    await writeFile(new URL('verification-summary.json', output), JSON.stringify({ base, baseline, results, visuals, errors }, null, 2));
    await browser.close();
}
