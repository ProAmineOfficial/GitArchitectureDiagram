// Project: Git Architecture Diagram | Browser tests: the three-path homepage and the independent REP entry (Reverse
// Engineer Any Product). The third card opens /rep, which reuses the shared command bar and the normal repository
// analysis; it never shows fabricated binary-disassembly results. No network: a tiny repo is served through the emulator.
import test from 'node:test'; import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import '../support/no-autostart.mjs';
import { createAppServer } from '../../server.mjs';
import { createGitHubFetch } from '../support/github-emulator.mjs';

const dir = mkdtempSync(join(tmpdir(), 'gad-rep-'));
const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' });
const write = (p, t) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), t); };
git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'T');
write('README.md', '# Lamp\nA small LED lamp controller.\n'); write('src/main.cpp', '#include "led.h"\nint main(){return led();}\n'); write('src/led.h', 'int led();\n');
write('package.json', JSON.stringify({ name: 'lamp' }));
git('add', '.'); git('commit', '-q', '-m', 'lamp');
const server = createAppServer({ fetchImpl: createGitHubFetch({ 'acme/lamp': { dir, description: 'LED lamp' } }, { fallback: async () => new Response('{}', { status: 404 }) }) });
let base; let browser;
test.before(async () => { await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`; browser = await chromium.launch(); });
test.after(async () => { await browser?.close(); server.close(); rmSync(dir, { recursive: true, force: true }); });

test('the homepage shows three independent primary cards in order', async () => {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 940 } })).newPage();
  await page.goto(`${base}/`); await page.waitForSelector('#welcome:not([hidden])');
  const titles = await page.$$eval('.mission-paths .mission-card strong', nodes => nodes.map(n => n.textContent));
  assert.deepEqual(titles, ['Start from an Idea', 'Import GitHub Project', 'Reverse Engineer Any Product']);
  assert.equal(await page.getAttribute('#mission-rep', 'href'), '/rep');
  assert.ok(await page.isVisible('#mission-rep'));
  await page.close();
});

test('clicking the REP card opens the independent REP entry, reusing the command bar', async () => {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 940 } })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/`); await page.waitForSelector('#welcome:not([hidden])');
  await page.click('#mission-rep');
  await page.waitForSelector('#rep-view:not([hidden])');
  assert.equal(new URL(page.url()).pathname, '/rep');
  assert.equal(await page.title(), 'Reverse Engineer Any Product — REP | Git Architecture Diagram');
  assert.equal(await page.isVisible('#welcome'), false);
  // The shared command bar is reused inside the REP entry, so the repository input is available here.
  assert.ok(await page.isVisible('#rep-slot #repository'), 'the command bar moved into the REP entry');
  // Honest capability labels: binary analysis is explicitly "not available yet", never shown as a working result.
  const planned = await page.textContent('.rep-cap-head.planned');
  assert.match(planned, /not available yet/i);
  assert.match(await page.textContent('#rep-view'), /no disassembly results are produced/i);
  assert.deepEqual(errors, []);
  await page.close();
});

test('REP imports a repository through the normal source-grounded analysis', async () => {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 940 } })).newPage();
  await page.goto(`${base}/rep`); await page.waitForSelector('#rep-view:not([hidden]) #repository');
  await page.fill('#rep-slot #repository', 'acme/lamp');
  await page.click('#rep-slot #analyze');
  await page.waitForSelector('#workspace:not([hidden])', { timeout: 30000 });
  assert.equal(new URL(page.url()).pathname, '/acme/lamp');
  assert.equal(await page.isVisible('#rep-view'), false);
  // Back returns to the REP entry, not a broken state.
  await page.goBack(); await page.waitForSelector('#rep-view:not([hidden])');
  assert.equal(new URL(page.url()).pathname, '/rep');
  await page.close();
});
