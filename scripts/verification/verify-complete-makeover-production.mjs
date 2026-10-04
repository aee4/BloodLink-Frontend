import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = 'https://d2z1pcfp95dfwd.cloudfront.net';
const output = new URL('../../artifacts/ui-parity/complete-makeover-deployment-2026-10-04/production/', import.meta.url);
mkdirSync(output, {recursive:true});
const routes = [
    ['/', 'home', 'A clearer way to coordinate blood supply.'],
    ['/about', 'about', 'Built to make blood coordination clearer.'],
    ['/how-it-works', 'how-it-works', 'From shortage to fulfilment, in one workflow.'],
    ['/features', 'features', 'Practical tools.Connected work.'],
    ['/account/login', 'login', 'Sign in'],
    ['/facility/register', 'register', 'Register your facility'],
    ['/facilities/register', 'register-alias', 'Register your facility']
];
const widths = [320,360,375,390,430,768,1440,1700,1920];
const concurrency = Number(process.env.BLOODLINK_PRODUCTION_CONCURRENCY ?? 3);
assert(Number.isInteger(concurrency) && concurrency>=1 && concurrency<=3);
const api = new URL(JSON.parse(readFileSync(new URL('../../src/BloodLink.Web/wwwroot/appsettings.json',import.meta.url),'utf8')).Api.BaseUrl).origin;
const axeSource = readFileSync(new URL('./node_modules/axe-core/axe.min.js',import.meta.url),'utf8');
const browser = await chromium.launch();
const prior = process.env.BLOODLINK_PRODUCTION_RESUME === '1' ? JSON.parse(readFileSync(new URL('browser-verification.json',output),'utf8')) : {};
const checks = prior.checks ?? [], accessibility = prior.accessibility ?? [], navigation = prior.navigation ?? [], screenshots = prior.screenshots ?? [], errors = [], failures = [], apiAttempts = [];
const save = () => writeFileSync(new URL('browser-verification.json',output),JSON.stringify({
    base,widths,checks,accessibility,navigation,screenshots,errors,failures,apiAttempts,
    authenticatedProduction:{status:'NOT VERIFIED',reason:'Secure production credential entry unavailable. No real credentials or production mutations used.'},
    loginSubmission:'Native Enter submit event verified with capture listener preventing API submission; actual auth transport verified locally only.'
},null,2));
async function ready(page,heading) {
    await page.waitForFunction(heading => document.querySelector('main h1')?.textContent.trim().replace(/\s+/g,' ')===heading,heading);
    await page.evaluate(() => Promise.all([document.fonts.ready,...[...document.images].map(img=>{img.loading='eager';return img.decode();})]));
}
async function audit(page,route,width,scheme,state) {
    await page.addScriptTag({url:base+'/__bloodlink-verification/axe.js'});
    const result = await page.evaluate(() => axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
    accessibility.push({route,width,scheme,state,violations:result.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}))});
    assert.equal(result.violations.length,0,JSON.stringify(accessibility.at(-1)));
}
const jobs = [];
for (const scheme of ['light','dark']) for (const width of widths) for (const route of routes)
    if(!checks.some(c=>c.route===route[0] && c.width===width && c.scheme===scheme)) jobs.push({scheme,width,route});
