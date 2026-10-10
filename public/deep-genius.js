// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-GENIUS-PIPELINE-001
// Project: Git Architecture Diagram | Component: Deep Genius panel, confirmation, and process view | Author: Amine Saoud ibn al-Bashir.
// Runs the shared Genius Core orchestrator in the browser: each agent call is one short POST to /api/genius/agent,
// so no request outlives a hosting proxy timeout, and every citation is verified here against the commit the
// workspace already holds. Repository-derived text is always inserted with textContent.
import { runDeepGenius, GeniusError } from './genius-core.js';
import { AGENTS, TEAMS, planDeepGenius, GENIUS_LIMITS } from './genius-agents.js';
import { PROVIDERS, roleOf, ROLE_LABELS } from './providers.js';
import { icon } from './icons.js';

const $ = selector => document.querySelector(selector);
function el(tag, className, text) { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; }
const STATE_LABELS = { queued: 'Queued', reading: 'Reading evidence', analyzing: 'Analyzing', completed: 'Completed', 'needs-revision': 'Needs revision', approved: 'Approved', failed: 'Failed', skipped: 'Skipped' };
const STATE_ICONS = { completed: 'check', approved: 'shield', failed: 'warning', 'needs-revision': 'loop', skipped: 'minus' };
const STAGE_LABELS = { idle: 'Not started', starting: 'Starting', team1: 'Team 1 — Audit', team2: 'Team 2 — Solutions', validation: 'Validation', revision: 'Revision loop', team3: 'Team 3 — Documentation & extraction', synthesis: 'Genius Core synthesis', complete: 'Complete' };
const TEAM_TITLES = { 1: 'Team 1 — Audit & critique', 2: 'Team 2 — Solutions & innovation', 3: 'Team 3 — Documentation, comparison & extraction' };
const KIND_TITLES = { rate_limited: 'Provider busy (rate limited)', quota_exhausted: 'Provider quota exhausted', auth: 'Authentication failed', permission: 'Access denied', model_unavailable: 'Model unavailable', provider_unavailable: 'Provider temporarily unavailable', timeout: 'Provider did not respond in time', network: 'Provider unreachable', blocked: 'Provider blocked by the network', workspace_required: 'Workspace API key required', invalid_request: 'Request not supported by this model', malformed: 'Unexpected provider response', truncated: 'Incomplete provider response', refused: 'Provider refused the request', cancelled: 'Cancelled' };
export const errorTitle = kind => KIND_TITLES[kind] || 'Something went wrong';

let api; let run = null; let scheduled = false;
const deepKey = (result, provider, model) => `${result.repository.fullName}|${result.repository.sha}|${result.repository.scope || ''}|${provider}|${model}|${result.generator?.version || ''}`;

export function setupDeepGenius(workspace) {
  api = workspace;
  $('#deep-confirm').addEventListener('close', () => { if ($('#deep-confirm').returnValue === 'start') start({ allowFallback: $('#deep-fallback').checked }); });
  return { render, reset, confirm, renderPipeline, get running() { return run?.status === 'running'; } };
}

/** Called when the workspace shows a new analysis: restore a finished pack for the same commit and model, or clear. */
function reset() {
  if (run?.status === 'running' && run.commit !== api.state.result?.repository.sha) run.controller.abort();
  const { provider, model } = api.credentials(); const cached = api.state.result && api.state.deepCache?.get(deepKey(api.state.result, provider, model));
  run = cached ? { status: cached.status, pack: cached, events: [], commit: cached.commit, provider: cached.provider, model: cached.model } : null;
  api.state.result && (api.state.result.deep = cached || null);
  render();
}

function schedule() { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; render(); if (api.state.view === 'pipeline') renderPipeline(); }); }

