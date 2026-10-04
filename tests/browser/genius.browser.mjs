// Project: Git Architecture Diagram | Browser tests: providers, Deep Genius, System Map 2.0 tour, Export Project 2.0, footer.
// Run with: npm run test:browser. Self-contained: a temporary Git repository behind the GitHub REST emulator and a
// deterministic model in OpenAI's and DeepSeek's documented response shapes. No network and no real credentials.
import test from 'node:test'; import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { unzipSync, strFromU8 } from 'fflate';
import '../support/no-autostart.mjs';
import { createAppServer } from '../../server.mjs';
import { createGitHubFetch } from '../support/github-emulator.mjs';
import { PROVIDERS } from '../../public/providers.js';

const dir = mkdtempSync(join(tmpdir(), 'gad-genius-'));
const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
const write = (path, text) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'Test');
write('README.md', '# Shop\nAn online shop with a web storefront and an API.\n');
write('package.json', JSON.stringify({ name: 'shop', main: 'server/index.js', dependencies: { express: '4', react: '18', pg: '8' } }));
write('server/index.js', "import { route } from './routes/api.js';\nimport express from 'express';\nexpress().use(route);\n");
write('server/routes/api.js', "import { auth } from '../auth/token.js';\nimport { db } from '../db/store.js';\nexport const route = (request, response) => response.json(db);\n");
write('server/auth/token.js', 'export const auth = token => token.length > 20;\n');
write('server/db/store.js', "import pg from 'pg';\nexport const db = new pg.Pool();\n");
write('web/App.jsx', "import React from 'react';\nexport default function App() { return null; }\n");
write('test/api.test.js', "import { route } from '../server/routes/api.js';\n");
write('.github/workflows/ci.yml', 'on: push\n');
git('add', '.'); git('commit', '-q', '-m', 'shop');

