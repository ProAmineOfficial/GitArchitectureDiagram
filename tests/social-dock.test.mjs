// Project: Git Architecture Diagram | Social dock: magnification rings, glyph manifest safety, and markup contracts.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs'; import { mkdtemp, writeFile, rm } from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import { rings, NETWORKS, DOCK } from '../public/social-dock.js';
import { svgProblem, buildManifest } from '../scripts/social-glyphs.mjs';

test('rings: the item under the pointer, its neighbors, the next neighbors, then everything else', () => {
  const row = NETWORKS.map((_, index) => ({ x: index * 52, y: 0 })); // 44 px buttons with an 8 px gap.
  assert.deepEqual(rings(row, 3, 52), [3, 2, 1, 0, 1, 2, 3, 3]); assert.deepEqual(rings(row, null, 52), [3, 3, 3, 3, 3, 3, 3, 3]);
  const grid = NETWORKS.map((_, index) => ({ x: (index % 4) * 52, y: Math.floor(index / 4) * 58 })); assert.deepEqual(rings(grid, 1, 52).slice(0, 6), [1, 0, 1, 2, 2, 1], 'a wrapped dock uses real distances');
  assert.deepEqual(DOCK.scale, [1.28, 1.12, 1.04]); assert.deepEqual(DOCK.lift, [-6, -2, 0]);
});

test('glyph files are validated: plain SVG only, no scripts, handlers, external references, or embedded images', async () => {
  assert.equal(svgProblem('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>'), '');
  assert.equal(svgProblem('<?xml version="1.0"?>\n<!-- official -->\n<svg viewBox="0 0 1 1"><g/></svg>'), '');
  for (const bad of ['<svg><script>alert(1)</script></svg>', '<svg onload="x()"></svg>', '<svg><image href="https://cdn.example/x.png"/></svg>', '<svg><use href="https://cdn.example/s.svg#a"/></svg>', '<svg style="background:url(https://cdn.example/x.png)"></svg>', '<html><svg/></html>', `<svg>${'x'.repeat(30000)}</svg>`]) assert.notEqual(svgProblem(bad), '', bad.slice(0, 40));
  const directory = await mkdtemp(path.join(os.tmpdir(), 'gad-glyphs-'));
  try {
    await writeFile(path.join(directory, 'github.svg'), '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>'); await writeFile(path.join(directory, 'x.svg'), '<svg onclick="steal()"/>'); await writeFile(path.join(directory, 'unknown.svg'), '<svg/>');
    const { manifest, problems } = await buildManifest(directory);
    assert.deepEqual(manifest, { version: 1, glyphs: { github: 'github.svg' } }); assert.equal(problems.length, 1); assert.match(problems[0], /^x\.svg: contains event handler/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('the committed manifest lists only glyph files that exist and pass validation', () => {
  const manifest = JSON.parse(readFileSync('public/assets/brand/social/glyphs.json', 'utf8')); assert.equal(manifest.version, 1);
  for (const [network, file] of Object.entries(manifest.glyphs)) { assert.ok(NETWORKS.includes(network), network); assert.equal(file, `${network}.svg`); const full = `public/assets/brand/social/${file}`; assert.ok(existsSync(full), full); assert.equal(svgProblem(readFileSync(full, 'utf8')), '', full); }
});

test('markup and styles: eight local links in order, no generic icons, no remote assets', () => {
  const page = readFileSync('public/index.html', 'utf8'); const dock = page.slice(page.indexOf('<div class="social-dock">'), page.indexOf('</ul></div>', page.indexOf('<div class="social-dock">')));
  assert.deepEqual([...dock.matchAll(/data-network="([a-z]+)"/g)].map(match => match[1]), NETWORKS);
  assert.equal([...dock.matchAll(/target="_blank" rel="noopener noreferrer" aria-label="Pro_Amine LLC on [A-Za-z]+"/g)].length, 8);
  assert.ok(!/data-icon="social-/.test(page)); assert.ok(!/'social-(send|music|video|people|camera|code|x|briefcase)'/.test(readFileSync('public/icons.js', 'utf8')), 'the generic social icons are gone');
  const css = readFileSync('public/styles.css', 'utf8'); assert.ok(!/url\(\s*["']?(https?:)?\/\//.test(css), 'styles load nothing remote'); assert.ok(!/<script[^>]+src="https?:/.test(page) && !/<link[^>]+href="https?:\/\/(?!proamine)/.test(page.replace(/<a [^>]+>/g, '')));
});
