// Project: Git Architecture Diagram | Brand assets: local serving, deep-link safety, and the provenance-checked fetch script.
import test from 'node:test'; import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import './support/no-autostart.mjs';
import { createAppServer } from '../server.mjs';
import { fetchBrandAssets, ASSETS } from '../scripts/fetch-brand-assets.mjs';

test('brand images are served locally; a missing brand file is a 404, while repository image paths still open the workspace', async t => {
  const server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const image = await fetch(`${base}/assets/brand/nanokit-integrated-esp32.webp`); assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/webp'); const bytes = new Uint8Array(await image.arrayBuffer()); assert.equal(String.fromCharCode(...bytes.slice(8, 12)), 'WEBP');
  const missing = await fetch(`${base}/assets/brand/not-there.png`); assert.equal(missing.status, 404); await missing.text();
  const deep = await fetch(`${base}/ProAmineOfficial/Driver-NanoKit-ESP32-of-T.U.M-Pro_Amine-IC/blob/main/Icon%20NanoKit%20Integrated%20ESP32.png`); assert.equal(deep.status, 200); assert.match(await deep.text(), /Git Architecture Diagram/);
  const page = await (await fetch(base + '/')).text();
  assert.match(page, /© 2026 Amine Saoud ibn al-Bashir \| <a [^>]*>Pro_Amine LLC<\/a>/); assert.ok(!page.includes('Built by')); assert.ok(!/all rights reserved/i.test(page));
  assert.ok(!/<img[^>]+src="https?:/.test(page), 'no hotlinked images'); assert.ok(!/<script[^>]+src="https?:/.test(page), 'no remote scripts');
  const footer = page.slice(page.indexOf('<footer'), page.indexOf('</footer>')); assert.ok(footer.length > 1000);
  for (const match of footer.matchAll(/<a [^>]*href="https?:[^"]+"[^>]*>/g)) { assert.match(match[0], /target="_blank"/); assert.match(match[0], /rel="noopener noreferrer"/); }
});

test('the fetch script saves only real PNG or WebP images, keeps existing files, and never blocks on failures', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'gad-brand-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]); const requested = [];
  await writeFile(path.join(directory, 'pro-amine-logo.png'), 'existing');
  const report = await fetchBrandAssets({ directory, log: () => {}, fetchImpl: async url => { requested.push(url); if (url.endsWith('UMT-16x16-BGA-IC.png')) return new Response('<html>blocked</html>', { status: 200 }); if (url.endsWith('.webp')) return new Response('nope', { status: 404 }); return new Response(png); } });
  assert.ok(requested.every(url => url.startsWith('https://proamine.tech/wp-content/uploads/')));
  assert.equal(report.find(item => item.file === 'pro-amine-logo.png').status, 'kept'); assert.equal(await readFile(path.join(directory, 'pro-amine-logo.png'), 'utf8'), 'existing');
  assert.equal(report.find(item => item.file === 'git-architecture-diagram-icon.png').status, 'downloaded');
  assert.match(report.find(item => item.file === 'umt-16x16-bga-hybrid-mcu-soc.png').error, /not a PNG/);
  assert.equal(ASSETS.length, 5);
});
