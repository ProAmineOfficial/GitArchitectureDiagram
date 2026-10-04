// Project: Git Architecture Diagram | Security and provenance: secret scanning, export redaction, provenance record, /api/version.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs'; import { execFileSync } from 'node:child_process';
import './support/no-autostart.mjs';
import { createAppServer } from '../server.mjs'; import { createWorker } from '../worker.mjs';
import { PROVENANCE } from '../src/provenance.mjs';
import { buildIdentity } from '../scripts/provenance.mjs';
import { scanTree } from '../scripts/secret-scan.mjs';
import { findSecrets, redactSecrets, redactFiles } from '../public/secret-scan.js';
import { geniusDevelopmentPack } from '../public/knowledge.js';
import { runAnalysis } from '../src/service.mjs'; import { githubFixture } from './fixtures.mjs';

// Credential-shaped values are assembled at run time so this file never contains one literally.
const shape = (prefix, length, alphabet = 'Q7wE9rT2yU4iO6pA8sD1fG3hJ5kL0zX') => prefix + alphabet.repeat(4).slice(0, length);
const FAKE = { 'provider-api-key': shape('sk-proj-', 48), 'anthropic-key': shape('sk-ant-api03-', 40), 'github-token': shape('ghp_', 36), 'google-api-key': shape('AIza', 35), 'aws-access-key': 'AKIA' + 'Q7WE9RT2YU4IO6PA', 'private-key': `-----BEGIN ${'PRIVATE'} KEY-----\n${shape('', 64)}\n-----END ${'PRIVATE'} KEY-----` };
const CORE = ['server.mjs', 'worker.mjs', 'cli.mjs', ...readdirSync('src').filter(name => name.endsWith('.mjs')).map(name => `src/${name}`), ...readdirSync('public').filter(name => name.endsWith('.js')).map(name => `public/${name}`), ...readdirSync('scripts').filter(name => name.endsWith('.mjs')).map(name => `scripts/${name}`), 'public/styles.css', 'public/index.html'];

test('the provenance record is public, complete, identical in both copies, and holds no secrets', () => {
  const file = JSON.parse(readFileSync('PROVENANCE.json', 'utf8')); assert.deepEqual(file, JSON.parse(JSON.stringify(PROVENANCE)));
  for (const key of ['project', 'creator', 'organization', 'canonicalRepository', 'canonicalWebsite', 'firstReleaseYear', 'license', 'provenanceVersion']) assert.ok(file[key], key);
  assert.equal(file.creator, 'Amine Saoud ibn al-Bashir'); assert.equal(file.organization, 'Pro_Amine LLC'); assert.equal(file.license, 'MIT'); assert.equal(file.firstReleaseYear, 2026);
  assert.match(readFileSync('LICENSE', 'utf8'), /^MIT License\n/); assert.deepEqual(findSecrets(JSON.stringify(file)), []);
  const notice = readFileSync('NOTICE.md', 'utf8'); assert.match(notice, /Pro_Amine LLC/); assert.match(notice, /MIT/); for (const name of ['mermaid', 'DOMPurify', 'marked', 'fflate', 'IBM Plex']) assert.match(notice, new RegExp(name), name);
  const guide = readFileSync('PROVENANCE.md', 'utf8'); for (const id of Object.keys(file.identifiers)) assert.match(guide, new RegExp(id), id);
  assert.match(guide, /not a tracking/i);
});

test('every core module carries the copyright header and a documented provenance ID', () => {
  for (const path of CORE) {
    const head = readFileSync(path, 'utf8').split('\n').slice(0, 4).join('\n');
    assert.match(head, /Copyright © 2026 Pro_Amine LLC/, path); assert.match(head, /Created & Developed by Amine Saoud ibn al-Bashir/, path);
    const id = head.match(/Provenance ID: (GAD-[A-Z-]+-\d{3})/)?.[1]; assert.ok(id && Object.hasOwn(PROVENANCE.identifiers, id), `${path}: ${id}`);
  }
});

