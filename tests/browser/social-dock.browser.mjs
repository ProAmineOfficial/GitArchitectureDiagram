// Project: Git Architecture Diagram | Browser tests: the Pro_Amine social dock (links, glass, magnification, a11y, widths).
// Run with: npm run test:browser. No network: the page is served by the real server, and nothing is fetched elsewhere.
import test from 'node:test'; import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import '../support/no-autostart.mjs';
import { createAppServer } from '../../server.mjs';

const EXPECTED = [
  ['telegram', 'Telegram', 'https://t.me/+tPVAK6lS7eZmODg0'],
  ['tiktok', 'TikTok', 'https://www.tiktok.com/@pro_amine.llc'],
  ['youtube', 'YouTube', 'https://www.youtube.com/c/AMINESAOUD'],
  ['facebook', 'Facebook', 'https://www.facebook.com/AmineSAOUD0'],
  ['instagram', 'Instagram', 'https://instagram.com/pro_amine.llc'],
  ['github', 'GitHub', 'https://github.com/ProAmineOfficial'],
  ['x', 'X', 'https://x.com/pro_amine_tech'],
  ['linkedin', 'LinkedIn', 'https://www.linkedin.com/company/pro-amine-llc/'],
];
const TEST_GLYPH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>'; // A neutral test shape, not a platform glyph.
const server = createAppServer({ fetchImpl: async () => new Response('{}', { status: 404 }) });
let base; let browser; const errors = [];
test.before(async () => { await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`; browser = await chromium.launch(); });
test.after(async () => { await browser?.close(); server.close(); });
async function open({ viewport = { width: 1440, height: 900 }, reducedMotion = 'no-preference', theme = 'dark', route } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion }); const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(value => { try { localStorage.setItem('gad-theme', value); } catch { /* Default theme. */ } }, theme);
  if (route) await route(page);
  await page.goto(base + '/'); await page.waitForSelector('#welcome:not([hidden])'); await page.locator('.social-dock').scrollIntoViewIfNeeded(); await page.waitForTimeout(250);
  return page;
}
const scaleOf = transform => { if (!transform || transform === 'none') return 1; const values = transform.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number); return values ? Math.hypot(values[0], values[1]) : 1; };
const liftOf = transform => { const values = transform?.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number); return values ? values[5] : 0; };
const transforms = page => page.$$eval('.social-link', links => links.map(link => getComputedStyle(link).transform));
// Wait for a CSS transform transition to settle instead of sleeping a fixed time; slow CI machines can start transitions late.
const settleScale = (page, selector, expected) => page.waitForFunction(({ selector, expected }) => { const transform = getComputedStyle(document.querySelector(selector)).transform; const values = transform && transform !== 'none' ? transform.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number) : null; const scale = values ? Math.hypot(values[0], values[1]) : 1; return Math.abs(scale - expected) < 0.005; }, { selector, expected }, { timeout: 5000 });
// Wait until a computed style property reaches an exact value (for example a tooltip's opacity after its 200 ms fade).
const settleStyle = (page, selector, property, expected) => page.waitForFunction(({ selector, property, expected }) => getComputedStyle(document.querySelector(selector))[property] === expected, { selector, property, expected }, { timeout: 5000 });

test('exactly eight links, in order, with the exact URLs, new-tab safety, and accessible names', async () => {
  const page = await open();
  const links = await page.$$eval('.footer-social .social-link', anchors => anchors.map(anchor => ({ network: anchor.dataset.network, href: anchor.getAttribute('href'), target: anchor.target, rel: anchor.rel, label: anchor.getAttribute('aria-label'), tip: anchor.querySelector('.social-tip')?.textContent, glyph: Boolean(anchor.querySelector('.social-glyph')), mono: anchor.querySelector('.social-mono')?.textContent })));
  assert.equal(links.length, 8);
  assert.deepEqual(links.map(link => [link.network, link.tip, link.href]), EXPECTED);
  for (const link of links) { assert.equal(link.target, '_blank'); assert.equal(link.rel, 'noopener noreferrer'); assert.equal(link.label, `Pro_Amine LLC on ${link.tip}`); assert.ok(link.glyph && link.mono, `${link.network} has a glyph slot and a monogram`); }
  assert.equal(await page.locator('#site-footer [data-icon^="social-"]').count(), 0, 'no generic social icon remains');
  assert.equal((await page.textContent('.social-dock-label')).trim(), 'Follow Pro_Amine');
  assert.equal(await page.locator('.eco-card .footer-nav + .social-dock, .eco-card nav + .social-dock').count(), 1, 'the dock sits under the navigation links in the ecosystem card');
  const prevented = await page.evaluate(() => { const link = document.querySelector('.social-link[data-network=github]'); let result = null; const spy = event => { result = event.defaultPrevented; event.preventDefault(); }; window.addEventListener('click', spy); link.click(); window.removeEventListener('click', spy); return result; });
  assert.equal(prevented, false, 'the application router never intercepts a social link');
  const foreign = await page.evaluate(() => [...document.querySelectorAll('script[src], link[href], img[src]')].map(node => node.src || node.href).filter(url => new URL(url, location.href).origin !== location.origin));
  assert.deepEqual(foreign, [], 'no external CDN or remote asset');
  await page.context().close();
});

test('glass buttons magnify like a dock: 1.28 under the pointer, 1.12 and 1.04 for neighbors, with a glass tooltip', async () => {
  const page = await open();
  const size = await page.$eval('.social-link', link => link.getBoundingClientRect().width); assert.equal(Math.round(size), 44);
  const glass = await page.$eval('.social-link', link => { const style = getComputedStyle(link); return { blur: style.backdropFilter || style.webkitBackdropFilter, border: style.borderTopColor, shadow: style.boxShadow, image: style.backgroundImage }; });
  assert.match(glass.blur, /blur\(18px\) saturate\(1\.5\)/); assert.equal(glass.border, 'rgba(255, 255, 255, 0.12)'); assert.match(glass.shadow, /inset/); assert.match(glass.image, /linear-gradient\(145deg/);
  await page.hover('.social-link[data-network=facebook]'); await settleScale(page, '.social-link[data-network=facebook]', 1.28); await settleScale(page, '.social-link[data-network=telegram]', 1);
  const scales = (await transforms(page)).map(scaleOf).map(value => Math.round(value * 100) / 100);
  assert.deepEqual(scales, [1, 1.04, 1.12, 1.28, 1.12, 1.04, 1, 1]);
  const lifts = (await transforms(page)).map(liftOf); assert.equal(Math.round(lifts[3]), -6); assert.equal(Math.round(lifts[2]), -2); assert.equal(Math.round(lifts[0]), 0);
  await settleStyle(page, '.social-link[data-network=facebook] .social-tip', 'opacity', '1'); await settleStyle(page, '.social-link[data-network=x] .social-tip', 'opacity', '0'); // The tooltip fades on its own transition; slower machines can still be mid-fade when the scale has settled.
  assert.equal(await page.$eval('.social-link[data-network=facebook] .social-tip', tip => getComputedStyle(tip).opacity), '1'); assert.equal(await page.$eval('.social-link[data-network=x] .social-tip', tip => getComputedStyle(tip).opacity), '0');
  assert.match(await page.$eval('.social-link', link => getComputedStyle(link).transition), /220ms cubic-bezier\(0\.22, 1, 0\.36, 1\)|0\.22s cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
  await page.mouse.move(5, 5); await settleScale(page, '.social-link[data-network=facebook]', 1); await settleScale(page, '.social-link[data-network=instagram]', 1); assert.deepEqual((await transforms(page)).map(scaleOf).map(Math.round), [1, 1, 1, 1, 1, 1, 1, 1], 'leaving the dock restores every item');
  await page.keyboard.press('Tab'); await page.focus('.social-link[data-network=github]'); await settleScale(page, '.social-link[data-network=github]', 1.28);
  const focus = await page.$eval('.social-link[data-network=github]', link => { const style = getComputedStyle(link); return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor, offset: style.outlineOffset }; });
  assert.deepEqual(focus, { width: '2px', style: 'solid', color: 'rgba(135, 170, 255, 0.8)', offset: '3px' });
  assert.equal(Math.round(scaleOf((await transforms(page))[5]) * 100) / 100, 1.28, 'keyboard focus gets the same emphasis');
  await page.context().close();
});

test('dark graphite glass with silver glyphs, and frosted white glass with graphite glyphs in the light theme', async () => {
  const dark = await open(); const darkStyle = await dark.$eval('.social-link', link => ({ color: getComputedStyle(link).color, background: getComputedStyle(link).backgroundImage })); await dark.context().close();
  const light = await open({ theme: 'light' }); const lightStyle = await light.$eval('.social-link', link => ({ color: getComputedStyle(link).color, background: getComputedStyle(link).backgroundColor, border: getComputedStyle(link).borderTopColor }));
  assert.equal(darkStyle.color, 'rgb(215, 220, 228)'); assert.match(darkStyle.background, /rgba\(255, 255, 255, 0\.1\)/);
  assert.equal(lightStyle.color, 'rgb(31, 41, 55)'); assert.equal(lightStyle.background, 'rgba(255, 255, 255, 0.55)'); assert.equal(lightStyle.border, 'rgba(255, 255, 255, 0.72)');
  await light.context().close();
});

test('reduced motion turns magnification off', async () => {
  const page = await open({ reducedMotion: 'reduce' });
  await page.hover('.social-link[data-network=facebook]'); await page.waitForTimeout(300);
  assert.deepEqual((await transforms(page)).map(transform => transform === 'none' ? 1 : scaleOf(transform)), [1, 1, 1, 1, 1, 1, 1, 1]);
  await page.context().close();
});

test('mobile: 40 px buttons in a horizontal snap row with a hidden scrollbar and no page overflow; tablet: one centered row', async () => {
  const phone = await open({ viewport: { width: 390, height: 844 } });
  const row = await phone.$eval('.footer-social', list => { const style = getComputedStyle(list); return { size: list.querySelector('.social-link').getBoundingClientRect().width, snap: style.scrollSnapType, overflow: style.overflowX, scrollbar: style.scrollbarWidth, inside: list.getBoundingClientRect().right <= list.closest('.footer-card').getBoundingClientRect().right + 0.5 }; });
  assert.equal(Math.round(row.size), 40); assert.match(row.snap, /x mandatory/); assert.equal(row.overflow, 'auto'); assert.equal(row.scrollbar, 'none'); assert.ok(row.inside);
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal page overflow at 390 px');
  const reach = await phone.$eval('.footer-social', list => { const edge = () => list.getBoundingClientRect(); const start = list.firstElementChild.getBoundingClientRect().left >= edge().left; list.scrollLeft = list.scrollWidth; const end = list.lastElementChild.getBoundingClientRect().right <= edge().right + 1; return { start, end }; });
  assert.deepEqual(reach, { start: true, end: true }, 'every button can be reached: nothing overflows to the left');
  await phone.context().close();
  const tablet = await open({ viewport: { width: 820, height: 1180 } });
  const tops = await tablet.$$eval('.footer-social > li', items => [...new Set(items.map(item => Math.round(item.getBoundingClientRect().top)))]); assert.equal(tops.length, 1, 'one row on a tablet');
  assert.ok(await tablet.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)); await tablet.context().close();
  for (const width of [1181, 1280, 1366, 1920]) { const page = await open({ viewport: { width, height: 900 } }); assert.ok(await page.evaluate(() => { const list = document.querySelector('.footer-social'); const card = list.closest('.footer-card').getBoundingClientRect(); return [...list.children].every(item => { const box = item.getBoundingClientRect(); return box.left >= card.left && box.right <= card.right; }); }), `the dock stays inside its card at ${width}px`); await page.context().close(); }
});

test('an official glyph listed in glyphs.json replaces the monogram; unlisted networks keep theirs', async () => {
  const page = await open({ route: async target => { await target.route('**/assets/brand/social/glyphs.json', route => route.fulfill({ json: { version: 1, glyphs: { github: 'github.svg' } } })); await target.route('**/assets/brand/social/github.svg', route => route.fulfill({ body: TEST_GLYPH, contentType: 'image/svg+xml' })); } });
  await page.waitForSelector('.social-link[data-network=github].has-glyph');
  const github = await page.$eval('.social-link[data-network=github]', link => ({ glyph: getComputedStyle(link.querySelector('.social-glyph')).display, mono: getComputedStyle(link.querySelector('.social-mono')).display, mask: getComputedStyle(link.querySelector('.social-glyph')).maskImage || getComputedStyle(link.querySelector('.social-glyph')).webkitMaskImage }));
  assert.deepEqual([github.glyph, github.mono], ['block', 'none']); assert.match(github.mask, /\/assets\/brand\/social\/github\.svg/);
  assert.notEqual(await page.$eval('.social-link[data-network=x] .social-mono', mono => getComputedStyle(mono).display), 'none');
  await page.context().close();
});

test('no uncaught page errors in the social dock', () => { assert.deepEqual(errors, []); });