try {
    for (let offset=0;offset<jobs.length;offset+=concurrency) {
        await Promise.all(jobs.slice(offset,offset+concurrency).map(async ({scheme,width,route:[route,name,heading]})=>{
            const context = await browser.newContext({viewport:{width,height:1000},colorScheme:scheme,timezoneId:'Africa/Accra'});
            await context.route(api+'/**', async r => {
                apiAttempts.push({route,width,method:r.request().method(),path:new URL(r.request().url()).pathname});
                await r.abort();
            });
            await context.route(base+'/__bloodlink-verification/axe.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:axeSource}));
            const page = await context.newPage();
            page.on('pageerror',e=>errors.push({route,width,message:e.message}));
            page.on('console',m=>{if(m.type()==='error')errors.push({route,width,message:m.text()});});
            page.on('requestfailed',r=>{if(!r.failure()?.errorText.includes('ERR_ABORTED'))failures.push({route,width,url:r.url(),error:r.failure()?.errorText});});
            page.on('response',r=>{if(r.status()>=400)failures.push({route,width,status:r.status(),url:r.url()});});
            const response = await page.goto(base+route,{waitUntil:'networkidle'});
            assert.equal(response.status(),200);
            await ready(page,heading);
            const hardRefresh = scheme==='light' && width===390;
            if(hardRefresh) {
                assert.equal((await page.reload({waitUntil:'networkidle'})).status(),200);
                await ready(page,heading);
            }
            assert.equal(new URL(page.url()).pathname,route);
            const geometry = await page.evaluate(()=>{
                const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
                return {document:document.documentElement.scrollWidth,viewport:innerWidth,
                    theme:getComputedStyle(document.querySelector('.bl-public-site')).colorScheme,
                    header:rect(document.querySelector('.bl-header-inner')),
                    brokenImages:[...document.images].filter(i=>!i.complete || !i.naturalWidth).map(i=>i.src),
                    unlabelledImages:[...document.images].filter(i=>!i.hasAttribute('alt')).map(i=>i.src),
                    emptyIcons:[...document.querySelectorAll('.bl-icon')].filter(i=>!i.children.length).length,
                    panel:document.querySelector('.bl-auth-panel')?rect(document.querySelector('.bl-auth-panel')):null,
                    form:document.querySelector('.bl-form-page-inner')?rect(document.querySelector('.bl-form-page-inner')):null};
            });
            assert(geometry.document<=width+1,'Horizontal overflow');
            assert.equal(geometry.theme,'light');
            assert.deepEqual(geometry.brokenImages,[]);
            assert.deepEqual(geometry.unlabelledImages,[]);
            assert.equal(geometry.emptyIcons,0);
            if(width>=1700) assert.equal(geometry.header.width,1560);
            if(route==='/') assert.equal(await page.locator('.public-home-image img').getAttribute('src'),'images/bloodlink-lab.webp');
            if(route==='/about') assert.equal(await page.locator('.public-about-story img').getAttribute('src'),'images/bloodlink-team.webp');
            if(route==='/how-it-works') assert.equal(await page.locator('.public-timeline li').count(),8);
            if(route==='/features') assert.equal(await page.locator('.public-feature-family').count(),4);
            const mobile = await page.locator('.bl-menu-toggle').isVisible();
            const activePath = route==='/facilities/register'?'/facility/register':route;
            if(mobile) await page.locator('.bl-menu-toggle').click();
            assert.equal(await page.locator((mobile?'#public-mobile-menu':'.bl-header-inner')+' a[href="'+activePath+'"][aria-current="page"]').count(),1);
            if(mobile) {
                await page.locator('#public-mobile-menu a[href="'+activePath+'"]').focus();
                await page.keyboard.press('Escape');
                assert.equal(await page.locator('.bl-menu-toggle').getAttribute('aria-expanded'),'false');
                assert(await page.locator('.bl-menu-toggle').evaluate(e=>e===document.activeElement));
            }
            await audit(page,route,width,scheme,'initial');
            await page.evaluate(()=>document.activeElement?.blur());
            await page.evaluate(()=>scrollTo(0,0));
            if(scheme==='light' && [390,1700].includes(width) && name!=='register-alias') {
                const file=name+'-'+width+'.png';
                await page.screenshot({path:fileURLToPath(new URL(file,output)),fullPage:true});
                if(!screenshots.includes(file)) screenshots.push(file);
            }
            if(name==='login') {
                const password=page.locator('#login-password'),toggle=page.locator('.bl-login-password-toggle');
                assert.equal(await password.getAttribute('type'),'password');
                assert.equal(await toggle.getAttribute('type'),'button');
                assert.equal(await toggle.getAttribute('aria-label'),'Show password');
                await password.fill('VisualReview123!');
                const rect=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height];};
                const before=await password.evaluate(rect),touch=await toggle.evaluate(rect);
                assert(touch[2]>=44 && touch[3]>=44);
                assert(Math.abs(touch[1]+touch[3]/2-before[1]-before[3]/2)<=1);
                await toggle.click();
                await page.waitForFunction(()=>document.querySelector('#login-password').type==='text');
                assert.equal(await toggle.getAttribute('aria-label'),'Hide password');
                assert.equal(await password.inputValue(),'VisualReview123!');
                assert.deepEqual(await password.evaluate(rect),before);
                await toggle.click();
                await page.waitForFunction(()=>document.querySelector('#login-password').type==='password');
                assert.equal(await toggle.getAttribute('aria-label'),'Show password');
                assert.equal(await password.inputValue(),'VisualReview123!');
                assert.deepEqual(await password.evaluate(rect),before);
                await password.focus();await page.keyboard.press('Tab');
                assert(await toggle.evaluate(e=>e===document.activeElement));
                assert(await toggle.evaluate(e=>getComputedStyle(e).outlineStyle!=='none'));
                await page.keyboard.press('Space');
                await page.waitForFunction(()=>document.querySelector('#login-password').type==='text');
                await page.keyboard.press('Space');
                await page.waitForFunction(()=>document.querySelector('#login-password').type==='password');
                if(width<=768) assert(Math.abs(geometry.panel.x+geometry.panel.width/2-width/2)<=1);
                else assert((await page.locator('.bl-auth-aside').evaluate(e=>getComputedStyle(e).backgroundImage)).includes('bloodlink-lab.webp'));
                await page.locator('input[type=email]').fill('visual-review@example.test');
                await page.evaluate(()=>{
                    window.__reviewSubmitCount=0;
                    window.addEventListener('submit',e=>{
                        if(!e.target.matches('.bl-auth-form')) return;
                        window.__reviewSubmitCount++;e.preventDefault();e.stopImmediatePropagation();
                    },{capture:true});
                });
                await password.press('Enter');
                assert.equal(await page.evaluate(()=>window.__reviewSubmitCount),1);
            } else if(name.startsWith('register')) {
                assert(geometry.form.width<=800);
                assert(Math.abs(geometry.form.x+geometry.form.width/2-width/2)<=1);
                assert.equal(await page.locator('fieldset').count(),2);
                await page.getByRole('button',{name:'Submit registration'}).click();
                await page.locator('#facility-name[aria-invalid=true]').waitFor();
                assert(await page.locator('#facility-name').evaluate(e=>e===document.activeElement));
                await audit(page,route,width,scheme,'validation-errors');
                assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
            }
            if(route==='/' && scheme==='light' && [390,1700].includes(width)) {
                for(const destination of ['/about','/how-it-works','/features','/account/login','/facility/register']) {
                    if(mobile) await page.locator('.bl-menu-toggle').click();
                    await page.locator((mobile?'#public-mobile-menu':'.bl-header-inner')+' a[href="'+destination+'"]').focus();
                    await page.keyboard.press('Enter');
                    await page.waitForURL(base+destination);
                    await ready(page,routes.find(r=>r[0]===destination)[2]);
                    await page.goBack();await page.waitForURL(base+'/');await ready(page,heading);
                    await page.goForward();await page.waitForURL(base+destination);await ready(page,routes.find(r=>r[0]===destination)[2]);
                    await page.locator('.bl-public-header .bl-brand').click();
                    await page.waitForURL(base+'/');await ready(page,heading);
                    navigation.push({width,destination,keyboard:true,history:true,result:'passed'});
                }
            }
            assert.equal(apiAttempts.length,0,'Unexpected API attempt during production visual verification');
            checks.push({route,name,width,scheme,directVisit:true,hardRefresh,result:'passed',geometry});
            await context.close();
        }));
        save();
        console.log('PASS production '+checks.length+'/126');
    }
    const protectedContext = await browser.newContext({viewport:{width:390,height:1000}});
    await protectedContext.route(api+'/**',async r=>{
        apiAttempts.push({route:'/dashboard',method:r.request().method(),path:new URL(r.request().url()).pathname});
        await r.abort();
    });
    const protectedPage = await protectedContext.newPage();
    await protectedPage.goto(base+'/dashboard',{waitUntil:'networkidle'});
    await protectedPage.waitForURL(url=>url.pathname==='/account/login');
    await ready(protectedPage,'Sign in');
    assert.equal(await protectedPage.locator('.bl-workspace-page').count(),0);
    if(!navigation.some(n=>n.route==='/dashboard')) navigation.push({route:'/dashboard',scenario:'anonymous access redirects to sign in',result:'passed'});
    await protectedContext.close();
    assert.equal(errors.length,0,JSON.stringify(errors));
    assert.equal(failures.length,0,JSON.stringify(failures));
    assert.equal(apiAttempts.length,0,'No production API calls may occur during public visual verification');
    assert.equal(checks.length,126);
    console.log('PASS: '+checks.length+' public cases; '+accessibility.length+' accessibility audits; zero errors, failed requests, overflow or API calls.');
} finally {save();await browser.close();}