const ev = (path, line, quote) => ({ path, line, quote, basis: 'observed' });
const agentOutput = (stage, payload) => {
  const agent = String(payload.agent || '').slice(0, 2);
  if (stage === 'audit') return { summary: `${agent} review.`, findings: agent === '1A' ? [{ id: 'A1', severity: 'high', title: 'Token check only tests length', description: 'auth accepts any token longer than 20 characters.', files: ['server/auth/token.js'], evidence: [ev('server/auth/token.js', 1, 'export const auth = token => token.length > 20;')], confidence: 'high', whyItMatters: 'Any long string is accepted.', validation: 'Add a test with a forged token.', category: 'security' }] : agent === '1B' ? [{ id: 'B1', severity: 'medium', title: 'The route returns the database pool', description: 'route serializes db directly.', files: ['server/routes/api.js'], evidence: [ev('server/routes/api.js', 3, 'export const route = (request, response) => response.json(db);')], confidence: 'medium', whyItMatters: 'Leaks internals.', validation: 'Call the route in a test.', category: 'architecture' }] : [{ id: 'C1', severity: 'low', title: 'Secrets file is committed', description: 'Invented.', files: ['server/secrets.js'], evidence: [ev('server/secrets.js', 1, 'secret')], confidence: 'low', whyItMatters: '', validation: '', category: 'security' }], evidenceRequests: [], limitations: [] };
  if (stage === 'solve') return { summary: 'Solutions.', solutions: payload.findings.slice(0, 2).map((finding, index) => ({ id: `S${index + 1}`, findingIds: [finding.id], kind: agent === '2C' ? 'innovation' : 'fix', required: agent !== '2C', title: `${agent} plan for ${finding.title}`, description: 'A minimal change.', files: finding.files, newFiles: [], steps: ['Change one function.'], tests: ['Add one test.'], migrationRisk: 'low', order: index + 1, compatibility: 'Compatible.', evidence: finding.evidence.slice(0, 1).map(item => ({ path: item.path, line: item.line, quote: item.quote, basis: 'observed' })), confidence: 'medium', response: '' })), limitations: [] };
  if (stage === 'validate') return { summary: 'Validated.', verdicts: payload.solutions.map(item => ({ solutionId: item.id, verdict: item.kind === 'innovation' ? 'REJECTED' : 'APPROVED', reason: item.kind === 'innovation' ? 'Optional and unproven.' : 'Minimal and correct.', risk: 'low', missingValidation: '', findingIds: item.findingIds, evidence: [] })) };
  if (stage === 'compare') return { summary: 'Compared.', comparisons: payload.approvedSolutions.slice(0, 1).map(item => ({ findingIds: item.findingIds, recommendedSolutionId: item.id, alternativeSolutionIds: [], tradeoffs: 'Small.', complexity: 'low', migrationRisk: 'low', expectedBenefit: 'Safer auth.', confidence: 'high' })), limitations: [] };
  if (stage === 'document') return { overview: 'A shop: storefront, API, token check, and PostgreSQL.', onboarding: 'Start at server/index.js.', flows: [{ title: 'Request', steps: ['index mounts the route'], files: ['server/index.js'] }], tour: [], architectureNotes: [], implementationNotes: [], limitations: [] };
  if (stage === 'devpack') return { essentialFiles: [{ path: 'server/index.js', why: 'Entry point.' }], readingOrder: [], recommendedSkills: [{ skill: 'Token authentication', reason: 'The token check is weak.', relatedModules: ['server/auth'], confidence: 'high' }], purpose: 'An online shop.', constraints: [], conventions: ['ES modules'], doNotBreak: ['The route export'], blueprint: [], roadmap: [], testStrategy: [], configuration: [], dependencies: [], reconstruction: [], limitations: [] };
  return { overview: 'Genius: a small shop with a weak token check.', systemFlow: [], nextActions: [], limitations: [] };
};
const openaiEnvelope = payload => Response.json({ status: 'completed', model: 'gpt-6-luna', usage: { input_tokens: 120, output_tokens: 40 }, output: [{ content: [{ type: 'output_text', text: JSON.stringify(payload) }] }] });
const modelCall = async (url, options = {}) => {
  const target = new URL(url); const auth = options.headers?.Authorization || '';
  if (target.pathname.endsWith('/models')) return auth.includes('bad') ? Response.json({ error: { message: 'invalid' } }, { status: 401 }) : Response.json({ data: [...PROVIDERS.openai.models, ...PROVIDERS.deepseek.models].map(id => ({ id })) });
  if (auth.includes('quota')) return Response.json({ error: { code: 'insufficient_quota', message: 'billing details sk-secret' } }, { status: 429 });
  const body = JSON.parse(options.body);
  if (target.hostname === 'api.deepseek.com') return Response.json({ model: body.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ ok: true }) } }] });
  const name = body.text?.format?.name;
  if (name === 'connection_check') return openaiEnvelope({ ok: true });
  if (name?.startsWith('genius_') && name !== 'genius_architecture') return openaiEnvelope(agentOutput(name.slice(7) === 'revise' ? 'solve' : name.slice(7), JSON.parse(body.input)));
  return openaiEnvelope({ overview: 'A shop.', components: [], relationships: [], recommendations: [], limitations: [], graph: { groups: [], nodes: [{ id: 'user', label: 'Shopper', detail: '', kind: 'actor', group: '', path: '' }, { id: 'api', label: 'API', detail: '', kind: 'service', group: '', path: 'server/routes/api.js' }], edges: [{ from: 'user', to: 'api', label: 'HTTP request', basis: 'inferred', evidencePath: '', evidenceLine: 0 }], tour: [{ node: 'user', stage: 'start', text: 'A shopper opens the store.', files: [], basis: 'inferred' }, { node: 'api', stage: 'entry', text: 'The API answers.', files: ['server/routes/api.js'], basis: 'observed' }, { node: 'user', stage: 'output', text: 'Orders come back.', files: [], basis: 'inferred' }] } });
};
for (const key of ['GENIUS_PUBLIC_AI', 'OPENAI_API_KEY', 'GENIUS_MODEL']) delete process.env[key];
const server = createAppServer({ fetchImpl: createGitHubFetch({ 'acme/shop': { dir, description: 'Online shop' } }, { fallback: modelCall }) });
let base; let browser; const errors = [];
test.before(async () => { await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`; browser = await chromium.launch(); });
test.after(async () => { await browser?.close(); server.close(); rmSync(dir, { recursive: true, force: true }); });
async function open(path = '/acme/shop', { viewport = { width: 1440, height: 940 }, reducedMotion = 'no-preference', colorScheme = 'dark' } = {}) {
  const context = await browser.newContext({ viewport, acceptDownloads: true, reducedMotion, colorScheme }); await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + path); if (path !== '/') await page.waitForSelector('#workspace:not([hidden]) #diagram-content svg', { timeout: 30000 }); else await page.waitForSelector('#welcome:not([hidden])');
  return page;
}
const settings = async (page, provider, key) => { await page.click('#settings-open'); await page.selectOption('#provider', provider); if (key !== undefined) await page.fill('#api-key', key); };
const closeSettings = page => page.click('#settings .dialog-actions .primary-button');

test('providers, two recommended models, DeepSeek, and Test connection', async () => {
  const page = await open();
  await page.click('#settings-open');
  assert.deepEqual(await page.locator('#provider option').evaluateAll(options => options.map(option => option.value)), ['openai', 'anthropic', 'gemini', 'kimi', 'deepseek']);
  for (const provider of Object.keys(PROVIDERS)) {
    await page.selectOption('#provider', provider);
    assert.equal(await page.locator('#model-options .model-option').count(), 2, `${provider} shows exactly two models`);
    assert.deepEqual(await page.locator('#model-options code').allTextContents(), PROVIDERS[provider].models);
    assert.equal(await page.inputValue('#model'), PROVIDERS[provider].recommended.fast.id);
  }
  await page.selectOption('#provider', 'deepseek'); assert.match(await page.textContent('#provider-key-label'), /DeepSeek API key/);
  await page.check('#model-options input[value=advanced]'); assert.equal(await page.inputValue('#model'), 'deepseek-v4-pro');
  await page.fill('#api-key', 'sk-good-deepseek-key-000000'); await page.click('#test-connection');
  await page.waitForSelector('#connection-status[data-state=ok]'); assert.match(await page.textContent('#connection-status'), /Connected/); assert.match(await page.textContent('#connection-status'), /Model available/);
  await page.selectOption('#provider', 'openai'); await page.fill('#api-key', 'sk-bad-openai-key-00000000'); await page.click('#test-connection');
  await page.waitForSelector('#connection-status[data-state=error]'); assert.match(await page.textContent('#connection-status'), /Authentication failed/);
  await page.click('.custom-model summary'); await page.fill('#model-custom', 'my-custom-model'); assert.equal(await page.inputValue('#model'), 'my-custom-model');
  await page.context().close();
});

test('a quota 429 is explained professionally and the structural views keep working', async () => {
  const page = await open('/'); await settings(page, 'openai', 'sk-quota-openai-key-000000'); await closeSettings(page);
  await page.click('#options-toggle'); await page.check('[name=analysis-mode][value=genius]'); assert.match(await page.textContent('#ai-cost'), /110,000 characters/);
  await page.fill('#repository', 'acme/shop'); await page.click('#analyze'); await page.waitForSelector('#workspace:not([hidden]) #diagram-content svg', { timeout: 30000 }); await page.click('[data-view=system]');
  await page.waitForSelector('#system-error'); const card = await page.textContent('#system-error');
  assert.match(card, /Provider quota exhausted · OpenAI/); assert.match(card, /quota is exhausted/); assert.ok(!card.includes('sk-secret') && !card.includes('billing details'));
  await page.click('[data-view=architecture]'); await page.waitForSelector('#diagram-content svg'); assert.ok(await page.locator('#diagram-content g.node').count() >= 3);
  await page.context().close();
});

test('Genius modes, Deep Genius confirmation, team progress, results, and agent evidence', async () => {
  const page = await open('/'); await settings(page, 'openai', 'sk-good-openai-key-0000000'); await closeSettings(page);
  await page.click('#options-toggle'); assert.equal(await page.locator('[name=analysis-mode]').count(), 3);
  await page.check('[name=analysis-mode][value=deep]'); assert.match(await page.textContent('#ai-cost'), /asks before Deep Genius starts: up to 25 calls/);
  await page.fill('#repository', 'https://github.com/acme/shop'); await page.click('#analyze'); await page.waitForSelector('#deep-confirm[open]', { timeout: 30000 });
  const plan = await page.textContent('#deep-plan'); assert.match(plan, /OpenAI/); assert.match(plan, /gpt-6-luna \(Fast\)/); assert.match(plan, /25 \(usually about 13\), at most 3 at a time/); assert.match(await page.textContent('#deep-cost'), /may incur cost/);
  await page.click('#deep-confirm-start');
  await page.waitForSelector('#pipeline-view:not([hidden]) .pipe-team'); assert.equal(await page.locator('#pipeline-view .pipe-team').count(), 3); assert.equal(await page.locator('#pipeline-view .pipe-team .agent-card').count(), 9);
  await page.waitForSelector('#deep-state.status-complete', { timeout: 30000 });
  const facts = await page.textContent('.deep-facts'); assert.match(facts, /Teams complete3 of 3/); assert.match(facts, /Findings2 \(2 verified\)/); assert.match(facts, /approved of/);
  assert.equal(await page.locator('#deep-agents .agent-card.state-failed').count(), 0); assert.equal(await page.locator('#deep-agents .agent-card').count(), 10);
  assert.ok(await page.locator('#pipeline-view .pipe-item.verified').count() >= 2); assert.ok(await page.locator('#pipeline-view .pipe-item.inferred').count() >= 1, 'rejected proposals are visible');
  await page.click('#pipeline-view [data-agent="1A"]'); await page.waitForSelector('#agent-dialog[open]');
  assert.match(await page.textContent('#agent-body'), /Token check only tests length/); assert.equal(await page.locator('#agent-body .evidence-verified').count(), 1); assert.ok(!(await page.textContent('#agent-dialog')).toLowerCase().includes('chain of thought:'));
  await page.keyboard.press('Escape');
  assert.equal(await page.isHidden('#deep-badge'), false);
  await page.context().close();
});

test('System Map 2.0: the structural tour explains stages, evidence, and supporting files', async () => {
  const page = await open(); await page.click('[data-view=architecture]'); await page.waitForSelector('#tour-start:not([hidden])');
  await page.click('#tour-start'); await page.waitForSelector('#tour:not([hidden])');
  assert.match(await page.textContent('#tour-count'), /Step 1 of [3-9]/); assert.equal(await page.textContent('#tour-stage'), 'Who starts it'); assert.equal(await page.textContent('#tour-basis'), 'Stated in documentation');
  await page.click('#tour-next'); assert.equal(await page.textContent('#tour-stage'), 'Entry point'); assert.equal(await page.textContent('#tour-basis'), 'Observed in source');
  assert.ok(await page.locator('#tour-files .tour-file').count() >= 1); await page.click('#tour-files .tour-file >> nth=0'); await page.waitForSelector('#file-inspector:not([hidden])'); assert.match(await page.textContent('#file-name'), /index\.js|package\.json/);
  await page.context().close();
});

test('Export Project 2.0: Genius Development Pack, prompt, skills, and Mermaid downloads', async () => {
  const page = await open(); await page.click('[data-view=extract]'); await page.waitForSelector('[data-card=genius-pack]'); await page.click('[data-card=genius-pack] summary');
  const [zip] = await Promise.all([page.waitForEvent('download'), page.click('text=Download Genius Development Pack (.zip)')]);
  assert.match(zip.suggestedFilename(), /gitarchitecture\.zip$/); const entries = unzipSync(readFileSync(await zip.path()));
  for (const name of ['OVERVIEW.md', 'ARCHITECTURE.md', 'SYSTEM_MAP.mmd', 'AUDIT_FINDINGS.md', 'DEVELOPMENT_PROMPT.md', 'DEVELOPMENT_SKILLS.md', 'EVIDENCE.json', 'manifest.json']) assert.ok(entries[`.gitarchitecture/${name}`], name);
  assert.equal(JSON.parse(strFromU8(entries['.gitarchitecture/manifest.json'])).deepGenius.ran, false);
  await page.click('text=Copy Development Prompt'); assert.match(await page.evaluate(() => navigator.clipboard.readText()), /## Known verified problems[\s\S]*## Do not break/);
  const [skills] = await Promise.all([page.waitForEvent('download'), page.click('text=Download Skills')]); assert.match(readFileSync(await skills.path(), 'utf8'), /## Observed development skills[\s\S]*## Recommended development skills/);
  const [system] = await Promise.all([page.waitForEvent('download'), page.click('text=Download System Map Mermaid')]); assert.match(readFileSync(await system.path(), 'utf8'), /^%% No AI system map/);
  await page.context().close();
});

test('no uncaught page errors', () => { assert.deepEqual(errors, []); });
