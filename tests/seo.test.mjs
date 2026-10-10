// Project: Git Architecture Diagram | Search discoverability: robots.txt, sitemap, manifest, head metadata, structured data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './support/no-autostart.mjs'; // Keep the imported server from opening its production listener.
import { createAppServer } from '../server.mjs';

const SITE = 'https://gitarchitecturediagram.com';
const TITLE = 'Make Any Product with Genius AI | Git Architecture Diagram';
const html = readFileSync('public/index.html', 'utf8');

test('robots.txt, sitemap.xml, and the web app manifest are served with crawler-friendly types', async t => {
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  // robots.txt must be a 200 text file: a 5xx here makes Google treat the whole site as blocked.
  const robots = await fetch(`${base}/robots.txt`);
  assert.equal(robots.status, 200);
  assert.match(robots.headers.get('content-type'), /^text\/plain/);
  const rules = await robots.text();
  assert.match(rules, /^User-agent: \*$/m);
  assert.match(rules, /^Allow: \/$/m);
  assert.doesNotMatch(rules, /^Disallow: \/$/m, 'the site root must stay crawlable');
  assert.match(rules, new RegExp(`^Sitemap: ${SITE}/sitemap\\.xml$`, 'm'));

  const sitemap = await fetch(`${base}/sitemap.xml`);
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get('content-type'), /^application\/xml/);
  const urls = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(urls, [`${SITE}/`, `${SITE}/browse`, `${SITE}/new`]);

  const manifest = await fetch(`${base}/site.webmanifest`);
  assert.equal(manifest.status, 200);
  assert.match(manifest.headers.get('content-type'), /^application\/manifest\+json/);
  const body = await manifest.json();
  assert.equal(body.name, 'Git Architecture Diagram');
  for (const icon of body.icons) {
    // Every manifest icon must exist and be served as an image.
    const response = await fetch(base + icon.src);
    assert.equal(response.status, 200, icon.src);
    assert.equal(response.headers.get('content-type'), 'image/png');
    await response.arrayBuffer();
  }

  // The idea workspace is an application page, like /browse.
  const idea = await fetch(`${base}/new`);
  assert.equal(idea.status, 200);
  assert.match(idea.headers.get('content-type'), /^text\/html/);
  await idea.text();

  // Repository deep links still open the workspace; the new file types do not change that routing.
  const deep = await fetch(`${base}/acme/demo/blob/main/notes.txt`);
  assert.equal(deep.status, 200);
  assert.match(deep.headers.get('content-type'), /^text\/html/);
  await deep.text();
});

test('the home page leads with Make Any Product with Genius AI and keeps the Git Architecture Diagram name', () => {
  assert.ok(html.includes(`<title>${TITLE}</title>`));
  assert.match(html, /<meta name="description" content="Make any product with Genius AI: turn an idea into requirements, an architecture, engineering files, and a validation report\. Or import a GitHub repository/);
  assert.ok(html.includes(`<meta property="og:title" content="${TITLE}">`));
  assert.ok(html.includes('<meta name="application-name" content="Git Architecture Diagram">'), 'the platform name is unchanged');
  // Google reads favicons from the home page; sizes that are multiples of 48 px are preferred.
  for (const size of [48, 96, 192]) assert.ok(html.includes(`sizes="${size}x${size}" href="/assets/brand/icons/gad-icon-${size}.png"`), `${size}px icon`);
  assert.ok(html.includes('alt="Git Architecture Diagram logo"'));
  // The browser keeps the same title when it returns to the home page.
  assert.ok(readFileSync('public/app.js', 'utf8').includes("const HOME_TITLE = 'Make Any Product with Genius AI | Git Architecture Diagram';"));
});

test('structured data identifies Genius AI as part of Git Architecture Diagram and makes no rating claims', () => {
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(block, 'JSON-LD block present');
  const data = JSON.parse(block[1]);
  const byId = Object.fromEntries(data['@graph'].map(node => [node['@id'], node]));
  const app = byId[`${SITE}/#application`];
  const genius = byId[`${SITE}/#genius-ai`];
  assert.equal(app.name, 'Git Architecture Diagram');
  assert.equal(genius.name, 'Genius AI');
  assert.equal(genius.isPartOf['@id'], app['@id']);
  assert.equal(app.hasPart['@id'], genius['@id']);
  assert.match(genius.description, /integrated AI engineering engine of Git Architecture Diagram/);
  // No invented reviews or ratings: the site has none to report.
  assert.doesNotMatch(block[1], /aggregateRating|review/i);
});

test('the Pro_Amine card carries the Genius AI vision below its call to action, and nothing else in the footer changed', () => {
  const card = html.match(/<section class="footer-card brand-card"[\s\S]*?<\/section>/)[0];
  const cta = card.indexOf('Learn about Pro_Amine</a>');
  const vision = card.indexOf('<div class="genius-vision">');
  assert.ok(cta > 0 && vision > cta, 'vision follows the button');
  for (const text of ['Make Any Product with Genius AI', 'From an idea to an engineering blueprint.', 'Imagine it. Design it. Develop it. Validate it.']) assert.ok(card.includes(text), text);
  assert.equal((html.match(/class="genius-vision"/g) || []).length, 1, 'only the first footer card gets the section');
});

test('the home page offers the two paths and the engine flow from the mission layout', () => {
  const welcome = html.match(/<section id="welcome"[\s\S]*?<div id="starter-examples"/)[0];
  const order = ['Make Any Product with <span class="mission-accent">Genius AI</span>', 'Imagine It. Design It. Develop It. Validate It.', 'Start from an Idea', 'Import GitHub Project', 'Genius AI Engineering Engine', 'Requirements · Reasoning · Design · Architecture', 'Validation Reports', 'Engineering Files', 'System Diagrams', 'id="hero-slot"'];
  let last = -1; for (const text of order) { const at = welcome.indexOf(text); assert.ok(at > last, text); last = at; }
  assert.match(welcome, /<a class="mission-card primary" id="mission-idea" href="\/new" data-internal>/, 'the primary path opens /new');
  assert.equal((welcome.match(/<h1\b/g) || []).length, 1, 'one main heading on the home page');
});
