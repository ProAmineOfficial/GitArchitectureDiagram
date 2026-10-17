// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-ENGINEERING-001
// Project: Git Architecture Diagram | Component: Genius ToolHub, the domain-adapter registry and job contract, as pure
// functions (no DOM, no network, no process execution), so the browser and the Node tests share them.
//
// The ToolHub is the public integration spine: it describes what each engineering domain adapter can do, and whether it
// can actually run here and now. It never executes generated code or external tools itself; an adapter with a real
// backend provides an execute() and runs in its own worker. The honest part is readiness: an adapter is "available"
// only when its code exists here and its required tools, credentials, and approvals are all present. Everything else is
// reported as planned, needs_tool, needs_credentials, needs_approval, or unavailable, so the interface never shows a
// control that cannot work. Proprietary planning and model-routing belong in the private engine, not in this registry.

export const TOOLHUB_SCHEMA = 'gad.toolhub/1';
export const JOB_SCHEMA = 'gad.toolhub.job/1';

/** Readiness, most ready first. "available" is the only state an adapter may actually run in. */
export const READINESS = Object.freeze(['available', 'needs_credentials', 'needs_tool', 'needs_approval', 'planned', 'unavailable']);
export const READINESS_LABEL = Object.freeze({
  available: 'Available',
  needs_credentials: 'Needs credentials',
  needs_tool: 'Needs a tool that is not installed',
  needs_approval: 'Needs owner approval',
  planned: 'Planned (not implemented here)',
  unavailable: 'Unavailable',
});

const isString = value => typeof value === 'string' && value.length > 0;
const list = value => (Array.isArray(value) ? value : []);
const nameOf = entry => (typeof entry === 'string' ? entry : entry?.name);

/** Shape problems in an adapter descriptor; an empty list means it is usable. */
export function checkAdapterShape(adapter) {
  const problems = [];
  if (!isString(adapter?.id)) problems.push('id is required');
  if (!isString(adapter?.version)) problems.push('version is required');
  if (!list(adapter?.domains).length) problems.push('at least one domain is required');
  const capabilities = list(adapter?.capabilities);
  if (!capabilities.length) problems.push('at least one capability is required');
  const ids = new Set();
  for (const capability of capabilities) {
    if (!isString(capability?.id)) { problems.push('every capability needs an id'); continue; }
    if (ids.has(capability.id)) problems.push(`capability ${capability.id}: listed twice`);
    ids.add(capability.id);
  }
  if (adapter?.execute != null && typeof adapter.execute !== 'function') problems.push('execute must be a function when present');
  if (adapter?.status != null && !READINESS.includes(adapter.status)) problems.push(`status must be one of ${READINESS.join(', ')}`);
  return problems;
}

/** Freeze a validated adapter descriptor, filling the optional fields. Throws when the shape is wrong. */
export function defineAdapter(descriptor) {
  const problems = checkAdapterShape(descriptor);
  if (problems.length) throw new Error(`Invalid adapter ${descriptor?.id || '(no id)'}: ${problems.join('; ')}`);
  const adapter = {
    id: descriptor.id,
    version: descriptor.version,
    displayName: descriptor.displayName || descriptor.id,
    domains: Object.freeze([...descriptor.domains]),
    capabilities: Object.freeze(descriptor.capabilities.map(capability => Object.freeze({ id: capability.id, summary: capability.summary || '', input: capability.input || null, output: capability.output || null }))),
    supportedInputs: Object.freeze([...list(descriptor.supportedInputs)]),
    supportedOutputs: Object.freeze([...list(descriptor.supportedOutputs)]),
    requiredTools: Object.freeze(list(descriptor.requiredTools).map(tool => Object.freeze({ name: nameOf(tool), purpose: tool?.purpose || '' }))),
    requiredCredentials: Object.freeze(list(descriptor.requiredCredentials).map(nameOf)),
    requiresApproval: descriptor.requiresApproval || null,
    dependencies: Object.freeze(list(descriptor.dependencies)),
    environment: descriptor.environment || 'in-process (pure functions)',
    validationMethods: Object.freeze([...list(descriptor.validationMethods)]),
    resourceLimits: Object.freeze({ ...(descriptor.resourceLimits || {}) }),
    securityPolicy: descriptor.securityPolicy || '',
    exportLayout: descriptor.exportLayout || null,
    provenance: descriptor.provenance || null,
    notes: descriptor.notes || '',
    status: descriptor.status || null, // A forced status (planned, needs_approval) that overrides the computed one.
    execute: typeof descriptor.execute === 'function' ? descriptor.execute : null,
  };
  return Object.freeze(adapter);
}

const capabilityIds = adapter => adapter.capabilities.map(capability => capability.id);
const hasCapability = (adapter, capability) => capabilityIds(adapter).includes(capability);

/** What the environment offers: installed tools, held credentials, and granted approvals. Nothing by default. */
export const emptyEnvironment = Object.freeze({ tools: Object.freeze([]), credentials: Object.freeze([]), approvals: Object.freeze([]) });
const present = (env, key) => new Set(list(env?.[key]).map(nameOf));

/**
 * The honest readiness of an adapter in an environment, with the specific blockers.
 * An adapter with no execute() is "planned": the code to run it does not exist here, whatever tools are installed.
 */