/** Open the confirmation dialog with the planned scope and cost warning. */
function confirm() {
  const { result } = api.state; if (!result) return;
  if (!api.aiConfigured()) { api.toast('Add a provider key in API settings to run Deep Genius.'); api.openSettings(); return; }
  const { provider, model } = api.credentials(); const plan = planDeepGenius(result); const role = roleOf(provider, model);
  const rows = [['Provider', PROVIDERS[provider].name], ['Model', `${model}${role !== 'custom' ? ` (${ROLE_LABELS[role]})` : ' (custom)'}`], ['Maximum planned calls', `${plan.maxCalls} (usually about ${plan.minCalls}), at most ${plan.concurrency} at a time`], ['Validation', `One validation pass, then at most ${plan.revisionLoops} revise-and-revalidate loops`], ['Approximate input scope', `Up to ${plan.perCallCharacters.toLocaleString('en')} characters (about ${plan.perCallTokens.toLocaleString('en')} tokens) per call, drawn from the ${plan.filesRead} files read of ${plan.filesListed} listed`]];
  $('#deep-plan').replaceChildren(...rows.flatMap(([term, value]) => [el('dt', '', term), el('dd', '', value)]));
  $('#deep-cost').textContent = `Provider API usage may incur cost on your ${PROVIDERS[provider].name} account. No price is estimated here, because the provider does not supply reliable pricing to this site. You can cancel at any time; finished agents keep their results.`;
  $('#deep-fallback-label').hidden = role !== 'advanced'; $('#deep-fallback').checked = false;
  $('#deep-confirm').returnValue = ''; $('#deep-confirm').showModal(); $('#deep-confirm-start').focus();
}

/** One agent call through the server. Our own rate limit is retried; provider errors arrive classified. */
function agentCaller({ allowFallback }) {
  const { result } = api.state; const repo = result.repository; const credentials = api.credentials(); const fast = PROVIDERS[credentials.provider]?.recommended.fast.id;
  let model = credentials.model;
  return async ({ agent, stage, payload, signal }) => {
    for (let attempt = 1; ; attempt++) {
      const response = await fetch('/api/genius/agent', { method: 'POST', headers: api.headers(), signal, body: JSON.stringify({ agent, stage, payload, repository: repo.fullName, commit: repo.sha, scope: repo.scope || '', provider: credentials.provider, apiKey: credentials.apiKey, model }) });
      const type = response.headers.get('Content-Type') || ''; const data = type.includes('json') ? await response.json().catch(() => ({})) : {};
      if (response.ok) return data;
      if (response.status === 429 && !data.kind && attempt < 3) { await new Promise(resolve => setTimeout(resolve, 4000 * attempt)); continue; } // This site's own per-minute limit.
      if (data.kind === 'model_unavailable' && allowFallback && model !== fast && roleOf(credentials.provider, model) === 'advanced') { model = fast; api.toast(`The Advanced model is unavailable; continuing with the cheaper Fast model, ${fast}.`); run?.pack && run.pack.warnings?.push(`Switched to ${fast} after the Advanced model was unavailable.`); continue; }
      const error = new Error(data.error || (type.includes('html') ? 'A gateway page answered instead of the application.' : `The agent request failed (HTTP ${response.status}).`)); error.kind = data.kind || (response.status === 401 ? 'auth' : 'error'); error.suggestion = data.suggestion || ''; throw error;
    }
  };
}

async function start({ allowFallback = false } = {}) {
  const { result } = api.state; if (!result || run?.status === 'running') return;
  const { provider, model } = api.credentials(); const controller = new AbortController();
  run = { status: 'running', pack: null, events: [], controller, commit: result.repository.sha, provider, model, stage: 'starting', agents: {}, counts: { findings: 0, solutions: 0, calls: 0 }, error: null };
  render(); api.selectView('pipeline');
  try {
    const pack = await runDeepGenius({ result, provider, model, signal: controller.signal, callAgent: agentCaller({ allowFallback }), onEvent: event => { if (!run || run.controller !== controller) return; run.events.push(event); if (event.type === 'stage') run.stage = event.stage; if (event.type === 'agent') run.agents[event.id] = { status: event.status, detail: event.detail }; if (event.type === 'findings') run.counts.findings = event.count; if (event.type === 'solutions') run.counts.solutions = event.count; if (event.type === 'call') run.counts.calls = event.calls; if (event.type === 'validation') run.validation = event; schedule(); } });
    if (run?.controller !== controller) return;
    Object.assign(run, { status: 'complete', pack, stage: 'complete' }); finishRun(pack); api.toast(`Deep Genius finished: ${pack.findings.length} findings, ${pack.solutions.filter(item => item.status === 'APPROVED').length} validated solutions.`);
  } catch (error) {
    if (run?.controller !== controller) return;
    const pack = error instanceof GeniusError ? error.pack : null; Object.assign(run, { status: error.kind === 'cancelled' ? 'cancelled' : 'failed', pack, error: { message: error.message, kind: error.kind, suggestion: error.suggestion || '' } });
    if (pack) finishRun(pack, false);
  }
  render(); if (api.state.view === 'pipeline') renderPipeline();
}

