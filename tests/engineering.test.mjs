// Project: Git Architecture Diagram | Make Any Product with Genius AI: the public project format, the interface to the
// private Genius Engineering Engine (with a fake engine and a fake provider), the HTTP routes, and the labeled example.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './support/no-autostart.mjs'; // Keep the imported server from opening its production listener.
import { createAppServer } from '../server.mjs';
import { createWorker } from '../worker.mjs';
import { parseRoute } from '../public/route.js';
import { PROJECT_SCHEMA, VALIDATION_SCHEMA, ARTIFACT_STATUS, checkProjectShape, dependencyMermaid, developmentPack, projectMarkdown, validationMarkdown } from '../public/engineering.js';
import { engineConfig, engineeringStatus, validateEngineeringInput, runEngineering, validateEngineering } from '../src/engineering.mjs';

const example = JSON.parse(readFileSync('public/assets/engineering/example-esp32.json', 'utf8'));
const ENGINE = 'https://engine.example';
const ENGINE_TOKEN = 'engine-test-token-0123456789abcdef-0123456789';
const KEY = 'sk-test-visitor-key-not-real-0000';
const env = { GENIUS_ENGINE_URL: ENGINE, GENIUS_ENGINE_TOKEN: ENGINE_TOKEN };
const clone = value => structuredClone(value);
const jsonResponse = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const openaiEnvelope = value => ({ status: 'completed', model: 'gpt-test', output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }], usage: { input_tokens: 10, output_tokens: 20 } });

/** A fake engine (two generation steps, then a project) and a fake OpenAI endpoint, recording every request. */
function fakeNetwork({ steps = 2, engineStatus = 200, engineBody = null, finalProject = example } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null; calls.push({ url: String(url), headers: init.headers || {}, body, raw: init.body || '' });
    if (String(url).startsWith(ENGINE)) {
      if (engineStatus !== 200) return jsonResponse(engineStatus, engineBody || { error: { kind: 'test', message: 'Engine says no.' } });
      const done = String(url).endsWith('/v1/resume') && body.state === `state-${steps}`;
      if (String(url).endsWith('/v1/validate')) return jsonResponse(200, { done: true, project: body.project, validation: body.project.validation });
      if (done) return jsonResponse(200, { done: true, project: finalProject, validation: finalProject.validation });
      const index = String(url).endsWith('/v1/start') ? 1 : Number(body.state.split('-')[1]) + 1;
      return jsonResponse(200, { done: false, state: `state-${index}`, generation: { name: index === 1 ? 'genius_engineering_architecture' : 'genius_engineering_artifacts', instructions: 'Private instructions stay in the engine response only.', payload: { step: index }, schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false }, maxTokens: 4000 } });
    }
    if (String(url).startsWith('https://api.openai.com/')) return jsonResponse(200, openaiEnvelope({ ok: true }));
    throw new Error(`Unexpected request to ${url}`);
  };
  return { calls, fetchImpl };
}
const designInput = () => ({ stage: 'design', provider: 'openai', model: 'gpt-test', apiKey: KEY, project: clone(example), answers: { Q1: 'Yes' } });

test('/new is the idea workspace page; GitHub reserves that path, so it never names an owner', () => {
  assert.deepEqual(parseRoute('/new'), { page: 'idea' });
  assert.deepEqual(parseRoute('/new/'), { page: 'idea' });
  assert.equal(parseRoute('/browse').page, 'browse');
  assert.equal(parseRoute('/acme/demo').page, 'repo');
});

