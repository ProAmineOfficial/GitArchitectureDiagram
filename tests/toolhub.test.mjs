// Project: Git Architecture Diagram | Unit tests: the Genius ToolHub registry and job contract (public/toolhub.js) and the adapter catalogue (public/adapters.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOLHUB_SCHEMA, JOB_SCHEMA, READINESS, checkAdapterShape, defineAdapter, createRegistry, readinessOf, adapterCard, makeJob, validateJob, runJob, emptyEnvironment } from '../public/toolhub.js';
import { CATALOG, defaultRegistry, nanokitElectronicsAdapter, PLANNED_ADAPTERS } from '../public/adapters.js';
import { checkWiring, validatePinUse } from '../public/boards.js';

const nanokit = JSON.parse(readFileSync('public/assets/boards/nanokit-integrated-esp32.pinout.json', 'utf8'));
const ultrasonic = [
  { name: 'ULTRASONIC_TRIG', component: 'Ultrasonic sensor', componentPin: 'TRIG', role: 'trigger', pin: 36 },
  { name: 'ULTRASONIC_ECHO', component: 'Ultrasonic sensor', componentPin: 'ECHO', role: 'echo', pin: 2, signalVoltage: 5 },
];

test('an adapter descriptor is validated and frozen; a malformed one is refused with reasons', () => {
  assert.deepEqual(checkAdapterShape({ id: 'x', version: '1', domains: ['d'], capabilities: [{ id: 'c' }] }), []);
  assert.deepEqual(checkAdapterShape({ version: '1', domains: [], capabilities: [{ id: 'c' }, { id: 'c' }] }), ['id is required', 'at least one domain is required', 'capability c: listed twice']);
  assert.deepEqual(checkAdapterShape({ id: 'x', version: '1', domains: ['d'], capabilities: [{ id: 'c' }], execute: 'nope' }), ['execute must be a function when present']);
  assert.throws(() => defineAdapter({ id: 'bad' }), /Invalid adapter bad/);
  const frozen = defineAdapter({ id: 'x', version: '1', domains: ['d'], capabilities: [{ id: 'c' }] });
  assert.ok(Object.isFrozen(frozen) && Object.isFrozen(frozen.capabilities));
  assert.equal(frozen.execute, null);
});

test('readiness is honest: no backend means planned, whatever tools are installed', () => {
  const noBackend = defineAdapter({ id: 'n', version: '1', domains: ['d'], capabilities: [{ id: 'c' }], requiredTools: [{ name: 'kicad-cli' }] });
  assert.equal(readinessOf(noBackend).readiness, 'planned');
  assert.equal(readinessOf(noBackend, { tools: ['kicad-cli'] }).readiness, 'planned', 'a tool without code still cannot run');
  const withBackend = defineAdapter({ id: 'w', version: '1', domains: ['d'], capabilities: [{ id: 'c' }], requiredTools: [{ name: 'kicad-cli' }], execute: () => 1 });
  assert.equal(readinessOf(withBackend).readiness, 'needs_tool');
  assert.match(readinessOf(withBackend).blockers[0], /Tool not installed: kicad-cli/);
  assert.equal(readinessOf(withBackend, { tools: ['kicad-cli'] }).readiness, 'available');
  const credentialled = defineAdapter({ id: 'cr', version: '1', domains: ['d'], capabilities: [{ id: 'c' }], requiredCredentials: ['openai'], execute: () => 1 });
  assert.equal(readinessOf(credentialled).readiness, 'needs_credentials');
  assert.equal(readinessOf(credentialled, { credentials: ['openai'] }).readiness, 'available');
  const gated = defineAdapter({ id: 'g', version: '1', domains: ['d'], capabilities: [{ id: 'c' }], requiresApproval: 'owner', execute: () => 1 });
  assert.equal(readinessOf(gated).readiness, 'needs_approval');
  assert.equal(readinessOf(gated, { approvals: ['owner'] }).readiness, 'available');
  const forced = defineAdapter({ id: 'f', version: '1', domains: ['d'], capabilities: [{ id: 'c' }], status: 'unavailable', execute: () => 1 });
  assert.equal(readinessOf(forced).readiness, 'unavailable', 'a forced status overrides the computed one');
});

test('the registry registers, looks up, and discovers by domain and capability', () => {
  const registry = defaultRegistry();
  assert.equal(registry.schema, TOOLHUB_SCHEMA);
  assert.equal(registry.get('electronics-nanokit').id, 'electronics-nanokit');
  assert.equal(registry.get('nope'), null);
  assert.ok(registry.find({ domain: 'electronics' }).some(adapter => adapter.id === 'electronics-nanokit'));
  assert.deepEqual(registry.find({ capability: 'check-wiring' }).map(adapter => adapter.id), ['electronics-nanokit']);
  assert.ok(registry.find({ domain: 'semiconductor' }).some(adapter => adapter.id === 'semiconductor-eda'));
  assert.throws(() => registry.register(nanokitElectronicsAdapter), /already registered/);
  assert.equal(new Set(registry.ids()).size, registry.ids().length, 'unique ids');
});