function finishRun(pack, cache = true) {
  const { result } = api.state; if (!result || result.repository.sha !== pack.commit) return;
  result.deep = pack; if (cache) { api.state.deepCache.set(deepKey(result, pack.provider, pack.model), pack); while (api.state.deepCache.size > 6) api.state.deepCache.delete(api.state.deepCache.keys().next().value); }
  api.onComplete?.(pack);
}

const statusOf = id => run?.agents?.[id]?.status || run?.pack?.agents?.[id]?.status || 'queued';
function stateChip(status) { const chip = el('span', `agent-state state-${status}`); if (STATE_ICONS[status]) chip.append(icon(STATE_ICONS[status])); else chip.append(el('i', 'state-dot')); chip.append(document.createTextNode(STATE_LABELS[status] || status)); return chip; }

function agentCard(id) {
  const spec = AGENTS[id]; const status = statusOf(id); const button = el('button', `agent-card state-${status}`); button.type = 'button'; button.dataset.agent = id;
  button.setAttribute('aria-label', `${spec.title}: ${STATE_LABELS[status] || status}`);
  const head = el('span', 'agent-head'); head.append(el('span', 'agent-id', id === 'core' ? 'GC' : id), el('span', 'agent-name', spec.short));
  button.append(head, stateChip(status)); const detail = run?.agents?.[id]?.detail || run?.pack?.agents?.[id]?.detail; if (detail) button.append(el('span', 'agent-detail', detail));
  button.addEventListener('click', () => openAgent(id));
  return button;
}

function facts() {
  const pack = run?.pack; const { provider, model } = run || api.credentials(); const role = roleOf(provider, model);
  const teamsDone = [1, 2, 3].filter(team => TEAMS[team].every(id => ['completed', 'approved', 'skipped', 'needs-revision', 'failed'].includes(statusOf(id))) && (team !== 1 || ['team2', 'validation', 'revision', 'team3', 'synthesis', 'complete'].includes(run?.stage)) && (team !== 2 || ['team3', 'synthesis', 'complete'].includes(run?.stage))).length;
  const approved = pack ? pack.solutions.filter(item => item.status === 'APPROVED').length : 0;
  const coverage = pack?.coverage;
  return [
    ['Provider', PROVIDERS[provider]?.name || '—'], ['Model', model ? `${model}${role !== 'custom' ? ` · ${ROLE_LABELS[role]}` : ''}` : '—'], ['Analysis mode', 'Deep Genius'],
    ['Current stage', STAGE_LABELS[run?.stage || 'idle'] || run?.stage], ['Teams complete', run ? `${run.status === 'complete' ? 3 : teamsDone} of 3` : '0 of 3'],
    ['Findings', pack ? `${pack.findings.length} (${pack.findings.filter(item => item.evidenceStatus === 'verified').length} verified)` : String(run?.counts?.findings || 0)],
    ['Solutions', pack ? `${approved} approved of ${pack.solutions.length}${pack.unresolved.length ? ` · ${pack.unresolved.length} unresolved` : ''}` : String(run?.counts?.solutions || 0)],
    ['Validation status', pack ? `${pack.loops} of ${GENIUS_LIMITS.revisionLoops} revision loops used` : run?.validation ? `Pass ${run.validation.pass}: ${run.validation.approved} approved, ${run.validation.revise} to revise` : 'Not started'],
    ['Evidence coverage', coverage ? `${coverage.verified} of ${coverage.citations} citations verified · ${coverage.filesCited} files cited of ${coverage.filesRead} read` : '—'],
    ['Model calls', pack ? `${pack.calls}${pack.usage.input ? ` · ${pack.usage.input.toLocaleString('en')} in / ${pack.usage.output.toLocaleString('en')} out tokens` : ''}` : String(run?.counts?.calls || 0)],
  ];
}

