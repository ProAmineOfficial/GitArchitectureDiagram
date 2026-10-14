// Project: Git Architecture Diagram | Component: Server-rendered SEO route metadata regression tests.
import test from 'node:test'; // Run deterministic Node test cases.
import assert from 'node:assert/strict'; // Assert the canonical HTML is correct.
import './support/no-autostart.mjs'; // Disable the production listener while testing.
import { createAppServer } from '../server.mjs'; // Test the same server that Hostinger deploys.
const SITE = 'https://gitarchitecturediagram.com'; // All canonical links use the official HTTPS host.
const routes = [ // The sitemap lists exactly these three crawlable landing pages.
  ['/', 'Git Architecture Diagram — Make Any Product with Genius AI', 'Make any product with Genius AI'], // Homepage: the brand first, as Google's site-name guidance prefers.
  ['/new', 'Start from an Idea with Genius AI | Git Architecture Diagram', 'Turn a product idea into structured requirements'], // Idea creation.
  ['/browse', 'Browse examples · Git Architecture Diagram', 'Browse GitHub repository architecture diagram examples'] // Repository examples.
]; // Finish the fixed route list.
test('site landing pages have distinct titles, descriptions and self-canonical links', async t => { // Avoid relying on browser JavaScript for search metadata.
  const server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); // Bind a temporary loopback port.
  t.after(() => new Promise(resolve => server.close(resolve))); // Always clean up the test server.
  const base = `http://127.0.0.1:${server.address().port}`; // Build a local test URL.
  for (const [route, title, descriptionStart] of routes) { // Inspect each distinct public route.
    const result = await fetch(base + route); const html = await result.text(); // Request the real HTML response.
    assert.equal(result.status, 200, route); // Ensure server routing still works.
    assert.match(result.headers.get('content-type') || '', /^text\/html/, route); // Pages are HTML.
    assert.ok(html.includes(`<title>${title}</title>`), route + ' title'); // Confirm page-specific title.
    assert.ok(html.includes(`<link rel="canonical" href="${SITE}${route}">`), route + ' canonical'); // Canonicalize each page to itself.
    assert.ok(html.includes(`<meta name="description" content="${descriptionStart}`), route + ' description'); // Distinct and relevant text.
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1, route + ' canonical count'); // Avoid duplicates.
  } // Finish checking public pages.
}); // End route SEO test.
test('repository deep links retain their existing content and are not canonicalized to the homepage', async t => { // Preserve source-repository URL semantics.
  const server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); // Start a new isolated server.
  t.after(() => new Promise(resolve => server.close(resolve))); // Close after test.
  const response = await fetch(`http://127.0.0.1:${server.address().port}/ProAmineOfficial/NanoKit-ESP32`); // Open a legitimate repository link.
  assert.equal(response.status, 200); assert.doesNotMatch(await response.text(), /rel="canonical"/); // Do not claim the homepage is canonical for a repository view.
}); // End regression test.

// ——— GAD-SEO-FAVICON-01 ———
import { readFileSync } from 'node:fs';
import { PAGE_TITLES, routeMetadata, withSearchMetadata } from '../src/seo.mjs';
import { createWorker } from '../worker.mjs';
const INDEX = readFileSync('public/index.html', 'utf8');
const visible = (html, pattern) => { const tag = html.match(pattern)?.[0]; assert.ok(tag, String(pattern)); return !/\shidden(?=[\s>])/.test(tag); };

test('the server shows the right section for each landing page before any script runs', () => {
  const home = withSearchMetadata(INDEX, '/'); const idea = withSearchMetadata(INDEX, '/new'); const browse = withSearchMetadata(INDEX, '/browse');
  assert.ok(visible(home, /<section\b[^>]*id="welcome"[^>]*>/) && !visible(home, /<section\b[^>]*id="browse-view"[^>]*>/));
  assert.ok(!visible(idea, /<section\b[^>]*id="welcome"[^>]*>/), '/new: the home mission is hidden');
  assert.ok(!visible(idea, /<section\b[^>]*class="command-bar"[^>]*>/), '/new: the GitHub input is hidden; the idea workspace has its own form');
  assert.ok(!visible(browse, /<section\b[^>]*id="welcome"[^>]*>/) && visible(browse, /<section\b[^>]*id="browse-view"[^>]*>/));
  const firstVisibleH1 = html => { for (const match of html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)) { const open = html.lastIndexOf('<section', match.index); const tag = html.slice(open, html.indexOf('>', open) + 1); if (!/\shidden(?=[\s>])/.test(tag)) return match[1].replace(/<[^>]+>/g, '').trim(); } return null; }; // The heading of the first section that is not hidden.
  assert.equal(firstVisibleH1(browse), 'Browse examples');
  assert.equal(firstVisibleH1(idea), 'Start from an Idea');
  assert.equal(firstVisibleH1(home), 'Make Any Product with Genius AI');
  assert.equal(withSearchMetadata(INDEX, '/acme/demo'), INDEX, 'repository deep links are untouched');
  assert.equal(routeMetadata('/examples').canonical, '/browse', '/examples is an alias of /browse and canonicalizes to it');
  assert.ok(withSearchMetadata(INDEX, '/examples').includes('<link rel="canonical" href="https://gitarchitecturediagram.com/browse">'));
});

