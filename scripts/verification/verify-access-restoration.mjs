import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { installDesignFixtures, requireLocal } from './local-design-fixtures.mjs';

const base = process.env.BLOODLINK_LOCAL_URL ?? 'http://127.0.0.1:5294';
requireLocal(base);
const output = new URL('../../artifacts/ui-parity/access-restoration-2026-10-04/', import.meta.url);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const prior = process.env.BLOODLINK_RESUME === '1' ? JSON.parse(readFileSync(new URL('browser-verification.json', output))) : {};
const checks = prior.checks ?? [], accessibility = (prior.accessibility ?? []).filter(a => !a.violations.length), screenshots = prior.screenshots ?? [], errors = [];
const box = e => { const r = e.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; };
async function ready(page, route) {
    await page.goto(base + route);
    await page.locator('main h1').waitFor();
    await page.evaluate(() => document.fonts.ready);
}
async function overflow(page) {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow');
}
try {
    if (process.env.BLOODLINK_SCREENSHOTS_ONLY) {
        const jobs = [];
        for (const colorScheme of ['light', 'dark'])
            for (const [route,widths,name] of [['/account/login',[320,360,375,390,430,768,1440,1700],'login'],['/facility/register',[390,768,1440,1700],'register']])
                for (const width of widths) jobs.push({route,width,name,colorScheme});
        for (let i=0; i<jobs.length; i+=4) await Promise.all(jobs.slice(i,i+4).map(async ({route,width,name,colorScheme}) => {
            const context = await browser.newContext({viewport:{width,height:1000},colorScheme});
            await installDesignFixtures(context,base,'FacilityAdmin',{restore:false});
            const page = await context.newPage();
            await ready(page,route);
            const file = name + '-' + colorScheme + '-' + width + '.png';
            await page.screenshot({path:new URL(file,output).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
            if (!screenshots.includes(file)) screenshots.push(file);
            await context.close();
        }));
    }
    if (!process.env.BLOODLINK_SCREENSHOTS_ONLY) for (const colorScheme of ['light', 'dark']) {
        for (const [route, widths, name] of [
            ['/account/login', [320,360,375,390,430,768,1440,1700], 'login'],
            ['/facility/register', [390,768,1440,1700], 'register'],
            ['/facilities/register', [390,768,1440,1700], 'register-alias']
        ]) {
            for (const width of widths) {
                if (checks.some(c => c.route === route && c.width === width && c.colorScheme === colorScheme)) continue;
                const context = await browser.newContext({ viewport: {width, height:1000}, colorScheme });
                const fixture = await installDesignFixtures(context, base, 'FacilityAdmin', {restore:false});
                const page = await context.newPage();
                page.on('pageerror', e => errors.push(e.message));
                await ready(page, route);
                await overflow(page);
                if (name !== 'register-alias') {
                    const file = name + '-' + colorScheme + '-' + width + '.png';
                    await page.screenshot({path:new URL(file,output).pathname.replace(/^\/([A-Za-z]:)/,'$1'), fullPage:true});
                    if (!screenshots.includes(file)) screenshots.push(file);
                }
                assert.equal(await page.locator('.bl-public-site').evaluate(e => getComputedStyle(e).colorScheme), 'light');
                if (name === 'login') {
                    const password = page.locator('#login-password'), toggle = page.locator('.bl-login-password-toggle');
                    assert.equal(await password.getAttribute('type'), 'password');
                    assert.equal(await toggle.getAttribute('type'), 'button');
                    assert.equal(await toggle.getAttribute('aria-label'), 'Show password');
                    await password.fill('Local-test password 123!');
                    const before = await password.evaluate(box);
                    const touch = await toggle.evaluate(box);
                    assert(touch.width >= 44 && touch.height >= 44);
                    assert(Math.abs(touch.y + touch.height / 2 - before.y - before.height / 2) <= 1);
                    await toggle.click();
                    await page.waitForFunction(() => document.querySelector('#login-password').type === 'text');
                    assert.equal(await toggle.getAttribute('aria-label'), 'Hide password');
                    assert.equal(await password.inputValue(), 'Local-test password 123!');
                    assert.deepEqual(await password.evaluate(box), before);
                    await toggle.click();
                    await page.waitForFunction(() => document.querySelector('#login-password').type === 'password');
                    assert.equal(await toggle.getAttribute('aria-label'), 'Show password');
                    assert.equal(await password.inputValue(), 'Local-test password 123!');
                    assert.deepEqual(await password.evaluate(box), before);
                    assert.equal(fixture.calls.filter(c => c.path === '/auth/login').length, 0);
                    const panel = await page.locator('.bl-auth-panel').evaluate(box);
                    const section = await page.locator('.bl-auth-content').evaluate(box);
                    if (width <= 768) {
                        assert(Math.abs(panel.x + panel.width/2 - width/2) <= 1);
                        assert(Math.abs((panel.y-section.y) - (section.y+section.height-panel.y-panel.height)) <= 1);
                        assert(!(await page.locator('.bl-auth-aside').isVisible()));
                    } else {
                        assert(await page.locator('.bl-auth-aside').isVisible());
                        assert((await page.locator('.bl-auth-aside').evaluate(e => getComputedStyle(e).backgroundImage)).includes('bloodlink-lab.webp'));
                    }
                    await password.fill('');
                    await page.getByRole('button', {name:'Sign In', exact:true}).click();
                    assert(await page.locator('input[type=email]').evaluate(e => !e.validity.valid));
                    assert.equal(fixture.calls.filter(c => c.path === '/auth/login').length, 0);
                    await page.locator('input[type=email]').focus();
                    await page.keyboard.press('Tab');
                    assert(await password.evaluate(e => e === document.activeElement));
                    await page.keyboard.press('Tab');
                    assert(await toggle.evaluate(e => e === document.activeElement));
                    assert(await toggle.evaluate(e => getComputedStyle(e).outlineStyle !== 'none'));
                    await page.keyboard.press('Space');
                    await page.waitForFunction(() => document.querySelector('#login-password').type === 'text');
                    await page.keyboard.press('Space');
                    await page.waitForFunction(() => document.querySelector('#login-password').type === 'password');
                    await page.keyboard.press('Tab');
                    assert(await page.getByRole('button', {name:'Sign In',exact:true}).evaluate(e => e === document.activeElement));
                } else {
                    assert.equal(await page.locator('.public-onboarding').count(), 0);
                    const inner = await page.locator('.bl-form-page-inner').evaluate(box);
                    assert(inner.width <= 800 && Math.abs(inner.x + inner.width/2 - width/2) <= 1);
                    assert.equal(await page.locator('fieldset').count(), 2);
                    await page.getByRole('button', {name:'Submit registration'}).click();
                    await page.locator('#facility-name[aria-invalid=true]').waitFor();
                    assert.equal(fixture.calls.filter(c => c.path === '/facilities/register').length, 0);
                    assert(await page.locator('#facility-name').evaluate(e => e === document.activeElement));
                    await overflow(page);
                }
                await page.addScriptTag({path:new URL('node_modules/axe-core/axe.min.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
                const axe = await page.evaluate(() => axe.run(document, {runOnly:{type:'tag', values:['wcag2a','wcag2aa','wcag21aa']}}));
                accessibility.push({route,width,colorScheme,violations:axe.violations.map(v => ({id:v.id, nodes:v.nodes.map(n=>n.target)}))});
                assert.equal(axe.violations.length, 0, JSON.stringify(accessibility.at(-1)));
                if (name === 'login') {
                    await page.locator('input[type=email]').fill('ama@example.test');
                    await page.locator('#login-password').fill('Local-test password 123!');
                    await page.locator('.bl-login-password-toggle').click();
                    await page.locator('#login-password').press('Enter');
                    await page.waitForURL(base + '/dashboard');
                    const login = fixture.calls.filter(c => c.path === '/auth/login');
                    assert.equal(login.length, 1);
                    assert.equal(login[0].body.password, 'Local-test password 123!');
                }
                checks.push({route,width,colorScheme,result:'passed'});
                await context.close();
                console.log(name, width, colorScheme, 'passed');
            }
        }
    }
    assert.equal(errors.length, 0, errors.join('\n'));
} finally {
    writeFileSync(new URL('browser-verification.json', output), JSON.stringify({base,checks,accessibility,screenshots,errors},null,2));
    await browser.close();
}