/** Render the Deep Genius section of the Genius panel. */
function render() {
  const box = $('#deep-genius'); if (!box) return;
  if (!api.state.result) { box.replaceChildren(); return; }
  const status = run?.status || 'idle';
  const head = el('div', 'deep-head'); const title = el('h3', '', 'Deep Genius Analysis'); title.id = 'deep-title'; title.prepend(icon('dock-agents'));
  const pill = el('span', `mini-pill deep-status status-${status}`, { idle: 'Not run', running: 'Running', complete: 'Complete', failed: 'Stopped', cancelled: 'Cancelled' }[status]); pill.id = 'deep-state'; head.append(title, pill);
  const list = el('dl', 'deep-facts'); for (const [term, value] of facts()) list.append(el('dt', '', term), el('dd', '', value));
  const teams = el('div', 'deep-teams'); teams.id = 'deep-agents';
  for (const team of [1, 2, 3]) { const group = el('div', 'deep-team'); group.dataset.team = String(team); group.append(el('h4', '', TEAM_TITLES[team])); const row = el('div', 'agent-row'); TEAMS[team].forEach(id => row.append(agentCard(id))); group.append(row); teams.append(group); }
  const core = el('div', 'deep-team core'); core.append(el('h4', '', 'Genius Core'), agentCard('core')); teams.append(core);
  const actions = el('div', 'deep-actions');
  if (status === 'running') { const cancel = el('button', 'quiet-button', 'Cancel'); cancel.type = 'button'; cancel.id = 'deep-cancel'; cancel.addEventListener('click', () => run?.controller?.abort()); actions.append(cancel); }
  else { const startButton = el('button', 'primary-button', status === 'idle' ? 'Run Deep Genius…' : 'Run again…'); startButton.type = 'button'; startButton.id = 'deep-start'; startButton.addEventListener('click', confirm); actions.append(startButton); }
  const view = el('button', 'quiet-button', 'Open the process view'); view.type = 'button'; view.addEventListener('click', () => api.selectView('pipeline')); actions.append(view);
  if (run?.pack && ['complete', 'failed', 'cancelled'].includes(status)) { const pack = el('button', 'quiet-button', 'Download Genius Development Pack'); pack.type = 'button'; pack.addEventListener('click', () => api.runAction('genius-pack')); actions.append(pack); }
  const children = [head, el('p', 'fineprint', 'Three teams of three agents audit this commit, propose and validate solutions, and document the result. Every citation is checked against the analyzed commit; anything unchecked is labeled Genius inference.'), list, teams, actions];
  if (run?.error) { const alert = el('div', `deep-error kind-${run.error.kind}`); alert.setAttribute('role', 'alert'); alert.append(el('strong', '', errorTitle(run.error.kind)), el('p', '', run.error.message)); if (run.error.suggestion) alert.append(el('p', 'fineprint', run.error.suggestion)); if (['rate_limited', 'model_unavailable', 'timeout', 'provider_unavailable'].includes(run.error.kind)) { const fast = el('button', 'quiet-button', 'Use the Fast model in API settings'); fast.type = 'button'; fast.addEventListener('click', () => api.openSettings('fast')); alert.append(fast); } children.splice(2, 0, alert); }
  box.replaceChildren(...children);
  const badge = $('#deep-badge'); if (badge) { badge.hidden = !run?.pack; badge.textContent = run?.pack ? String(run.pack.findings.length) : ''; }
}

function evidenceList(items) {
  const list = el('ul', 'evidence-list');
  for (const item of items) { const row = el('li', `evidence evidence-${item.status}`); const where = el('button', 'evidence-path', `${item.path}${item.line ? `:${item.line}` : ''}`); where.type = 'button'; where.addEventListener('click', () => { $('#agent-dialog').close(); api.inspect(item.path, item.line); }); row.append(where); if (item.quote) row.append(el('code', '', item.quote)); row.append(el('span', 'evidence-tag', item.status === 'verified' ? (item.basis === 'documented' ? 'Verified · documentation' : 'Verified · source') : 'Genius inference')); if (item.reason) row.title = item.reason; list.append(row); }
  return list;
}