test('the browser script sets the same title as the server for each page', () => {
  assert.ok(INDEX.includes(`<title>${PAGE_TITLES.home}</title>`), 'index.html');
  assert.ok(readFileSync('public/app.js', 'utf8').includes(`const HOME_TITLE = '${PAGE_TITLES.home}';`), 'home');
  assert.ok(readFileSync('public/app.js', 'utf8').includes(`document.title = '${PAGE_TITLES.browse}';`), 'browse');
  assert.ok(readFileSync('public/idea.js', 'utf8').includes(`document.title = '${PAGE_TITLES.idea}';`), 'idea');
});

test('the hosted Worker serves the same landing-page metadata', async () => {
  const assets = { fetch: async request => { const path = new URL(request.url).pathname; return path === '/' || path === '/index.html' ? new Response(INDEX, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': String(Buffer.byteLength(INDEX)) } }) : new Response('Not found', { status: 404 }); } };
  const worker = createWorker();
  for (const [path, title, canonical] of [['/', PAGE_TITLES.home, '/'], ['/new', PAGE_TITLES.idea, '/new'], ['/browse', PAGE_TITLES.browse, '/browse']]) {
    const response = await worker.fetch(new Request(`https://diagram.example${path}`), { ASSETS: assets }, {});
    const html = await response.text(); assert.equal(response.status, 200, path);
    assert.ok(html.includes(`<title>${title}</title>`), `${path} title`); assert.ok(html.includes(`<link rel="canonical" href="${SITE}${canonical}">`), `${path} canonical`);
    assert.equal(response.headers.get('Content-Length'), null, 'no stale length after rewriting');
  }
  const deep = await (await worker.fetch(new Request('https://diagram.example/acme/demo'), { ASSETS: assets }, {})).text();
  assert.doesNotMatch(deep, /rel="canonical"/);
});

test('favicons: every declared icon is served as an image of the declared, square size; the ICO holds 16, 32, and 48', async t => {
  const server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const links = [...INDEX.matchAll(/<link rel="(icon|apple-touch-icon)"([^>]*)>/g)].map(match => ({ rel: match[1], href: match[2].match(/href="([^"]+)"/)[1], sizes: match[2].match(/sizes="([^"]+)"/)?.[1] || '' }));
  assert.ok(links.length >= 7, 'favicon.ico, five PNG sizes, and the touch icon');
  for (const link of links) {
    const response = await fetch(base + link.href); assert.equal(response.status, 200, link.href);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (link.href.endsWith('.png')) {
      assert.equal(response.headers.get('content-type'), 'image/png', link.href);
      assert.equal(bytes.toString('ascii', 1, 4), 'PNG', `${link.href} is a real PNG`);
      const width = bytes.readUInt32BE(16); const height = bytes.readUInt32BE(20);
      assert.equal(width, height, `${link.href} is square`); assert.equal(link.sizes, `${width}x${height}`, `${link.href} matches its declared size`);
    } else {
      assert.equal(response.headers.get('content-type'), 'image/x-icon');
      assert.equal(bytes.readUInt16LE(2), 1, 'an ICO file'); const count = bytes.readUInt16LE(4);
      const sizes = Array.from({ length: count }, (_, index) => bytes[6 + index * 16] || 256).sort((a, b) => a - b);
      assert.deepEqual(sizes, [16, 32, 48]); assert.equal(link.sizes, '16x16 32x32 48x48');
    }
  }
  const robots = await (await fetch(`${base}/robots.txt`)).text();
  assert.doesNotMatch(robots, /Disallow:\s*\/(assets|favicon)/, 'Googlebot-Image can fetch the icons');
  assert.doesNotMatch(robots, /User-agent:\s*Googlebot/i, 'no crawler is singled out');
});
