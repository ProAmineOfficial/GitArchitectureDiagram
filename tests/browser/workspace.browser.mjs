// Project: Git Architecture Diagram | Browser tests: the 0.7 workspace end to end | Author: Amine Saoud ibn al-Bashir.
// Run with: npm run test:browser   (needs a Playwright Chromium: npx playwright install chromium)
// Self-contained: a temporary Git repository is served through the GitHub REST emulator, and model calls are answered
// by a deterministic mock in each provider's documented shape. No network, no credentials, no external harness.
import test from 'node:test'; import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import '../support/no-autostart.mjs'; // Keep the imported server from opening its production listener.
import { createAppServer } from '../../server.mjs';
import { createGitHubFetch } from '../support/github-emulator.mjs';

const dir = mkdtempSync(join(tmpdir(), 'gad-browser-'));
const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
const write = (path, text) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'Test');
write('README.md', '# Shop\nAn online shop with a web storefront and an API.\n\n## Features\n- Product search\n- Secure checkout\n- Order history\n');
write('package.json', JSON.stringify({ name: 'shop', main: 'server/index.js', dependencies: { express: '4', react: '18', pg: '8' }, devDependencies: { vitest: '1' } }));
write('server/index.js', "import { route } from './routes/api.js';\nimport express from 'express';\nexpress().use(route);\n");
write('server/routes/api.js', "import { auth } from '../auth/token.js';\nimport { db } from '../db/store.js';\nexport const route = (request, response) => response.json(db);\n");
write('server/auth/token.js', 'export const auth = token => token.length > 20;\n');
write('server/db/store.js', "import pg from 'pg';\nexport const db = new pg.Pool();\n");
write('web/App.jsx', "import React from 'react';\nexport default function App() { return null; }\n");
write('test/api.test.js', "import { route } from '../server/routes/api.js';\n");
write('.github/workflows/ci.yml', 'on: push\n'); write('Dockerfile', 'FROM node:22\n');
git('add', '.'); git('commit', '-q', '-m', 'shop'); const sha = git('rev-parse', 'HEAD').trim();

