import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const base = process.env.PUBLIC_BASE_URL ?? 'https://d2z1pcfp95dfwd.cloudfront.net';
const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sizes = [[375, 812], [768, 1024], [1440, 1000], [1920, 1080]];
const routes = [
  ['/', 'A clearer way to coordinate'],
  ['/about', 'A shared workspace for coordinated blood supply.'],
  ['/account/login', 'Sign in'],
  ['/facility/register', 'Register your facility'],
  ['/facilities/register', 'Register your facility'],
];

async function navigatePublicRoute(page, route, width) {
  await page.evaluate(() => { window.__publicCls = 0; });
  if (route === '/facilities/register') {
    await page.evaluate(target => {
      const anchor = document.createElement('a');
      anchor.id = 'public-route-alias-probe';
      anchor.href = target;
      anchor.textContent = 'Open registration alias';
      anchor.style.cssText = 'position:fixed;right:1rem;bottom:1rem;z-index:99999;padding:.5rem;background:white;color:#0f2744';
      document.body.append(anchor);
    }, route);
    await page.locator('#public-route-alias-probe').click();
  } else if (width <= 991) {
    await page.locator('.bl-menu-toggle').click();
    await page.locator(`#public-mobile-menu a[href="${route}"]`).click();
  } else if (route === '/about') {
    await page.locator('.bl-desktop-nav a[href="/about"]').click();
  } else if (route === '/account/login') {
    await page.locator('.bl-header-login').click();
  } else if (route === '/facility/register') {
    await page.locator('.bl-header-register').click();
  }
  await page.waitForURL(url => new URL(url).pathname === route, { timeout: 60000 });
  await page.locator('#public-route-alias-probe').evaluateAll(elements => elements.forEach(element => element.remove()));
}
const root = path.resolve('../..');
const evidenceDir = path.join(root, 'artifacts', 'ui-parity', 'production-public-redesign');
await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
const errors = [], failures = [], externalImages = [], results = [];
try {
  let staticAssetsVerified = false;
  const context = await browser.newContext({ viewport: { width: sizes[0][0], height: sizes[0][1] }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  let activeWidth = sizes[0][0];
  await page.addInitScript(() => {
    window.__publicCls = 0;
    new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__publicCls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  page.on('pageerror', error => errors.push(`${activeWidth}: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`${activeWidth}: ${message.text()}`); });
  page.on('requestfailed', request => { if (!request.failure()?.errorText?.includes('ERR_ABORTED')) failures.push(`${activeWidth}: ${request.url()}`); });
  page.on('request', request => { if (request.resourceType() === 'image' && new URL(request.url()).origin !== new URL(base).origin) externalImages.push(`${activeWidth}: ${request.url()}`); });
  page.on('response', response => { if (response.status() >= 400) failures.push(`${activeWidth}: HTTP ${response.status()} ${response.url()}`); });

  for (const [width, height] of sizes) {
    activeWidth = width;
    await page.setViewportSize({ width, height });

    for (const [route, expectedHeading] of routes) {
      let response = null;
      if (route === '/') {
        response = await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        if (response?.status() !== 200) throw new Error(`${route} returned HTTP ${response?.status()}.`);
      } else {
        await navigatePublicRoute(page, route, width);
      }
      await page.locator('.bl-public-header').waitFor({ state: 'visible', timeout: 60000 });
      const heading = page.getByRole('heading', { level: 1, name: expectedHeading, exact: false });
      await heading.waitFor({ state: 'visible' });
      await page.locator('main img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      if (route === '/about' || route === '/account/login' || route.startsWith('/facilit')) {
        const expectedPath = route === '/facilities/register' ? '/facilities/register' : route;
        if (new URL(page.url()).pathname !== expectedPath) throw new Error(`Unexpected route after navigation to ${route}.`);
      }
      const verifyStaticAssets = !staticAssetsVerified;
      const state = await page.evaluate(async verifyAssets => {
        const iconPaths = [...document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')].map(link => new URL(link.href).pathname);
        const required = ['/favicon.svg', '/favicon-16.png', '/favicon-32.png', '/favicon.ico', '/icon-192.png'];
        const iconResults = verifyAssets ? await Promise.all(required.map(async path => {
          const response = await fetch(path, { cache: 'no-store' });
          let dimensions = null;
          if (path.endsWith('.png')) { const image = new Image(); image.src = path; await image.decode(); dimensions = [image.naturalWidth, image.naturalHeight]; }
          if (path.endsWith('.ico')) { const data = new DataView(await response.arrayBuffer()); dimensions = [data.getUint16(0, true), data.getUint16(2, true), data.getUint16(4, true), data.getUint8(6), data.getUint8(7), data.getUint8(22), data.getUint8(23)]; }
          if (path.endsWith('.svg')) { const source = await response.text(); dimensions = [source.includes('#9b1c31'), source.includes('#fff')]; }
          return { path, status: response.status, dimensions };
        })) : [];
        const manifestResponse = verifyAssets ? await fetch('/manifest.webmanifest') : null;
        const manifest = manifestResponse ? await manifestResponse.json() : null;
        const images = [...document.images].map(image => ({ alt: image.alt, complete: image.complete, width: image.naturalWidth, height: image.naturalHeight, loading: image.loading }));
        const h1 = document.querySelector('main h1');
        return {
          viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
          header: !!document.querySelector('.bl-public-header'), footer: !!document.querySelector('.bl-footer'),
          authenticatedShell: !!document.querySelector('.bl-app, .bl-sidebar'),
          heading: h1?.innerText?.trim() ?? '', title: document.title,
          iconPaths, requiredIcons: iconResults, manifestStatus: manifestResponse?.status ?? 200, manifestIcon: manifest?.icons?.[0]?.src ?? 'icon-192.png',
          images, cls: window.__publicCls ?? 0,
          registerAction: [...document.querySelectorAll('a[href="/facility/register"]')].length > 0,
          loginAction: [...document.querySelectorAll('a[href="/account/login"]')].length > 0,
        };
      }, verifyStaticAssets);
      staticAssetsVerified = true;
      if (state.documentWidth > width) throw new Error(`Horizontal overflow on ${route} at ${width}px.`);
      if (!state.header || !state.footer || state.authenticatedShell) throw new Error(`Public shell/access boundary failed on ${route} at ${width}px.`);
      if (!state.iconPaths.length || state.iconPaths.some(path => /blazor|framework/i.test(path))) throw new Error(`Blazor/default favicon reference remains on ${route}.`);
      if (verifyStaticAssets && state.requiredIcons.some(icon => icon.status !== 200)) throw new Error(`Missing favicon asset on ${route}: ${JSON.stringify(state.requiredIcons)}.`);
      if (verifyStaticAssets && (state.requiredIcons.find(icon => icon.path === '/favicon-16.png')?.dimensions?.[0] !== 16 || state.requiredIcons.find(icon => icon.path === '/favicon-32.png')?.dimensions?.[0] !== 32)) throw new Error('PNG favicon dimensions are incorrect.');
      if (verifyStaticAssets && state.requiredIcons.find(icon => icon.path === '/icon-192.png')?.dimensions?.[0] !== 192) throw new Error('192px app icon dimensions are incorrect.');
      const ico = state.requiredIcons.find(icon => icon.path === '/favicon.ico')?.dimensions;
      if (verifyStaticAssets && (!ico || ico[0] !== 0 || ico[1] !== 1 || ico[2] !== 2 || ico[3] !== 16 || ico[4] !== 16 || ico[5] !== 32 || ico[6] !== 32 || state.requiredIcons.find(icon => icon.path === '/favicon.svg')?.dimensions?.some(value => !value))) throw new Error('ICO/SVG BloodLink mark is invalid.');
      if (state.manifestStatus !== 200 || state.manifestIcon !== 'icon-192.png') throw new Error('Manifest icon reference is invalid.');
      if (state.images.some(image => !image.complete || image.width === 0)) throw new Error(`Content image did not load on ${route}: ${JSON.stringify(state.images)}.`);
      if (state.images.some(image => image.alt && (image.width !== 1200 || image.height !== 800))) throw new Error(`Content image dimensions changed: ${JSON.stringify(state.images)}.`);
      if (state.cls > 0.1) throw new Error(`Cumulative layout shift ${state.cls} exceeded 0.1 on ${route} at ${width}px.`);
      if (!state.registerAction || !state.loginAction) throw new Error(`Public calls to action missing on ${route}.`);

      if (route === '/' && width === 1440) {
        const card = page.locator('.bl-feature-card').first();
        await card.hover(); await page.waitForTimeout(250);
        const hoverTransform = await card.evaluate(element => getComputedStyle(element).transform);
        if (hoverTransform === 'none') throw new Error('Feature card hover effect did not run.');
        const button = page.locator('.bl-hero .bl-btn').first();
        await button.hover(); await page.waitForTimeout(200);
        const buttonTransform = await button.evaluate(element => getComputedStyle(element).transform);
        if (buttonTransform === 'none') throw new Error('Button hover effect did not run.');
        const box = await button.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down(); await page.waitForTimeout(40);
        const pressTransform = await button.evaluate(element => getComputedStyle(element).transform);
        await page.mouse.move(4, 4); await page.mouse.up();
        if (pressTransform === buttonTransform || pressTransform === 'none') throw new Error('Button press effect did not run.');
        const navItem = page.locator('.bl-desktop-nav a').first();
        await navItem.hover();
        if (await navItem.evaluate(element => getComputedStyle(element, '::after').transform) === 'matrix(0, 0, 0, 1, 0, 0)') throw new Error('Navigation underline hover did not run.');
        await page.mouse.move(4, 4);
      }
      if (width === 375 && route === '/') {
        const menu = page.locator('.bl-menu-toggle');
        await page.keyboard.press('Shift+Tab');
        if (!(await menu.evaluate(element => element === document.activeElement))) throw new Error('Mobile menu toggle is missing from keyboard navigation.');
        const focusVisible = await menu.evaluate(element => element.matches(':focus-visible') && getComputedStyle(element).outlineStyle !== 'none');
        await page.keyboard.press('Enter');
        if (await menu.getAttribute('aria-expanded') !== 'true' || !(await page.locator('#public-mobile-menu').isVisible())) throw new Error('Mobile menu failed to open by keyboard.');
        await page.keyboard.press('Escape');
        if (await menu.getAttribute('aria-expanded') !== 'false') throw new Error('Escape did not close the mobile menu.');
        if (!focusVisible) throw new Error('Keyboard focus outline is not visible.');
      }
      if (width === 1440 && (route === '/about' || route === '/account/login' || route === '/facility/register')) {
        const current = await page.locator('[aria-current="page"]').count();
        if (current < 1) throw new Error(`Active route is not indicated for ${route}.`);
      }
      const screenshot = path.join(evidenceDir, `${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}-${width}.png`);
      await page.screenshot({ path: screenshot, fullPage: route === '/' || route === '/about' });
      if (route === '/account/login') {
        await page.locator('input[autocomplete="username"]').focus();
        if (await page.locator('input[autocomplete="username"]').getAttribute('type') !== 'email') throw new Error('Login email field changed.');
        await page.locator('.bl-auth-form button[type="submit"]').click();
        if (!(await page.locator('input[autocomplete="username"]').evaluate(element => !element.validity.valid))) throw new Error('Empty login required validation did not run.');
      }
      if (route === '/facility/register') {
        if (await page.locator('#facility-registration-form fieldset').count() < 2 || await page.locator('#facility-type option[value="Hospital"]').count() !== 1 || await page.locator('#facility-type option[value="BloodBank"]').count() !== 1) throw new Error('Registration field groups or facility types are missing.');
        if (await page.locator('input[type="email"]').count() < 2 || await page.locator('input[type="tel"]').count() < 2) throw new Error('Registration email/phone fields are missing.');
        if (await page.locator('.bl-password-checklist li').count() < 4) throw new Error('Registration password checklist is missing.');
        await page.locator('#facility-type').selectOption('Hospital');
        await page.locator('#facility-contact-email').fill('not-an-email');
        if (!(await page.locator('#facility-contact-email').evaluate(element => element.validity.typeMismatch))) throw new Error('Facility email validation changed.');
        await page.locator('#facility-contact-email').fill('');
        await page.getByRole('button', { name: 'Submit registration' }).click();
        await page.locator('.bl-validation-summary[role="alert"]').waitFor({ state: 'visible' });
      }
      results.push({ route, width, cls: state.cls, contentImages: state.images.length, icons: state.requiredIcons.length });
    }

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reducedDuration = await page.locator('.bl-form-page .bl-btn').first().evaluate(element => getComputedStyle(element).transitionDuration);
    if (reducedDuration !== '1e-05s' && reducedDuration !== '0.00001s') throw new Error(`Reduced motion preference not honored: ${reducedDuration}.`);

    await page.evaluate(target => {
      const anchor = document.createElement('a');
      anchor.id = 'protected-route-probe';
      anchor.href = target;
      anchor.textContent = 'Open protected route';
      anchor.style.cssText = 'position:fixed;right:1rem;bottom:1rem;z-index:99999;padding:.5rem;background:white;color:#0f2744';
      document.body.append(anchor);
    }, '/dashboard');
    await page.locator('#protected-route-probe').click();
    await page.waitForURL(url => new URL(url).pathname === '/account/login', { timeout: 60000 });
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor({ state: 'visible' });
    const protectedState = await page.evaluate(() => ({ path: location.pathname, app: !!document.querySelector('.bl-app, .bl-sidebar'), privateText: /Dashboard overview|Facility workspace|System administration/i.test(document.body.innerText) }));
    if (protectedState.app || protectedState.privateText || protectedState.path !== '/account/login') throw new Error(`Protected route boundary failed: ${JSON.stringify(protectedState)}.`);

    const workers = await page.evaluate(async () => ({ registrations: 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0 }));
    if (workers.registrations !== 0) throw new Error(`Unexpected service worker registrations: ${workers.registrations}.`);
    await page.locator('#protected-route-probe').evaluateAll(elements => elements.forEach(element => element.remove()));
  }
  await context.close();
  if (errors.length || failures.length || externalImages.length) throw new Error(JSON.stringify({ errors, failures, externalImages }, null, 2));
  const report = { base, viewports: sizes.map(([width]) => width), routes: routes.map(([route]) => route), checks: results.length, browserErrors: errors.length, failedRequests: failures.length, externalImageRequests: externalImages.length, responsiveOverflow: false, protectedRoute: 'redirected to sign in', mobileKeyboardMenu: 'pass', reducedMotion: 'pass', favicon: 'pass', screenshots: evidenceDir };
  await writeFile(path.join(evidenceDir, 'verification.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
