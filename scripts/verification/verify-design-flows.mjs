import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { installDesignFixtures, requireLocal, recordId, facilityId } from './local-design-fixtures.mjs';

const base = process.env.BLOODLINK_LOCAL_URL ?? 'http://127.0.0.1:5274';
requireLocal(base);
const browser = await chromium.launch();
const evidence = new URL('../../artifacts/ui-parity/visual-makeover-2026-10-04/', import.meta.url);
mkdirSync(evidence, { recursive: true });
const results = [];
try {
    for (const scheme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width: 390, height: 900 }, colorScheme: scheme });
        const fixture = await installDesignFixtures(context, base, 'FacilityAdmin', { restore: false });
        const page = await context.newPage();
        page.on('pageerror', error => console.error(`Browser exception: ${error.message}`));
        const go = async route => {
            await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
            try { await page.locator('main h1').first().waitFor(); }
            catch (error) { throw new Error(`${route} at ${page.url()}: ${(await page.locator('body').innerText()).slice(0, 1000)}; ${error.message}`); }
        };
        const success = () => page.locator('.bl-alert-success').waitFor();
        const confirm = async (name = 'Continue') => { await page.getByRole('dialog').getByRole('button', { name, exact: true }).click(); };
        await go('/account/login');
        await page.getByLabel('Email', { exact: true }).fill('ama@example.test');
        await page.getByLabel('Password', { exact: true }).fill('LocalPass123!');
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();
        await page.waitForURL('**/dashboard');
        await go('/inventory/adjust');
        await page.getByLabel('Change in total units').fill('8');
        await page.getByLabel('Reason', { exact: true }).fill('Local presentation verification');
        await page.getByRole('button', { name: 'Adjust inventory', exact: true }).click(); await success();
        await go('/inventory/search');
        await page.getByRole('button', { name: 'Search facilities' }).click();
        await page.locator('.bl-record-table').waitFor();
        await go('/needs/new');
        await page.getByLabel('Units needed').fill('4');
        await page.getByLabel('Needed by (your local time)').fill('2030-10-04T20:00');
        await page.getByRole('button', { name: 'Submit need' }).click();
        await page.waitForURL(`**/needs/${recordId}`);
        await page.getByRole('button', { name: 'Start network search' }).click(); await success();
        await page.getByRole('link', { name: 'Request externally' }).click();
        await page.getByLabel('Units requested', { exact: true }).fill('4');
        await page.getByRole('button', { name: 'Send request', exact: true }).click();
        await page.waitForURL(`**/requests/${recordId}`);
        await page.getByRole('button', { name: 'Accept full request' }).click();
        await page.getByRole('button', { name: 'Confirm handover', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Confirm handover', exact: true }).click();
        await confirm('Confirm handover');
        await page.locator('.bl-request-final-state').waitFor();
        fixture.state.requestStatus = 0;
        await go(`/requests/${recordId}`);
        assert(await page.getByRole('button', { name: 'Reject request' }).isDisabled());
        await page.getByLabel('Rejection reason').fill('Local fixture stock allocated.');
        await page.getByRole('button', { name: 'Reject request' }).click();
        await page.locator('.bl-request-final-state').waitFor();
        for (const status of [0, 1]) {
            fixture.state.requestStatus = status;
            await go(`/requests/${recordId}`);
            await page.getByText('More actions', { exact: true }).click();
            await page.getByRole('button', { name: 'Cancel request', exact: true }).click(); await confirm();
            await page.locator('.bl-request-final-state').waitFor();
        }
        fixture.state.needStatus = 0;
        await go(`/needs/${recordId}`);
        await page.getByRole('button', { name: 'Fulfil internally', exact: true }).click(); await success();
        fixture.state.needStatus = 0;
        await go(`/needs/${recordId}`);
        await page.getByRole('button', { name: 'Reject', exact: true }).click(); await confirm(); await success();
        fixture.state.needStatus = 1;
        await go(`/needs/${recordId}`);
        await page.getByRole('button', { name: 'Cancel need', exact: true }).click(); await confirm(); await success();
        await go('/facility/profile');
        await page.getByLabel('Address', { exact: false }).fill('Updated local fixture address');
        await page.getByRole('button', { name: 'Save profile' }).click(); await success();
        await go('/facility/staff/create');
        for (const [selector, value] of [['#staff-first-name', 'Kojo'], ['#staff-last-name', 'Asante'], ['#staff-email', 'kojo@example.test'], ['#staff-password', 'LocalPass123!']]) await page.locator(selector).fill(value);
        await page.getByRole('button', { name: 'Create staff account' }).click();
        await page.waitForURL('**/facility/staff');
        await page.getByRole('button', { name: 'Deactivate', exact: true }).click(); await confirm(); await success();
        await page.getByRole('button', { name: 'Activate', exact: true }).click(); await success();
        await go('/notifications');
        await page.getByRole('button', { name: 'Mark all as read' }).click(); await success();
        await page.getByRole('button', { name: 'Sign out', exact: true }).click();
        await page.waitForURL('**/account/login**');
        await go('/dashboard');
        assert.equal(new URL(page.url()).pathname, '/account/login');
        const expected = ['/auth/login', '/inventory/adjustments', '/needs', `/needs/${recordId}/start-search`, '/requests', `/requests/${recordId}/accept`, `/requests/${recordId}/fulfil`, `/requests/${recordId}/reject`, `/requests/${recordId}/cancel`, `/needs/${recordId}/fulfil-internally`, `/needs/${recordId}/reject`, `/needs/${recordId}/cancel`, '/facilities/me', '/staff', '/staff/local-staff/deactivate', '/staff/local-staff/activate', '/notifications/read-all', '/auth/logout'];
        for (const path of expected) assert(fixture.calls.some(c => c.path === path && ['POST', 'PUT'].includes(c.method)), `Missing action ${path}`);
        assert.equal(fixture.calls.find(c => c.path.endsWith('/accept')).body.unitsAccepted, 4);
        results.push({ scheme, role: 'FacilityAdmin', actions: expected, payloadChecks: 'full request accepted; existing routes and verbs', result: 'pass' });
        await context.close();

        const systemContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
        const system = await installDesignFixtures(systemContext, base, 'SystemAdmin');
        const systemPage = await systemContext.newPage();
        await systemPage.goto(`${base}/system/facilities/${facilityId}`, { waitUntil: 'networkidle' });
        await systemPage.getByLabel('Suspension reason').fill('Local design verification');
        await systemPage.getByRole('button', { name: 'Suspend', exact: true }).click();
        await systemPage.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click();
        await systemPage.getByRole('button', { name: 'Unsuspend', exact: true }).click();
        await systemPage.getByRole('button', { name: 'Suspend', exact: true }).waitFor();
        assert.equal(system.state.facilityStatus, 1);
        results.push({ scheme, role: 'SystemAdmin', actions: ['suspend with confirmation', 'restore'], result: 'pass' });
        await systemContext.close();
        console.log(`PASS: ${scheme} local operational submissions, lifecycle actions and auth transitions`);
    }
    writeFileSync(new URL('functional-flows.json', evidence), JSON.stringify({ base, productionRequests: 0, results }, null, 2));
} finally { await browser.close(); }