test('the labeled example is a valid gad.project/1 project with an honest validation report', () => {
  assert.deepEqual(checkProjectShape(example), []);
  assert.equal(example.schema, PROJECT_SCHEMA);
  assert.equal(example.validation.schema, VALIDATION_SCHEMA);
  assert.equal(example.provenance.example, true, 'the example is labeled as prepared, not generated');
  const { summary, checks } = example.validation;
  assert.equal(summary.pass + summary.warn + summary.fail + summary.notRun, checks.length);
  assert.equal(summary.fail, 0);
  const build = checks.filter(check => check.tier === 5);
  assert.ok(build.length && build.every(check => check.status === 'not_run'), 'builds are never run on the server');
  assert.ok(build.some(check => /pio run -e /.test(check.recommendation + check.evidence)), 'the build command is given');
  for (const artifact of example.artifacts) {
    assert.ok(Object.hasOwn(ARTIFACT_STATUS, artifact.status), artifact.path);
    assert.ok(!['build_verified', 'simulation_tested', 'tool_verified'].includes(artifact.status), `${artifact.path} claims a verification that never ran`);
    assert.ok(!/\.kicad_(pcb|sch|pro)$/.test(artifact.path), 'no native PCB files without the tool');
  }
  const spec = example.artifacts.find(item => item.path === 'docs/PCB_SPECIFICATION.md');
  assert.equal(spec.status, 'requires_physical_testing');
  assert.ok(!/(password|ssid)\s*=\s*"[^"]+"/i.test(example.artifacts.map(item => item.content).join('\n')), 'no Wi-Fi credentials in source');
});

test('the format check refuses unsafe paths, duplicated IDs, and unknown formats', () => {
  const bad = clone(example);
  bad.artifacts[0].path = '../outside.txt'; bad.components.push(clone(bad.components[0]));
  const problems = checkProjectShape(bad);
  assert.ok(problems.some(problem => /Unsafe file path/.test(problem)));
  assert.ok(problems.some(problem => /Duplicated IDs/.test(problem)));
  assert.match(checkProjectShape({ schema: 'other/1', title: 'x', requirements: [], components: [], artifacts: [] })[0], /Unknown format/);
  assert.deepEqual(checkProjectShape(null), ['The file is not a project object.']);
  for (const path of ['/abs.txt', 'a\\b.txt', 'a//b.txt', './a.txt']) { const item = clone(example); item.artifacts[0].path = path; assert.ok(checkProjectShape(item).some(problem => /Unsafe/.test(problem)), path); }
});

test('the Development Pack keeps every file at its path and adds the project data, overview, diagrams, and report', () => {
  const { folder, files } = developmentPack(example);
  assert.match(folder, /^[a-z0-9-]+$/);
  for (const artifact of example.artifacts) assert.equal(files[`${folder}/${artifact.path}`], artifact.content, artifact.path);
  assert.deepEqual(JSON.parse(files[`${folder}/.genius-project/project.json`]).id, example.id);
  assert.match(files[`${folder}/.genius-project/OVERVIEW.md`], /Example project prepared by Pro_Amine LLC/);
  assert.match(files[`${folder}/.genius-project/VALIDATION_REPORT.md`], /never counted as a pass/);
  assert.match(files[`${folder}/.genius-project/VALIDATION_REPORT.md`], /\| Not run \|/);
  assert.ok(files[`${folder}/.genius-project/diagrams/dependencies.mmd`].startsWith('flowchart LR'));
  assert.equal(Object.keys(files).filter(path => path.includes('/diagrams/')).length, example.diagrams.length + 1);
  assert.ok(Object.keys(files).every(path => !path.split('/').includes('..')));
});

