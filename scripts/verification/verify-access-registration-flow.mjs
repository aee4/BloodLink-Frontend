import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { installDesignFixtures, requireLocal } from './local-design-fixtures.mjs';
const base = process.env.BLOODLINK_LOCAL_URL ?? 'http://127.0.0.1:5294';
requireLocal(base);
const browser = await chromium.launch();
const checks = [];
try {
    for (const route of ['/facility/register', '/facilities/register']) {
        const context = await browser.newContext({viewport:{width:390,height:1000}});
        const fixture = await installDesignFixtures(context,base,'FacilityAdmin',{restore:false});
        const page = await context.newPage();
        await page.goto(base+route);
        await page.locator('#facility-name').waitFor();
        for (const [id,value] of Object.entries({
            'facility-name':'Local Review Hospital',
            'facility-registration-number':'LOCAL-REVIEW-ONLY',
            'facility-region':'Greater Accra', 'facility-city':'Accra',
            'facility-address':'Local fixture address',
            'facility-contact-email':'facility@example.test', 'facility-contact-phone':'0200000000',
            'admin-first-name':'Ama', 'admin-last-name':'Mensah', 'admin-email':'ama@example.test',
            'admin-phone':'0200000001', 'admin-password':'LocalReview123!'
        })) await page.locator('#'+id).fill(value);
        await page.locator('#facility-type').selectOption('Hospital');
        await page.getByRole('button',{name:'Submit registration'}).click();
        await page.getByRole('heading',{name:'Registration complete',exact:true}).waitFor();
        const calls = fixture.calls.filter(c=>c.path==='/facilities/register');
        assert.equal(calls.length,1);
        assert.equal(calls[0].method,'POST');
        assert.equal(calls[0].body.adminPassword,'LocalReview123!');
        assert.equal(await page.getByRole('link',{name:'Continue to sign in'}).getAttribute('href'),'/account/login');
        checks.push({route,result:'passed',api:'intercepted local fixture only'});
        await context.close();
    }
    console.log(JSON.stringify(checks));
} finally {
    writeFileSync(new URL('../../artifacts/ui-parity/access-restoration-2026-10-04/registration-flow.json',import.meta.url),JSON.stringify(checks,null,2));
    await browser.close();
}