function openAgent(id) {
  const spec = AGENTS[id]; const agent = run?.pack?.agents?.[id]; const status = statusOf(id); const pack = run?.pack;
  $('#agent-title').textContent = `${id === 'core' ? '' : `${id} · `}${spec.title}`; $('#agent-state').textContent = STATE_LABELS[status] || status; $('#agent-state').dataset.basis = status === 'failed' ? 'edited' : 'observed';
  const body = []; const section = (title, ...children) => { const block = el('section', 'agent-section'); block.append(el('h3', '', title), ...children); body.push(block); };
  if (!agent || (!agent.runs.length && !agent.error)) section('Result', el('p', 'subtle', status === 'queued' ? 'This agent has not run yet.' : 'This agent is working.'));
  if (agent?.summary) section('Result summary', el('p', '', agent.summary));
  if (agent?.error) section('Failure', el('p', '', agent.error.message));
  const findings = pack ? pack.findings.filter(item => item.origins.includes(id)) : [];
  if (findings.length) { const list = el('ol', 'agent-findings'); findings.forEach(item => { const row = el('li', `finding sev-${item.severity} ${item.evidenceStatus}`); row.append(el('strong', '', `${item.id} · ${item.title}`), el('span', 'finding-meta', `${item.severity} · confidence ${item.confidence} · ${item.evidenceStatus === 'verified' ? 'verified evidence' : 'Genius inference'}`), el('p', '', item.description)); if (item.whyItMatters) row.append(el('p', 'fineprint', `Why it matters: ${item.whyItMatters}`)); if (item.validation) row.append(el('p', 'fineprint', `Validate by: ${item.validation}`)); if (item.evidence.length) row.append(evidenceList(item.evidence)); list.append(row); }); section('Findings', list); }
  const solutions = pack ? pack.solutions.filter(item => item.author === id) : [];
  if (solutions.length) { const list = el('ol', 'agent-findings'); solutions.forEach(item => { const row = el('li', `finding status-${item.status}`); row.append(el('strong', '', `${item.id} · ${item.title}`), el('span', 'finding-meta', `${item.kind}${item.required ? ' · required' : ' · optional'} · ${item.status.replace('_', ' ').toLowerCase()} · revision ${item.revision}`), el('p', '', item.description)); if (item.steps.length) { const steps = el('ul', 'suggestions'); item.steps.slice(0, 6).forEach(step => steps.append(el('li', '', step))); row.append(steps); } if (item.response) row.append(el('p', 'fineprint', `Revision note: ${item.response}`)); list.append(row); }); section('Recommendations', list); }
  const verdicts = pack ? pack.validations.filter(item => item.reviewer === id) : [];
  if (verdicts.length) { const list = el('ul', 'agent-verdicts'); verdicts.forEach(item => list.append(el('li', `verdict verdict-${item.verdict}`, `${item.solutionId} · pass ${item.pass}: ${item.verdict.replace('_', ' ')} — ${item.reason}${item.missingValidation ? ` (missing: ${item.missingValidation})` : ''}`))); section('Validation verdicts', list); }
  if (id === 'core' && pack?.synthesis) { const list = el('ol', 'suggestions'); pack.synthesis.nextActions.forEach(item => list.append(el('li', '', `${item.action}${item.solutionIds.length ? ` (${item.solutionIds.join(', ')})` : ''}`))); section('Next recommended actions', el('p', '', pack.synthesis.overview), list); }
  if (id === '3B' && pack?.team3.documentation) section('Onboarding', el('p', '', pack.team3.documentation.onboarding || pack.team3.documentation.overview));
  if (id === '3A' && pack?.team3.comparisons.length) { const list = el('ul', 'suggestions'); pack.team3.comparisons.forEach(item => list.append(el('li', '', `${item.recommendedSolutionId}: ${item.expectedBenefit} (complexity ${item.complexity}, risk ${item.migrationRisk}, confidence ${item.confidence})`))); section('Comparisons', list); }
  if (agent?.runs?.length) { const usage = agent.runs.reduce((sum, item) => ({ input: sum.input + item.usage.input, output: sum.output + item.usage.output }), { input: 0, output: 0 }); section('Usage', el('p', 'fineprint', `${agent.runs.length} call${agent.runs.length === 1 ? '' : 's'} (${agent.runs.map(item => item.stage).join(', ')}) · ${agent.runs[0].model}${usage.input ? ` · ${usage.input.toLocaleString('en')} input / ${usage.output.toLocaleString('en')} output tokens, as reported by the provider` : ''}`)); }
  $('#agent-body').replaceChildren(...body); $('#agent-dialog').showModal();
}

