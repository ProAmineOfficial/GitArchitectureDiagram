// Project: Git Architecture Diagram | Regression test: content-versioned asset URLs, so a cached older script can never run against a newer page after a deploy (the 2026-10-17 blank /new page).
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './support/no-autostart.mjs';
import { createAppServer } from '../server.mjs';

const SCRIPT = /<script type="module" src="\/_v\/([0-9a-f]{16})\/app\.js"><\/script>/;
const STYLE = /<link rel="stylesheet" href="\/_v\/([0-9a-f]{16})\/styles\.css">/;

test('every page loads the application script and stylesheet from one content-versioned URL', async t => {
  const server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  let version = null;
  for (const route of ['/', '/new', '/browse', '/examples', '/acme/demo', '/acme/demo/blob/main/src/main.js', '/acme/project.js']) {
    const response = await fetch(base + route); assert.equal(response.status, 200, route); assert.equal(response.headers.get('cache-control'), 'no-cache', `${route}: the page itself is always revalidated`);
    const html = await response.text(); const script = html.match(SCRIPT); const style = html.match(STYLE);
    assert.ok(script, `${route}: the module script must load from /_v/<version>/app.js`); assert.ok(style, `${route}: the stylesheet must load from /_v/<version>/styles.css`);
    assert.equal(script[1], style[1], `${route}: script and stylesheet share the version`);
    version ??= script[1]; assert.equal(script[1], version, `${route}: one version per running build`);
    assert.ok(!html.includes('src="/app.js"') && !html.includes('href="/styles.css"'), `${route}: no unversioned application asset is referenced`);
  }

  // The versioned URLs serve the current files and may be cached for good. Relative module imports (./dock.js, the lazily
  // imported ./project-workspace.js) resolve under the same prefix, so the whole module graph moves to a new URL together.
  for (const file of ['app.js', 'styles.css', 'dock.js', 'project-workspace.js']) {
    const response = await fetch(`${base}/_v/${version}/${file}`); assert.equal(response.status, 200, file);
    assert.equal(await response.text(), readFileSync(`public/${file}`, 'utf8'), `${file}: same bytes as public/${file}`);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable', file);
    assert.match(response.headers.get('content-type'), file.endsWith('.css') ? /text\/css/ : /javascript/, file);
  }

  // A version this build does not have (a page rendered by the previous release) still loads, but is never cached as immutable.
  const other = await fetch(`${base}/_v/0123456789abcdef/app.js`); assert.equal(other.status, 200); assert.equal(other.headers.get('cache-control'), 'no-cache'); await other.text();

  // The unversioned URLs keep working, revalidated as before.
  const plain = await fetch(`${base}/app.js`); assert.equal(plain.status, 200); assert.equal(plain.headers.get('cache-control'), 'no-cache'); await plain.text();

  // The prefix serves only top-level public scripts and stylesheets: no pages, folders, dependencies, server files, or traversal.
  for (const path of [`/_v/${version}/index.html`, `/_v/${version}/missing.js`, `/_v/${version}/assets/engineering/example-esp32.json`, `/_v/${version}/vendor/mermaid/mermaid.esm.min.mjs`, `/_v/${version}/%2e%2e%2fserver.mjs`, `/_v/${version}/..%2fserver.mjs`, `/_v/${version}/.env`]) {
    const response = await fetch(base + path); assert.equal(response.status, 404, path); await response.text();
  }
});

test('the asset version follows the content of the scripts and stylesheet', async () => {
  const { assetVersion } = await import('../server.mjs');
  const files = [{ name: 'app.js', data: 'a' }, { name: 'styles.css', data: 'b' }];
  const first = assetVersion(files);
  assert.match(first, /^[0-9a-f]{16}$/);
  assert.equal(assetVersion([...files].reverse()), first, 'independent of read order');
  assert.notEqual(assetVersion([{ name: 'app.js', data: 'a2' }, files[1]]), first, 'a changed script changes the version');
  assert.notEqual(assetVersion([...files, { name: 'dock.js', data: '' }]), first, 'an added module changes the version');
});