export function readinessOf(adapter, env = emptyEnvironment) {
  if (adapter.status && adapter.status !== 'available') return { readiness: adapter.status, label: READINESS_LABEL[adapter.status], blockers: [adapter.notes || READINESS_LABEL[adapter.status]] };
  if (!adapter.execute) return { readiness: 'planned', label: READINESS_LABEL.planned, blockers: ['No backend is implemented here yet.'] };
  const blockers = [];
  if (adapter.requiresApproval && !present(env, 'approvals').has(adapter.requiresApproval)) return { readiness: 'needs_approval', label: READINESS_LABEL.needs_approval, blockers: [`Needs owner approval: ${adapter.requiresApproval}.`] };
  const credentials = present(env, 'credentials');
  const missingCredentials = adapter.requiredCredentials.filter(credential => !credentials.has(credential));
  if (missingCredentials.length) return { readiness: 'needs_credentials', label: READINESS_LABEL.needs_credentials, blockers: missingCredentials.map(credential => `Missing credential: ${credential}.`) };
  const tools = present(env, 'tools');
  const missingTools = adapter.requiredTools.map(tool => tool.name).filter(tool => !tools.has(tool));
  if (missingTools.length) return { readiness: 'needs_tool', label: READINESS_LABEL.needs_tool, blockers: missingTools.map(tool => `Tool not installed: ${tool}.`) };
  return { readiness: 'available', label: READINESS_LABEL.available, blockers };
}

/** A registry over a set of adapters: registration, lookup, and capability discovery. */
export function createRegistry(adapters = []) {
  const map = new Map();
  const register = adapter => {
    const defined = Object.isFrozen(adapter) && adapter.capabilities ? adapter : defineAdapter(adapter);
    if (map.has(defined.id)) throw new Error(`Adapter ${defined.id} is already registered.`);
    map.set(defined.id, defined);
    return defined;
  };
  for (const adapter of adapters) register(adapter);
  return {
    schema: TOOLHUB_SCHEMA,
    register,
    get: id => map.get(id) || null,
    list: () => [...map.values()],
    ids: () => [...map.keys()],
    /** Adapters that serve a domain and/or a capability, in registration order. */
    find: ({ domain, capability } = {}) => [...map.values()].filter(adapter => (!domain || adapter.domains.includes(domain)) && (!capability || hasCapability(adapter, capability))),
    /** Readiness cards for the whole registry, for an overview panel. */
    cards: (env = emptyEnvironment) => [...map.values()].map(adapter => adapterCard(adapter, env)),
  };
}

/** A compact, UI-ready view of an adapter in an environment. */
export function adapterCard(adapter, env = emptyEnvironment) {
  const state = readinessOf(adapter, env);
  return {
    id: adapter.id,
    displayName: adapter.displayName,
    domains: [...adapter.domains],
    capabilities: capabilityIds(adapter),
    requiredTools: adapter.requiredTools.map(tool => tool.name),
    readiness: state.readiness,
    label: state.label,
    blockers: state.blockers,
    runnable: state.readiness === 'available',
  };
}

/** A job addressed to one adapter capability. */
export function makeJob(adapter, capability, input = {}) {
  return { schema: JOB_SCHEMA, adapter: typeof adapter === 'string' ? adapter : adapter?.id, capability, input };
}
const jobOk = (adapter, capability, output) => ({ ok: true, schema: JOB_SCHEMA, adapter, capability, output, evidence: { via: 'adapter', verified: false } });
const jobError = (adapter, capability, kind, message) => ({ ok: false, schema: JOB_SCHEMA, adapter, capability, error: { kind, message } });

/** Shape problems in a job against a registry; an empty list means it can be dispatched. */
export function validateJob(registry, job) {
  const problems = [];
  if (job?.schema !== JOB_SCHEMA) problems.push(`schema must be ${JOB_SCHEMA}`);
  const adapter = registry.get(job?.adapter);
  if (!adapter) { problems.push(`no adapter "${job?.adapter}"`); return problems; }
  if (!hasCapability(adapter, job?.capability)) problems.push(`adapter ${adapter.id} has no capability "${job?.capability}" (has ${capabilityIds(adapter).join(', ')})`);
  return problems;
}

/**
 * Dispatch a job. It runs only when the adapter is "available" in this environment; otherwise it returns an error that
 * names the blocker, so a caller never mistakes "cannot run here" for a result. A run is never marked verified: running
 * a tool is not the same as an engineering check passing (evidence.verified stays false at this layer).
 */
export async function runJob(registry, job, { env = emptyEnvironment, ctx = {} } = {}) {
  const problems = validateJob(registry, job);
  if (problems.length) return jobError(job?.adapter, job?.capability, 'invalid_job', problems[0]);
  const adapter = registry.get(job.adapter);
  const state = readinessOf(adapter, env);
  if (state.readiness !== 'available') return jobError(adapter.id, job.capability, state.readiness, state.blockers[0]);
  try {
    const output = await adapter.execute(job.capability, job.input, ctx);
    return jobOk(adapter.id, job.capability, output);
  } catch (error) {
    return jobError(adapter.id, job.capability, 'execution_failed', error?.message || 'The adapter failed.');
  }
}