test('the dependency diagram and Markdown views come from the project data, with labels made safe', () => {
  const project = { ...clone(example), components: [{ id: 'C-1', name: 'Sensor "A"\nline', kind: 'sensor' }, { id: 'C2', name: 'MCU', kind: 'mcu', dependsOn: ['C-1'] }], interfaces: [] };
  const mermaid = dependencyMermaid(project);
  assert.match(mermaid, /n_C_1\["Sensor 'A' line"\]/);
  assert.match(mermaid, /n_C_1 -.-> n_C2/);
  assert.match(projectMarkdown(example), /## Requirements[\s\S]*## Components[\s\S]*## Pin map/);
  assert.match(validationMarkdown({ title: 'Empty' }), /has not been validated yet/);
});

test('engine settings accept HTTPS or local HTTP only, never reveal themselves, and need a long token', () => {
  assert.equal(engineConfig({}), null);
  assert.equal(engineConfig({ GENIUS_ENGINE_URL: ENGINE, GENIUS_ENGINE_TOKEN: 'short' }), null);
  assert.equal(engineConfig({ GENIUS_ENGINE_URL: 'http://engine.example', GENIUS_ENGINE_TOKEN: ENGINE_TOKEN }), null);
  assert.equal(engineConfig({ GENIUS_ENGINE_URL: 'https://user:pass@engine.example', GENIUS_ENGINE_TOKEN: ENGINE_TOKEN }), null);
  assert.equal(engineConfig({ GENIUS_ENGINE_URL: 'not a url', GENIUS_ENGINE_TOKEN: ENGINE_TOKEN }), null);
  assert.deepEqual(engineConfig({ GENIUS_ENGINE_URL: 'http://127.0.0.1:8787/', GENIUS_ENGINE_TOKEN: ENGINE_TOKEN }), { url: 'http://127.0.0.1:8787', token: ENGINE_TOKEN });
  assert.deepEqual(engineeringStatus(env), { connected: true });
  assert.deepEqual(engineeringStatus({}), { connected: false });
});

test('requests are validated before anything leaves the server', () => {
  const ok = { stage: 'clarify', provider: 'openai', model: 'gpt-test', apiKey: KEY, idea: 'An ESP32 board with a temperature sensor.' };
  assert.equal(validateEngineeringInput(ok).stage, 'clarify');
  for (const [change, pattern] of [[{ stage: 'build' }, /clarify, design, or regenerate/], [{ provider: 'nope' }, /Choose OpenAI/], [{ model: 'bad model!' }, /Choose a model/], [{ apiKey: '' }, /API key/], [{ idea: 'short' }, /12 to 4,000/], [{ answers: { Q1: 7 } }, /short texts/]]) assert.throws(() => validateEngineeringInput({ ...ok, ...change }), pattern);
  assert.throws(() => validateEngineeringInput({ ...ok, stage: 'design' }), /current project/);
  assert.throws(() => validateEngineeringInput({ ...ok, stage: 'regenerate', project: example }), /Choose a file/);
});

test('without an engine every engineering call answers 503 and nothing is sent', async () => {
  let sent = 0; const fetchImpl = async () => { sent++; return jsonResponse(200, {}); };
  await assert.rejects(runEngineering(designInput(), { env: {}, fetchImpl }), error => error.status === 503 && /not connected/.test(error.message));
  await assert.rejects(validateEngineering({ project: example }, { env: {}, fetchImpl }), error => error.status === 503);
  assert.equal(sent, 0);
});

test('the engine plans and the public server executes: the visitor key reaches only the provider', async () => {
  const { calls, fetchImpl } = fakeNetwork({ steps: 2 }); const events = [];
  const result = await runEngineering(designInput(), { env, fetchImpl, progress: event => events.push(event) });
  assert.equal(result.project.schema, PROJECT_SCHEMA);
  assert.equal(result.usage.length, 2);
  const engine = calls.filter(call => call.url.startsWith(ENGINE)); const provider = calls.filter(call => call.url.startsWith('https://api.openai.com/'));
  assert.deepEqual(engine.map(call => new URL(call.url).pathname), ['/v1/start', '/v1/resume', '/v1/resume']);
  assert.equal(provider.length, 2);
  for (const call of engine) {
    assert.ok(!call.raw.includes(KEY), 'the engine never receives the visitor key');
    assert.ok(!('apiKey' in (call.body || {})));
    assert.equal(call.headers.Authorization, `Bearer ${ENGINE_TOKEN}`);
  }
  for (const call of provider) { assert.ok(JSON.stringify(call.headers).includes(KEY), 'the provider call carries the key'); assert.ok(!JSON.stringify(call.headers).includes(ENGINE_TOKEN), 'the engine token never reaches a provider'); }
  assert.deepEqual(engine[1].body, { state: 'state-1', output: { ok: true } }, 'only the state and the model output go back to the engine');
  assert.ok(events.some(event => event.stage === 'Designing the architecture') && events.some(event => event.stage === 'Writing the engineering files'));
});

test('engine failures map to clear messages; runaway or malformed plans are stopped', async () => {
  const run = options => runEngineering(designInput(), { env, fetchImpl: fakeNetwork(options).fetchImpl });
  await assert.rejects(run({ engineStatus: 401 }), error => error.status === 503 && /GENIUS_ENGINE_TOKEN/.test(error.message));
  await assert.rejects(run({ engineStatus: 400 }), error => error.status === 400 && error.message === 'Engine says no.');
  await assert.rejects(run({ engineStatus: 500 }), error => error.status === 502 && !/Engine says no/.test(error.message));
  await assert.rejects(run({ steps: 99 }), error => error.status === 502 && /too many steps/.test(error.message));
  await assert.rejects(run({ finalProject: { schema: 'other/1' } }), error => error.status === 502 && /unusable project/.test(error.message));
  const badStep = async url => String(url).startsWith(ENGINE) ? jsonResponse(200, { done: false, state: 's', generation: { name: 'x', instructions: 'i', payload: {}, schema: {}, maxTokens: 999999 } }) : jsonResponse(200, {});
  await assert.rejects(runEngineering(designInput(), { env, fetchImpl: badStep }), error => error.status === 502 && /unusable step/.test(error.message));
  const offline = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(runEngineering(designInput(), { env, fetchImpl: offline }), error => error.status === 503 && /could not be reached/.test(error.message));
});

test('validation goes to the engine without any key', async () => {
  const { calls, fetchImpl } = fakeNetwork();
  const result = await validateEngineering({ project: clone(example) }, { env, fetchImpl });
  assert.equal(result.project.id, example.id);
  assert.equal(calls.length, 1); assert.equal(new URL(calls[0].url).pathname, '/v1/validate');
  await assert.rejects(validateEngineering({ project: { schema: 'x' } }, { env, fetchImpl }), error => error.status === 400);
});

test('the Node server exposes status, answers 503 before streaming without an engine, and streams a run with one', async t => {
  const saved = { url: process.env.GENIUS_ENGINE_URL, token: process.env.GENIUS_ENGINE_TOKEN };
  t.after(() => { for (const [name, value] of [['GENIUS_ENGINE_URL', saved.url], ['GENIUS_ENGINE_TOKEN', saved.token]]) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
  delete process.env.GENIUS_ENGINE_URL; delete process.env.GENIUS_ENGINE_TOKEN;
  const network = fakeNetwork();
  const server = createAppServer({ fetchImpl: network.fetchImpl });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const status = await (await fetch(`${base}/api/engineering/status`)).json();
  assert.deepEqual(status, { connected: false }, 'only a boolean is public');
  const refused = await post('/api/engineering/run', designInput());
  assert.equal(refused.status, 503); assert.match((await refused.json()).error, /not connected/);
  const large = await post('/api/engineering/validate', { project: { ...clone(example), padding: 'x'.repeat(200000) } });
  assert.equal(large.status, 503, 'engineering bodies may exceed the 20 KB default limit');

  process.env.GENIUS_ENGINE_URL = ENGINE; process.env.GENIUS_ENGINE_TOKEN = ENGINE_TOKEN;
  assert.deepEqual(await (await fetch(`${base}/api/engineering/status`)).json(), { connected: true });
  const bad = await post('/api/engineering/run', { ...designInput(), stage: 'nope' });
  assert.equal(bad.status, 400);
  const run = await post('/api/engineering/run', designInput());
  assert.equal(run.status, 200); assert.match(run.headers.get('content-type'), /application\/x-ndjson/);
  const events = (await run.text()).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(events.at(-1).type, 'result'); assert.equal(events.at(-1).result.project.schema, PROJECT_SCHEMA);
  assert.ok(events.some(event => event.type === 'progress'));
  assert.ok(!JSON.stringify(events).includes(KEY), 'the key is never echoed back');
  const validated = await post('/api/engineering/validate', { project: clone(example) });
  assert.equal(validated.status, 200); assert.equal((await validated.json()).project.id, example.id);
});

test('the hosted Worker exposes the same status and refuses runs without an engine', async () => {
  const worker = createWorker();
  const call = (path, init, environment = {}) => worker.fetch(new Request(`https://diagram.example${path}`, init), environment, { waitUntil() {} });
  assert.deepEqual(await (await call('/api/engineering/status', { method: 'GET' })).json(), { connected: false });
  assert.deepEqual(await (await call('/api/engineering/status', { method: 'GET' }, env)).json(), { connected: true });
  const refused = await call('/api/engineering/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(designInput()) });
  assert.equal(refused.status, 503);
  const validate = await call('/api/engineering/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: { ...clone(example), padding: 'x'.repeat(100000) } }) });
  assert.equal(validate.status, 503, 'engineering bodies may exceed the 20 KB default limit');
});
