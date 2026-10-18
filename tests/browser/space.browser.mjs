// Project: Git Architecture Diagram | Browser tests: the decorative space background on the landing pages.
// It renders behind the interface on /, /rep and /new, never on a repository workspace page; it does not take pointer
// events; a pause control toggles the twinkle; prefers-reduced-motion falls back to a still starfield.
import test from 'node:test'; import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import '../support/no-autostart.mjs';
import { createAppServer } from '../../server.mjs';

const server = createAppServer({ fetchImpl: async () => new Response('{}', { status: 404 }) });
let base; let browser;
test.before(async () => { await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`; browser = await chromium.launch(); });
test.after(async () => { await browser?.close(); server.close(); });

async function open(path = '/', { reduceMotion = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reduceMotion ? 'reduce' : 'no-preference' });
  const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + path); return { page, errors };
}

test('the home page runs the space background, draws stars, and never blocks clicks', async () => {
  const { page, errors } = await open('/'); await page.waitForSelector('#welcome:not([hidden])'); await page.waitForTimeout(900);
  assert.ok(await page.evaluate(() => document.body.classList.contains('space-on')), 'body.space-on marks landing pages');
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('space-stars')).pointerEvents), 'none');
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('space-bg')).pointerEvents), 'none');
  const litPixels = await page.evaluate(() => { const c = document.getElementById('space-stars'); const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 10) n++; return n; });
  assert.ok(litPixels > 300, `the canvas drew stars (lit pixels: ${litPixels})`);
  // The background never intercepts clicks on real interface elements that sit above it.
  await page.click('#mission-rep'); await page.waitForSelector('#rep-view:not([hidden])');
  assert.ok(await page.evaluate(() => document.body.classList.contains('space-on')), 'REP keeps the background');
  assert.deepEqual(errors, []);
});

test('the pause control toggles twinkle without stopping the still field', async () => {
  const { page } = await open('/'); await page.waitForSelector('#welcome:not([hidden])');
  assert.equal(await page.getAttribute('#space-motion', 'aria-pressed'), 'true');
  await page.click('#space-motion');
  assert.equal(await page.getAttribute('#space-motion', 'aria-pressed'), 'false');
  assert.ok(await page.evaluate(() => document.body.classList.contains('space-still')), 'space-still halts the animations');
  // The starfield is still painted (a beautiful still scene), just not twinkling.
  const litPixels = await page.evaluate(() => { const c = document.getElementById('space-stars'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++; return n; });
  assert.ok(litPixels > 300, 'the still starfield remains visible');
});

test('reduced-motion viewers see a still starfield and no pause control', async () => {
  const { page, errors } = await open('/', { reduceMotion: true }); await page.waitForSelector('#welcome:not([hidden])'); await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('space-motion')).display), 'none');
  const litPixels = await page.evaluate(() => { const c = document.getElementById('space-stars'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++; return n; });
  assert.ok(litPixels > 300, 'the still starfield is painted');
  assert.deepEqual(errors, []);
});

test('the Workspace (repository page) does not run the space background', async () => {
  const { page } = await open('/acme/demo'); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => document.body.classList.contains('space-on')), false);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('space-bg')).visibility), 'hidden');
});