// Deterministic model: a system map for analysis, and one true plus one planted citation for questions.
const graph = { groups: [{ id: 'app', label: 'Application' }], nodes: [
  { id: 'user', label: 'Shopper', detail: '', kind: 'actor', group: '', path: '' },
  { id: 'web', label: 'Storefront', detail: 'React', kind: 'ui', group: 'app', path: 'web/App.jsx' },
  { id: 'api', label: 'API routes', detail: '', kind: 'service', group: 'app', path: 'server/routes/api.js' },
  { id: 'auth', label: 'Token check', detail: '', kind: 'source', group: 'app', path: 'server/auth/token.js' },
  { id: 'db', label: 'Order store', detail: 'PostgreSQL', kind: 'data', group: 'app', path: 'server/db/store.js' },
], edges: [
  { from: 'user', to: 'web', label: 'browses', basis: 'inferred', evidencePath: '', evidenceLine: 0 },
  { from: 'web', to: 'api', label: 'calls', basis: 'inferred', evidencePath: '', evidenceLine: 0 },
  { from: 'api', to: 'auth', label: 'imports', basis: 'observed', evidencePath: 'server/routes/api.js', evidenceLine: 1 },
  { from: 'api', to: 'db', label: 'imports', basis: 'observed', evidencePath: 'server/routes/api.js', evidenceLine: 2 },
], tour: [{ node: 'user', text: 'A shopper opens the storefront.' }, { node: 'web', text: 'The React app renders products.' }, { node: 'api', text: 'Requests reach the API routes.' }, { node: 'db', text: 'Orders are stored in PostgreSQL.' }] };
const modelCall = async (url, options) => {
  const body = JSON.parse(options.body); const name = body.text?.format?.name;
  const payload = name === 'genius_answer'
    ? { answer: 'Routes check tokens before reading orders.', answered: true, suggestions: ['Rotate tokens regularly.'], findings: [{ text: 'The API imports the token check.', path: 'server/routes/api.js', line: 1, quote: "import { auth } from '../auth/token.js';" }, { text: 'A secret is hard-coded.', path: 'server/routes/api.js', line: 2, quote: "const SECRET = 'planted';" }] }
    : { overview: 'An online shop: a React storefront calls an Express API that checks tokens and stores orders in PostgreSQL.', components: [], relationships: [], recommendations: [], limitations: [], graph };
  return Response.json({ status: 'completed', model: 'test-model', usage: { input_tokens: 100, output_tokens: 50 }, output: [{ content: [{ type: 'output_text', text: JSON.stringify(payload) }] }] });
};
Object.assign(process.env, { GENIUS_PUBLIC_AI: '1', OPENAI_API_KEY: 'site-key', GENIUS_MODEL: 'test-model', GENIUS_PUBLIC_DAILY_LIMIT: '20' });
const server = createAppServer({ fetchImpl: createGitHubFetch({ 'acme/shop': { dir, description: 'Online shop' } }, { fallback: modelCall }) });
let base; let browser; let page; const errors = [];
test.before(async () => { await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`; browser = await chromium.launch(); });
test.after(async () => { await browser?.close(); server.close(); rmSync(dir, { recursive: true, force: true }); });

async function open(viewport = { width: 1440, height: 940 }) {
  const context = await browser.newContext({ viewport, acceptDownloads: true }); await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const tab = await context.newPage(); tab.on('pageerror', error => errors.push(error.message));
  await tab.goto(`${base}/acme/shop`); await tab.waitForSelector('#workspace:not([hidden]) #diagram-content svg', { timeout: 30000 }); await tab.waitForTimeout(1700);
  return tab;
}
const download = async (action) => { const [file] = await Promise.all([page.waitForEvent('download'), action()]); const path = await file.path(); return { name: file.suggestedFilename(), text: readFileSync(path, 'utf8'), file: path }; };
const openExport = async group => { await page.click('#export-toggle'); await page.click(`[data-group-tab="${group}"]`); };

test('the 0.7 workspace', async t => {
  page = await open();
  await t.test('the system map opens first, with a guided tour', async () => {
    assert.equal(await page.getAttribute('[data-view=system]', 'aria-selected'), 'true');
    assert.ok(await page.isVisible('#tour-action'));
  });
  await t.test('Highlights: data flow follows the tour and is labeled as Genius interpretation', async () => {
    await page.click('#hl-toggle'); await page.click('.hl-mode[data-mode="flow"]'); await page.waitForTimeout(400);
    assert.equal(await page.textContent('#hl-basis'), 'Genius interpretation');
    assert.ok(await page.locator('#diagram-content g.node.hl-on').count() >= 3); assert.ok(await page.locator('#diagram-content path.hl-edge').count() >= 2);
    assert.match(await page.getAttribute('#diagram-content', 'class'), /highlighting/);
  });
  await t.test('the tour\'s main flow edges animate (Mermaid edge ids may carry a render prefix)', async () => {
    assert.ok(await page.locator('#diagram-content path.flow-edge').count() >= 3);
  });
  await t.test('Highlights: a keyword request is labeled as a keyword match, and clears', async () => {
    await page.click('#hl-toggle'); await page.fill('#hl-input', 'token check'); await page.press('#hl-input', 'Enter'); await page.waitForTimeout(300);
    assert.equal(await page.textContent('#hl-basis'), 'Keyword match'); assert.match(await page.textContent('#hl-label'), /token check/);
    await page.click('#hl-clear'); assert.equal(await page.locator('#diagram-content g.node.hl-on').count(), 0);
  });
  await t.test('Export: grouped tabs show one group at a time', async () => {
    await openExport('context'); assert.ok(await page.isVisible('[data-group="context"]')); assert.ok(await page.isHidden('[data-group="visual"]'));
    await page.click('[data-group-tab="visual"]'); assert.ok(await page.isVisible('[data-action="readme-badge"]')); await page.keyboard.press('Escape');
  });
  await t.test('README badge links to the pinned commit', async () => {
    await openExport('visual'); await page.click('[data-action="readme-badge"]');
    const text = await page.textContent('#doc-text'); assert.match(text, /img\.shields\.io\/badge\/Architecture-Open%20diagram/); assert.ok(text.includes(`/acme/shop/tree/${sha}`));
    await page.keyboard.press('Escape');
  });
  await t.test('README picture downloads the PNG named in its Markdown', async () => {
    await openExport('visual'); await page.click('[data-action="readme-picture"]');
    const file = await download(() => page.click('#doc-picture >> text=Architecture PNG'));
    assert.equal(file.name, 'architecture.png'); assert.match(await page.textContent('#doc-text'), /!\[Architecture of acme\/shop\]\(\.\/docs\/architecture\.png\)/);
    await page.keyboard.press('Escape');
  });
  await t.test('Build with Genius: the development prompt changes with its mode and downloads', async () => {
    await page.click('[data-drawer=genius]'); await page.waitForTimeout(500); await page.click('#build-genius [data-action="prompt"]');
    assert.match(await page.textContent('#doc-text'), /## Project objective/);
    await page.selectOption('#doc-mode', 'mvp'); assert.match(await page.textContent('#doc-text'), /Create an MVP based on this project/);
    const file = await download(() => page.click('#doc-download')); assert.match(file.name, /development-prompt\.md$/); assert.match(file.text, /## Acceptance criteria/);
    await page.keyboard.press('Escape');
  });
  await t.test('Development skills export as JSON with observed evidence', async () => {
    await page.click('#build-genius [data-action="skills"]'); await page.selectOption('#doc-format', 'json');
    const file = await download(() => page.click('#doc-download')); const data = JSON.parse(file.text);
    assert.equal(data.commit, sha); assert.ok(data.observed.some(item => item.name === 'React' && item.evidence.includes('package.json')));
    await page.keyboard.press('Escape');
  });
  await t.test('Skills needed to build your app reflect the description', async () => {
    await page.fill('#your-app', 'a web dashboard with user logins'); await page.click('#your-app-form button[type=submit]');
    assert.match(await page.textContent('#doc-text'), /### Security/); await page.keyboard.press('Escape');
  });
  await t.test('Genius answers separate verified source from inference (checked on the server)', async () => {
    await page.keyboard.press('Escape'); await page.click('#settings-open'); await page.fill('#api-key', 'visitor-key'); await page.click('.custom-model summary'); await page.fill('#model-custom', 'test-model'); await page.click('#settings .dialog-actions .primary-button');
    await page.click('[data-drawer=genius]'); await page.fill('#question', 'How are tokens checked?'); await page.click('#ask-ai');
    await page.waitForSelector('.verified-title', { timeout: 15000 });
    assert.equal(await page.locator('.findings.verified li').count(), 1); assert.equal(await page.locator('.findings.inferred li').count(), 1);
    assert.match(await page.textContent('.findings.inferred li'), /does not appear/);
  });
  await t.test('Software hierarchy: layers, collapse, and Explain with Genius', async () => {
    await page.keyboard.press('Escape'); await page.click('[data-view=hierarchy]'); await page.waitForTimeout(300);
    const labels = await page.locator('#hierarchy-view .hier-label.strong').allTextContents(); assert.ok(labels.includes('Frontend') && labels.includes('Tests'), labels.join(', '));
    await page.click('#hierarchy-view >> text=Collapse all'); assert.equal(await page.locator('#hierarchy-view li[aria-expanded=true]').count(), 1);
    await page.click('#hierarchy-view >> text=Expand all'); const row = page.locator('#hierarchy-view .hier-row', { hasText: 'Frontend' }).first(); await row.hover(); await row.locator('text=Explain').click();
    await page.waitForSelector('#genius-focus:not([hidden])'); assert.equal(await page.textContent('#genius-focus h3'), 'Frontend');
  });
  await t.test('Mind map concepts select across views', async () => {
    await page.keyboard.press('Escape'); await page.click('[data-view=mindmap]'); await page.waitForTimeout(900);
    await page.locator('#diagram-content [data-source-node]', { hasText: 'Infrastructure' }).first().click(); await page.waitForTimeout(500);
    assert.equal(await page.textContent('#genius-focus h3'), 'Infrastructure');
    await page.click('#genius-focus >> text=Highlight in Architecture'); await page.waitForTimeout(900);
    assert.equal(await page.getAttribute('[data-view=architecture]', 'aria-selected'), 'true'); assert.equal(await page.textContent('#hl-basis'), 'Your selection');
  });
  await t.test('Project extract: five sections from the analyzed files, per-section copy, Copy all, and downloads', async () => {
    await page.keyboard.press('Escape'); await page.click('[data-view=extract]'); await page.waitForSelector('#extract-output .extract-card');
    assert.deepEqual(await page.locator('#extract-output .extract-card h3').allTextContents(), ['Summary', 'Statistics', 'Directory structure', 'Important files', 'File contents']);
    assert.match(await page.textContent('#extract-output .extract-pre'), /Source: files read by the analysis/);
    await page.locator('.extract-card', { hasText: 'Directory structure' }).locator('text=Copy').click(); assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^Directory structure:\nshop\//);
    await page.click('#extract-output >> text=Copy all'); const all = await page.evaluate(() => navigator.clipboard.readText()); for (const part of ['SUMMARY', 'STATISTICS', 'IMPORTANT FILES', 'FILES CONTENT', 'FILE: server/index.js']) assert.ok(all.includes(part), part);
    const md = await download(() => page.click('#extract-output >> text=Download .md')); assert.match(md.name, /extract\.md$/); assert.match(md.text, /### server\/index\.js/);
  });
  await t.test('Project extract: the entire repository through the server, with include/exclude filters', async () => {
    await page.click('[data-source=archive]'); await page.fill('#extract-include', 'server/, *.yml'); await page.fill('#extract-exclude', 'auth/'); await page.click('#extract-run');
    await page.waitForFunction(() => /entire repository/.test(document.querySelector('#extract-output .extract-actions')?.textContent || ''), null, { timeout: 15000 });
    const tree = await page.textContent('.extract-card:has-text("Directory structure") pre');
    assert.ok(tree.includes('ci.yml') && tree.includes('store.js') && !tree.includes('token.js') && !tree.includes('App.jsx'), tree);
    assert.match(await page.textContent('#extract-output .extract-pre'), /Source: entire repository archive at this commit/);
  });
  await t.test('Dock: every view has its own icon, badges, and a moving active indicator', async () => {
    await page.keyboard.press('Escape');
    const labels = await page.locator('#view-dock .dock-item').evaluateAll(items => items.map(item => item.getAttribute('aria-label')));
    assert.deepEqual(labels, ['System Map', 'Architecture', 'Software Hierarchy', 'Repository Mind Map', 'Project Diagrams', 'Mermaid Source', 'Genius Guide', 'Genius Process', 'Export Project', 'Export', 'Build With Genius']);
    const icons = await page.locator('#view-dock .dock-icon svg').evaluateAll(svgs => svgs.map(svg => svg.innerHTML)); assert.equal(new Set(icons).size, 11, 'eleven distinct icons');
    assert.equal(await page.locator('#view-dock [data-view=system] .dock-badge.ai').count(), 1); assert.ok(await page.isHidden('#docs-count'), 'no count badge without diagrams');
    assert.equal(await page.locator('#view-dock .dock-sep').count(), 2);
    await page.click('#view-dock [data-view=hierarchy]'); await page.waitForTimeout(400); assert.equal(await page.getAttribute('#view-dock [data-view=hierarchy]', 'aria-selected'), 'true'); // Colors transition over 250 ms.
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#view-dock [data-view=hierarchy] .dock-icon')).backgroundColor === 'rgb(212, 137, 26)', null, { timeout: 3000 }); // Amber once the color transition settles.
    assert.equal(await page.locator('#view-dock [aria-selected=true] .dock-dot').evaluate(dot => getComputedStyle(dot).backgroundColor), 'rgb(212, 137, 26)');
  });
  await t.test('Dock: proximity magnification, neighbors, and reset on leave', async () => {
    const box = await page.locator('#view-dock [data-view=hierarchy]').boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + 20); await page.waitForTimeout(350);
    const scales = await page.locator('#view-dock .dock-item').evaluateAll(items => items.map(item => Number(item.style.getPropertyValue('--s') || 1)));
    assert.ok(scales[2] > 1.45, `nearest ${scales[2]}`); assert.ok(scales[1] > 1.15 && scales[1] < 1.3 && scales[3] > 1.15 && scales[3] < 1.3, `neighbors ${scales[1]} ${scales[3]}`); assert.ok(scales[0] < scales[1] && scales[9] === 1);
    assert.match(await page.locator('#view-dock [data-view=hierarchy] .dock-icon').evaluate(icon => getComputedStyle(icon).transform), /matrix\(1\.4/);
    await page.mouse.move(5, 5); await page.waitForTimeout(350);
    assert.ok((await page.locator('#view-dock .dock-item').evaluateAll(items => items.map(item => Number(item.style.getPropertyValue('--s') || 1)))).every(scale => scale === 1));
  });
  await t.test('Dock: keyboard focus moves with arrows and Enter switches views', async () => {
    await page.focus('#view-dock [data-view=architecture]'); await page.keyboard.press('ArrowRight'); assert.equal(await page.evaluate(() => document.activeElement.dataset.view), 'hierarchy');
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await page.waitForTimeout(400); assert.equal(await page.getAttribute('#view-dock [data-view=mindmap]', 'aria-selected'), 'true');
  });
  await t.test('Dock: Export opens the shared export menu anchored under the dock button', async () => {
    await page.click('#dock-export'); assert.ok(await page.isVisible('#export-menu')); assert.equal(await page.getAttribute('#dock-export', 'aria-expanded'), 'true');
    const button = await page.locator('#dock-export').boundingBox(); const menu = await page.locator('#export-menu').boundingBox();
    assert.ok(menu.y > button.y + button.height && menu.y - (button.y + button.height) < 30, `menu below the button (${menu.y})`);
    assert.equal(await page.getAttribute('[data-view=mindmap]', 'aria-selected'), 'true', 'Export does not change the view');
    await page.keyboard.press('Escape'); assert.ok(await page.isHidden('#export-menu'));
    await page.click('#export-toggle'); const bar = await page.locator('#export-menu').boundingBox(); const toggle = await page.locator('#export-toggle').boundingBox(); assert.ok(Math.abs(bar.y - (toggle.y + toggle.height)) < 30, 'the same menu returns to the command bar'); await page.keyboard.press('Escape');
  });
  await t.test('Export Project: grouped cards, clone command, diagram exports, and packs', async () => {
    await page.click('#view-dock [data-view=extract]'); await page.waitForSelector('.xp-card');
    assert.deepEqual(await page.locator('.xp-card summary strong').allTextContents(), ['Genius Development Pack', 'Clone Repository', 'Project Files', 'Project Diagrams', 'Project Skills', 'Genius', 'AI / Developer Context']);
    assert.equal(await page.textContent('#extract-run'), 'Export Project');
    await page.click('.xp-card[data-card=clone] summary'); await page.click('text=Copy Clone Command'); assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `git clone https://github.com/acme/shop.git\ncd shop\ngit checkout ${sha}`);
    await page.click('.xp-card[data-card=diagrams] summary'); const row = page.locator('.xp-diagram-row[data-view=hierarchy]');
    const svg = await download(() => row.locator('text=SVG').click()); assert.match(svg.name, /hierarchy\.svg$/); assert.match(svg.text, /<svg/);
    const png = await download(() => row.locator('text=PNG').click()); assert.match(png.name, /hierarchy\.png$/);
    const mmd = await download(() => page.locator('.xp-diagram-row[data-view=mindmap]').locator('text=Mermaid file').click()); assert.match(mmd.text, /^mindmap/);
    await page.locator('.xp-diagram-row[data-view=architecture]').locator('text=Copy Mermaid').click(); assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^flowchart/);
    await page.click('.xp-card[data-card=context] summary'); const pack = await download(() => page.click('text=Developer Pack (.zip)')); assert.match(pack.name, /developer-pack\.zip$/); assert.equal(pack.text.slice(0, 2), 'PK');
    const names = execFileSync('unzip', ['-Z1', pack.file], { encoding: 'utf8' }); for (const name of ['system-map.md', 'software-hierarchy.md', 'development-prompt.md', 'evidence.json']) assert.match(names, new RegExp(name.replace('.', '\\.')));
    await page.click('.xp-card[data-card=genius] summary'); await page.click('text=MVP Plan…'); assert.equal(await page.inputValue('#doc-mode'), 'mvp'); await page.keyboard.press('Escape');
  });
  await t.test('Permalinks carry the selected view, and opening one restores it', async () => {
    await page.click('#view-dock [data-view=hierarchy]'); await page.click('#share'); const link = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(link, /[?&]view=hierarchy/); assert.doesNotMatch(link, /token|key=/i);
    await page.goto(link); await page.waitForSelector('#workspace:not([hidden])'); await page.waitForTimeout(1200); assert.equal(await page.getAttribute('#view-dock [data-view=hierarchy]', 'aria-selected'), 'true');
  });
  await t.test('Escape closes drawers; light theme re-renders without errors', async () => {
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); assert.equal(await page.getAttribute('#studio', 'data-genius'), 'closed');
    await page.click('#theme'); await page.waitForTimeout(700); assert.equal(await page.getAttribute('html', 'data-theme'), 'light'); assert.ok(await page.locator('#diagram-content svg').count());
  });
  await t.test('Mobile: no horizontal overflow, Genius opens as a bottom sheet', async () => {
    const mobile = await open({ width: 390, height: 844 });
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    const dock = await mobile.locator('#view-dock').evaluate(element => ({ scrollable: getComputedStyle(element).overflowX, width: element.getBoundingClientRect().width, labels: getComputedStyle(element.querySelector('.dock-label')).display }));
    assert.equal(dock.scrollable, 'auto'); assert.ok(dock.width <= 390); assert.equal(dock.labels, 'none');
    const item = await mobile.locator('#view-dock [data-view=architecture]').boundingBox(); await mobile.mouse.move(item.x + 10, item.y + 10); await mobile.waitForTimeout(250);
    assert.equal(await mobile.locator('#view-dock [data-view=architecture]').evaluate(element => element.style.getPropertyValue('--s')), '', 'no magnification on touch layouts');
    await mobile.click('[data-drawer=genius]'); await mobile.waitForTimeout(600);
    const box = await mobile.locator('.genius-panel').boundingBox(); assert.ok(box.y > 100 && Math.abs(box.y + box.height - 844) < 4, JSON.stringify(box));
  });
  await t.test('Reduced motion: no magnification', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 940 }, reducedMotion: 'reduce' }); const still = await context.newPage(); await still.goto(`${base}/acme/shop`); await still.waitForSelector('#view-dock');
    const box = await still.locator('#view-dock [data-view=architecture]').boundingBox(); await still.mouse.move(box.x + box.width / 2, box.y + 20); await still.waitForTimeout(300);
    assert.equal(await still.locator('#view-dock [data-view=architecture]').evaluate(element => element.style.getPropertyValue('--s')), ''); await context.close();
  });
  await t.test('no uncaught page errors', () => assert.deepEqual(errors, []));
});