test('GET /api/version returns the public fingerprint, and npm run provenance recomputes the same digest', async t => {
  const saved = process.env.GAD_COMMIT; process.env.GAD_COMMIT = 'ABCDEF1234567'; t.after(() => { if (saved === undefined) delete process.env.GAD_COMMIT; else process.env.GAD_COMMIT = saved; });
  const server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/version`); assert.equal(response.status, 200); const body = await response.json();
  assert.equal(body.project, 'Git Architecture Diagram'); assert.equal(body.version, JSON.parse(readFileSync('package.json', 'utf8')).version); assert.equal(body.commit, 'abcdef1234567');
  assert.match(body.fingerprint, /^sha256:[0-9a-f]{64}$/); assert.match(body.sourceDigest, /^sha256:[0-9a-f]{64}$/); assert.equal(body.provenanceId, 'GAD-PROVENANCE-CORE-001'); assert.equal(body.license, 'MIT');
  assert.equal(body.sourceDigest, `sha256:${(await buildIdentity()).digest}`, 'the deployed digest can be recomputed from a checkout');
  assert.deepEqual(findSecrets(JSON.stringify(body)), []); assert.ok(!/(_KEY|TOKEN|password)/i.test(JSON.stringify(body)));
  const worker = await (await createWorker().fetch(new Request('https://example.test/api/version'), {})).json(); assert.equal(worker.runtime, 'worker'); assert.match(worker.fingerprint, /^sha256:[0-9a-f]{64}$/);
});

test('the scanner finds high-confidence credentials, reports no values, and ignores obvious fixtures', () => {
  for (const [type, value] of Object.entries(FAKE)) { const found = findSecrets(`const x = "${value}";`); assert.equal(found[0]?.type, type, type); assert.ok(!JSON.stringify(found).includes(value.slice(4, 20))); }
  assert.equal(findSecrets('apiKey: "sk-test-placeholder-0000000000000000000000000000"', { ignoreSynthetic: true }).length, 0);
  assert.equal(findSecrets('headers: { Authorization: `Bearer ${apiKey}` }').length, 0, 'code that builds a header is not a secret');
  assert.equal(findSecrets("write('keys/server.pem', '-----BEGIN PRIVATE KEY-----\\n');").length, 0, 'a bare header has no key material');
});

test('exports replace credential-shaped values with a visible marker, and the Genius pack never contains one', async () => {
  const text = `deploy with ${FAKE['provider-api-key']} and ${FAKE['github-token']}`; const safe = redactSecrets(text);
  assert.equal(safe.count, 2); assert.deepEqual(safe.types.sort(), ['github-token', 'provider-api-key']); assert.match(safe.text, /\[REDACTED:provider-api-key\].*\[REDACTED:github-token\]/); assert.equal(redactSecrets(safe.text).count, 0, 'redaction is idempotent');
  const bundle = redactFiles({ 'a.md': text, 'b.bin': new Uint8Array([1, 2]) }); assert.equal(bundle.count, 2); assert.ok(bundle.files['b.bin'] instanceof Uint8Array);
  const result = await runAnalysis({ repository: 'acme/pack-secret', maxFiles: 10 }, { fetchImpl: githubFixture({ name: 'pack-secret' }).fetchImpl, cachePublic: false, retainSession: false });
  result.repository.description = `Uses ${FAKE['anthropic-key']}`; result.files[0].content += `\nconst key = "${FAKE['provider-api-key']}";\n`; result.readingOrder[0].why += ` ${FAKE['google-api-key']}`;
  const pack = geniusDevelopmentPack(result); const everything = Object.values(pack).join('\n');
  for (const value of Object.values(FAKE)) assert.ok(!everything.includes(value), 'no credential survives in the pack');
  assert.deepEqual(findSecrets(everything), []);
});

test('the repository is clean: no tracked secret-bearing file, no credential in the tree, strict ignore rules, least-privilege CI', () => {
  assert.deepEqual(scanTree(), []);
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n'); assert.ok(!tracked.some(path => /(^|\/)\.env$/.test(path))); assert.ok(tracked.includes('.env.example'));
  const ignore = readFileSync('.gitignore', 'utf8').split('\n'); for (const rule of ['.env', '.env.*', '!.env.example', '*.pem', '*.key', '*.p12', '*.pfx', 'id_rsa', 'id_ed25519', 'credentials.json', 'secrets.json']) assert.ok(ignore.includes(rule), rule);
  for (const line of readFileSync('.env.example', 'utf8').split('\n')) if (/(_KEY|_TOKEN|PASSWORD)=/.test(line)) assert.match(line, /=$/, `${line.split('=')[0]} must be an empty placeholder`);
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8'); assert.match(ci, /^permissions:\n {2}contents: read$/m); assert.ok(!/secrets\./.test(ci)); assert.match(ci, /npm run scan:secrets/); assert.match(ci, /persist-credentials: false/);
});