/** The Genius process visualization: Genius Core, evidence, three teams, validation with its revision loop, and the final pack. */
function renderPipeline() {
  const view = $('#pipeline-view'); if (!view || !api.state.result) return;
  const stage = run?.stage || 'idle'; const order = ['starting', 'team1', 'team2', 'validation', 'revision', 'team3', 'synthesis', 'complete'];
  const reached = name => run && (order.indexOf(stage) >= order.indexOf(name) || run.status === 'complete');
  const state = name => (!run ? 'idle' : stage === name && run.status === 'running' ? 'active' : reached(name) ? 'done' : 'idle');
  const link = (active, label = '') => { const line = el('div', `pipe-link${active ? ' flowing' : ''}`); line.setAttribute('aria-hidden', 'true'); if (label) line.append(el('span', 'pipe-link-label', label)); return line; };
  const node = (className, title, detail, stateName, iconName) => { const box = el('div', `pipe-node ${className}`); box.dataset.state = stateName; const mark = el('span', 'pipe-icon'); mark.append(icon(iconName)); const text = el('span', 'pipe-text'); text.append(el('strong', '', title), el('small', '', detail)); box.append(mark, text); if (stateName === 'done') box.append(icon('check', 'pipe-check')); return box; };
  const team = number => { const name = `team${number}`; const box = el('section', 'pipe-team'); box.dataset.state = state(name); box.dataset.team = String(number); const header = el('header'); header.append(el('strong', '', TEAM_TITLES[number]), el('span', 'pipe-team-note', `3 agents in parallel · ${STAGE_LABELS[name] && state(name) === 'active' ? 'working' : state(name) === 'done' ? 'done' : 'waiting'}`)); const row = el('div', 'agent-row'); TEAMS[number].forEach(id => row.append(agentCard(id))); box.append(header, row); return box; };
  const { provider, model } = run || api.credentials(); const result = api.state.result; const pack = run?.pack;
  const loops = pack?.loops ?? run?.events?.filter(event => event.type === 'stage' && event.stage === 'revision').length ?? 0;
  const validation = el('div', 'pipe-validation'); validation.dataset.state = stage === 'validation' || stage === 'revision' ? 'active' : reached('team3') ? 'done' : 'idle';
  const vnode = node('validation', 'Validation', `Team 1 reviews every solution · ${loops} of ${GENIUS_LIMITS.revisionLoops} revision loops`, validation.dataset.state, 'shield');
  const branches = el('div', 'pipe-branches'); const back = el('div', `pipe-branch revise${stage === 'revision' ? ' looping' : ''}`); back.append(icon('loop'), el('span', '', `Needs revision → back to Team 2${pack?.unresolved?.length ? ` · ${pack.unresolved.length} unresolved` : ''}`)); const ahead = el('div', 'pipe-branch approved'); ahead.append(icon('check'), el('span', '', `Approved → Team 3${pack ? ` · ${pack.solutions.filter(item => item.status === 'APPROVED').length}` : ''}`)); branches.append(back, ahead); validation.append(vnode, branches);
  const finalState = run?.status === 'complete' ? 'done' : 'idle';
  const final = node('final', 'Final engineering pack', pack ? `${pack.findings.length} findings · ${pack.solutions.filter(item => item.status === 'APPROVED').length} validated solutions · ${pack.calls} calls` : 'Architecture, findings, validated fixes, skills, prompt, roadmap, evidence', finalState, 'dock-export-project');
  if (pack) { const download = el('button', 'primary-button', 'Download Genius Development Pack'); download.type = 'button'; download.addEventListener('click', () => api.runAction('genius-pack')); final.append(download); }
  const flow = el('div', 'pipe');
  flow.append(node('core', 'Genius Core', provider ? `${PROVIDERS[provider]?.name || provider} · ${model || 'no model selected'}` : 'Choose a provider in API settings', state('starting'), 'dock-agents'), link(state('team1') === 'active'), node('evidence', 'Repository evidence', `${result.repository.fullName} @ ${result.repository.sha.slice(0, 7)} · ${result.coverage.readFiles} files read, each verified against its Git SHA`, run ? 'done' : 'idle', 'repo'), link(state('team1') === 'active', 'bounded excerpts'), team(1), link(state('team2') === 'active', 'merged findings'), team(2), link(stage === 'validation', 'proposed solutions'), validation, link(state('team3') === 'active', 'validated work only'), team(3), link(state('synthesis') === 'active'), node('core synth', 'Genius Core synthesis', STATE_LABELS[statusOf('core')] || 'Queued', state('synthesis'), 'spark'), link(finalState === 'done'), final);
  const head = el('header', 'pipe-head'); head.append(el('h2', '', 'Genius process'), el('p', 'subtle', run ? (run.status === 'running' ? `${STAGE_LABELS[stage] || stage} · ${run.counts.calls} model calls so far` : run.status === 'complete' ? 'Complete. Select an agent to see its results and evidence.' : `${errorTitle(run.error?.kind)}: ${run.error?.message || ''}`) : 'Deep Genius has not run for this commit. Results appear here as each agent works.'));
  if (!run || run.status !== 'running') { const go = el('button', run ? 'quiet-button' : 'primary-button', run ? 'Run again…' : 'Run Deep Genius…'); go.type = 'button'; go.addEventListener('click', confirm); head.append(go); }
  view.replaceChildren(head, flow, ...(pack ? [results(pack)] : []));
}

