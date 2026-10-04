import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const base = process.env.PUBLIC_BASE_URL ?? 'http://localhost:5081';
const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sizes = [[375, 812], [768, 1024], [1440, 1000], [1920, 1080]];
const routes = [
  ['/', 'A clearer way to coordinate'],
  ['/about', 'Built to make blood coordination clearer.'],
  ['/account/login', 'Sign in'],
  ['/facility/register', 'Register your facility'],
];
const root = path.resolve('../..');
const evidence = path.join(root, 'artifacts', 'ui-parity', 'local-public');
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
const errors = [], failures = [];
try {
  for (const [width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${width}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${width}: ${message.text()}`); });
    page.on('requestfailed', request => { if (!request.failure()?.errorText?.includes('ERR_ABORTED')) failures.push(`${width}: ${request.url()}`); });
    page.on('response', response => { if (response.status() >= 400) failures.push(`${width}: HTTP ${response.status()} ${response.url()}`); });
    for (const [route, heading] of routes) {
      const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      if (response?.status() !== 200) throw new Error(`${route} returned ${response?.status()} at ${width}px.`);
      await page.getByRole('heading', { level: 1, name: heading, exact: route === '/account/login' || route === '/facility/register' }).first().waitFor({ state: 'visible' });
      await page.locator('main img').evaluateAll(images => Promise.all(images.map(image => { image.loading = 'eager'; return image.decode(); })));
      const state = await page.evaluate(async () => ({
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
        header: !!document.querySelector('.bl-public-header'),
        footer: !!document.querySelector('.bl-footer'),
        authenticatedShell: !!document.querySelector('.bl-app, .bl-sidebar'),
        image: [...document.images].every(image => image.complete && image.naturalWidth > 0),
        iconLinks: ['favicon.svg', 'favicon-16.png', 'favicon-32.png', 'favicon.ico'].every(name => [...document.querySelectorAll('link[rel*=icon]')].some(link => link.href.endsWith(name))),
        iconSizes: await Promise.all([16, 32].map(size => new Promise(resolve => { const image = new Image(); image.onload = () => resolve(image.naturalWidth === size && image.naturalHeight === size); image.onerror = () => resolve(false); image.src = `/favicon-${size}.png`; }))),
      }));
      if (state.width > state.viewport) throw new Error(`${route} horizontal overflow at ${width}px (${state.width}).`);
      if (!state.header || !state.footer || state.authenticatedShell || !state.image || !state.iconLinks || state.iconSizes.some(valid => !valid)) throw new Error(`${route} shared layout, route access, image, or icon check failed at ${width}px: ${JSON.stringify(state)}.`);
      if (route === '/account/login' && await page.locator('input[autocomplete="username"][required]').count() !== 1) throw new Error('Login required email field changed.');
      if (route === '/facility/register' && await page.locator('#facility-registration-form fieldset').count() < 2) throw new Error('Registration field groups missing.');
      if (width === 375 && route === '/') {
        const toggle = page.locator('.bl-menu-toggle');
        await toggle.focus();
        await page.keyboard.press('Enter');
        if (await toggle.getAttribute('aria-expanded') !== 'true') throw new Error('Mobile menu failed to open by keyboard.');
        await page.keyboard.press('Escape');
        if (await toggle.getAttribute('aria-expanded') !== 'false') throw new Error('Escape did not close mobile menu.');
      }
      await page.screenshot({ path: path.join(evidence, `${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}-${width}.png`), fullPage: route === '/' || route === '/about' });
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const motion = await page.evaluate(() => getComputedStyle(document.querySelector('.bl-public-site .bl-btn')).transitionDuration);
    if (motion !== '1e-05s' && motion !== '0.00001s') throw new Error(`Reduced motion transition not reduced: ${motion}`);
    await context.close();
  }
  if (errors.length || failures.length) throw new Error(JSON.stringify({ errors, failures }, null, 2));
  console.log(JSON.stringify({ base, routes: routes.map(([route]) => route), viewportWidths: sizes.map(([width]) => width), browserErrors: errors.length, failedRequests: failures.length, mobileKeyboardMenu: 'pass', reducedMotion: 'pass', screenshots: evidence }, null, 2));
} finally { await browser.close(); }
