// Project: Git Architecture Diagram | Component: Server-rendered SEO route metadata regression tests.
import test from 'node:test'; // Run deterministic Node test cases.
import assert from 'node:assert/strict'; // Assert the canonical HTML is correct.
import './support/no-autostart.mjs'; // Disable the production listener while testing.
import { createAppServer } from '../server.mjs'; // Test the same server that Hostinger deploys.
const SITE = 'https://gitarchitecturediagram.com'; // All canonical links use the official HTTPS host.
const routes = [ // The sitemap lists exactly these three crawlable landing pages.
  ['/', 'Make Any Product with Genius AI | Git Architecture Diagram', 'Make any product with Genius AI'], // Homepage.
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