function results(pack) {
  const box = el('section', 'pipe-results'); box.append(el('h3', '', 'Results'));
  const column = (title, items, render) => { const block = el('div', 'pipe-col'); block.append(el('h4', '', `${title} (${items.length})`)); const list = el('ol', 'pipe-list'); items.slice(0, 12).forEach(item => list.append(render(item))); if (!items.length) list.append(el('li', 'subtle', 'None.')); block.append(list); return block; };
  const findingRow = item => { const row = el('li', `pipe-item ${item.evidenceStatus}`); row.append(el('span', `sev sev-${item.severity}`, item.severity), el('strong', '', item.title), el('span', 'pipe-item-meta', `${item.id} · ${item.evidenceStatus === 'verified' ? 'verified source evidence' : 'Genius inference'} · ${item.files.slice(0, 2).join(', ')}`)); return row; };
  const solutionRow = item => { const row = el('li', 'pipe-item verified'); row.append(el('span', 'sev', item.kind), el('strong', '', item.title), el('span', 'pipe-item-meta', `${item.id} → ${item.findingIds.join(', ') || 'optional'} · risk ${item.migrationRisk}`)); return row; };
  const openRow = item => { const row = el('li', 'pipe-item inferred'); row.append(el('span', 'sev', item.reviewerPositions ? 'unresolved' : 'rejected'), el('strong', '', item.title), el('span', 'pipe-item-meta', item.reviewerPositions ? `Author: ${item.authorPosition.slice(0, 140)} · Reviewers: ${item.reviewerPositions.map(position => position.reason).join(' / ').slice(0, 200)}` : item.reasons.join(' / ').slice(0, 220))); return row; };
  const grid = el('div', 'pipe-grid'); grid.append(column('Audit findings', pack.findings, findingRow), column('Validated solutions', pack.solutions.filter(item => item.status === 'APPROVED'), solutionRow), column('Unresolved or rejected', [...pack.unresolved, ...pack.rejectedSolutions], openRow));
  box.append(grid, el('p', 'fineprint', 'Solid entries cite a line verified at this commit; dotted entries are Genius inference. Unresolved items keep both the author\'s and the reviewers\' positions.'));
  return box;
}