test('exactly one adapter is available in an empty environment, and it is the NanoKit electronics one', () => {
  const registry = defaultRegistry();
  const cards = registry.cards(emptyEnvironment);
  const runnable = cards.filter(card => card.runnable);
  assert.deepEqual(runnable.map(card => card.id), ['electronics-nanokit']);
  for (const card of cards) {
    assert.ok(READINESS.includes(card.readiness), card.id);
    if (!card.runnable) assert.ok(card.blockers.length > 0, `${card.id} explains why it cannot run`);
  }
  // Every planned adapter stays non-runnable even when its tools are all installed, because no backend exists.
  const everyTool = { tools: PLANNED_ADAPTERS.flatMap(adapter => adapter.requiredTools.map(tool => tool.name)), credentials: ['openai', 'deepseek'], approvals: [] };
  for (const adapter of PLANNED_ADAPTERS) assert.notEqual(readinessOf(adapter, everyTool).readiness, 'available', adapter.id);
});

test('the NanoKit adapter really runs and returns the same results as the underlying checks', async () => {
  const registry = defaultRegistry();
  const wiring = await runJob(registry, makeJob('electronics-nanokit', 'check-wiring', { board: nanokit, connections: ultrasonic }));
  assert.equal(wiring.ok, true);
  assert.equal(wiring.schema, JOB_SCHEMA);
  assert.equal(wiring.evidence.verified, false, 'running the adapter is not an electrical verification');
  assert.deepEqual(wiring.output, checkWiring(nanokit, ultrasonic));
  assert.equal(wiring.output.verdict, 'requires_external_adaptation');
  const pin = await runJob(registry, makeJob('electronics-nanokit', 'validate-pin', { board: nanokit, gpio: 34, role: 'led' }));
  assert.deepEqual(pin.output, validatePinUse(nanokit, { board: nanokit, gpio: 34, role: 'led' }));
  assert.equal(pin.output.verdict, 'forbidden');
  const header = await runJob(registry, makeJob('electronics-nanokit', 'pin-header', { board: nanokit, connections: ultrasonic }));
  assert.match(header.output, /#define PIN_ULTRASONIC_TRIG 5 /);
});

test('a job is refused when the adapter cannot run here, and the error names the blocker — never a fake result', async () => {
  const registry = defaultRegistry();
  const kicad = await runJob(registry, makeJob('pcb-kicad', 'erc', { board: nanokit }));
  assert.equal(kicad.ok, false);
  assert.equal(kicad.error.kind, 'planned');
  const sem = await runJob(registry, makeJob('semiconductor-eda', 'synthesize', {}));
  assert.equal(sem.ok, false);
  assert.ok(['planned', 'needs_approval', 'needs_tool'].includes(sem.error.kind));
  const rep = await runJob(registry, makeJob('reverse-engineer', 'inspect', {}));
  assert.equal(rep.ok, false, 'REP has no backend here and runs nothing');
  assert.equal(registry.get('reverse-engineer').execute, null);
});

test('job validation rejects an unknown adapter or capability, and a bad input surfaces as an execution error', async () => {
  const registry = defaultRegistry();
  assert.deepEqual(validateJob(registry, makeJob('electronics-nanokit', 'check-wiring', {})), []);
  assert.match(validateJob(registry, makeJob('ghost', 'x'))[0], /no adapter "ghost"/);
  assert.match(validateJob(registry, makeJob('electronics-nanokit', 'teleport'))[0], /no capability "teleport"/);
  assert.equal((await runJob(registry, makeJob('ghost', 'x'))).error.kind, 'invalid_job');
  const missingBoard = await runJob(registry, makeJob('electronics-nanokit', 'check-wiring', { connections: ultrasonic }));
  assert.equal(missingBoard.ok, false); assert.equal(missingBoard.error.kind, 'execution_failed'); assert.match(missingBoard.error.message, /board.*required/);
});

test('the catalogue is well-formed, every id is unique, and a general adapter proves the model is not NanoKit-specific', () => {
  for (const adapter of CATALOG) assert.deepEqual(checkAdapterShape(adapter), [], adapter.id);
  assert.equal(new Set(CATALOG.map(adapter => adapter.id)).size, CATALOG.length);
  assert.ok(CATALOG.length >= 10, 'the roadmap domains are all registered as adapters');
  const fake = defineAdapter({ id: 'fake', version: '1', domains: ['test'], capabilities: [{ id: 'go' }], requiredTools: [{ name: 'make-believe' }], execute: () => 'ran' });
  const registry = createRegistry([fake]);
  assert.equal(readinessOf(fake, { tools: ['make-believe'] }).readiness, 'available');
  return runJob(registry, makeJob('fake', 'go'), { env: { tools: ['make-believe'] } }).then(result => assert.deepEqual(result.output, 'ran'));
});
