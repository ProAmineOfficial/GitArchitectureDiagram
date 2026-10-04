// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-GENIUS-PIPELINE-001
// Project: Git Architecture Diagram | Component: Genius Core orchestrator (shared by browser and server) | Author: Amine Saoud ibn al-Bashir.
// Coordinates the deterministic analysis, the verified evidence store, the selected model, and three agent teams:
//   Team 1 audits → findings are verified and merged → Team 2 proposes solutions → Team 1 validates them →
//   at most two revise-and-revalidate loops → Team 3 compares, documents, and extracts → Genius Core synthesizes.
// Agents in a team run in parallel, but never more than three model calls are in flight. Every path, line, and quote
// a model returns is checked against the analyzed commit before it is used; disagreements that survive the loops
// are marked UNRESOLVED with both positions, never turned into consensus. The caller injects `callAgent`, so this
// module performs no network access itself.
import { AGENTS, TEAMS, GENIUS_LIMITS, SEVERITIES, CONFIDENCE } from './genius-agents.js';
import { buildIntel, retrieve, expandEvidence, excerptOf } from './repo-intel.js';
import { createEvidenceStore, verifyItem, verifyCitation, evidenceCoverage, pathExists } from './genius-evidence.js';

export const PIPELINE_VERSION = 1;
export const AGENT_STATES = ['queued', 'reading', 'analyzing', 'completed', 'needs-revision', 'approved', 'failed', 'skipped'];
const FATAL = new Set(['auth', 'quota_exhausted', 'cancelled', 'permission', 'model_unavailable', 'workspace_required', 'blocked']);

/** Run tasks with at most `max` in flight; `peak` records the highest concurrency observed. */
export function createLimiter(max) {
  let active = 0; let peak = 0; const queue = [];
  const pump = () => { while (active < max && queue.length) { const { task, resolve, reject } = queue.shift(); active++; peak = Math.max(peak, active); Promise.resolve().then(task).then(resolve, reject).finally(() => { active--; pump(); }); } };
  return { run: task => new Promise((resolve, reject) => { queue.push({ task, resolve, reject }); pump(); }), get peak() { return peak; } };
}

/** A failure that stops the pipeline; `pack` holds everything completed so far. */
export class GeniusError extends Error { constructor(message, { kind = 'error', pack = null } = {}) { super(message); this.kind = kind; this.pack = pack; } }

const rank = severity => SEVERITIES.indexOf(severity) === -1 ? SEVERITIES.length : SEVERITIES.indexOf(severity);
const confidenceRank = value => CONFIDENCE.indexOf(value) === -1 ? CONFIDENCE.length : CONFIDENCE.indexOf(value);
const words = text => new Set(String(text).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(word => word.length > 3));
const similar = (a, b) => { const x = words(a); const y = words(b); if (!x.size || !y.size) return false; let same = 0; for (const word of x) if (y.has(word)) same++; return same / Math.min(x.size, y.size) >= 0.6; };
const usageOf = usage => ({ input: Number(usage?.input_tokens ?? usage?.prompt_tokens ?? usage?.promptTokenCount ?? 0) || 0, output: Number(usage?.output_tokens ?? usage?.completion_tokens ?? usage?.candidatesTokenCount ?? 0) || 0 });
const cite = list => (list || []).slice(0, 3).map(item => ({ path: item.path, line: item.line, quote: item.quote, status: item.status, basis: item.basis }));

/** Merge near-duplicate findings from the three auditors, keep the strongest evidence, and assign stable ids. */
export function mergeFindings(groups, limit = GENIUS_LIMITS.findings) {
  const merged = [];
  for (const { id: origin, findings } of groups) for (const finding of findings) {
    const twin = merged.find(item => (item.files[0] && item.files[0] === finding.files[0] && similar(item.title, finding.title)) || similar(`${item.title} ${item.description}`, `${finding.title} ${finding.description}`) && item.files.some(path => finding.files.includes(path)));
    if (!twin) { merged.push({ ...finding, origins: [origin], sourceIds: [`${origin}:${finding.id}`] }); continue; }
    twin.origins = [...new Set([...twin.origins, origin])]; twin.sourceIds.push(`${origin}:${finding.id}`);
    if (rank(finding.severity) < rank(twin.severity)) twin.severity = finding.severity;
    if (confidenceRank(finding.confidence) < confidenceRank(twin.confidence)) twin.confidence = finding.confidence;
    twin.files = [...new Set([...twin.files, ...finding.files])].slice(0, 12);
    const seen = new Set(twin.evidence.map(item => `${item.path}:${item.line}`)); for (const item of finding.evidence) if (!seen.has(`${item.path}:${item.line}`)) twin.evidence.push(item);
    if (finding.description.length > twin.description.length) twin.description = finding.description;
    if (finding.evidenceStatus === 'verified') twin.evidenceStatus = 'verified';
  }
  return merged.sort((a, b) => rank(a.severity) - rank(b.severity) || (a.evidenceStatus === 'verified' ? 0 : 1) - (b.evidenceStatus === 'verified' ? 0 : 1) || confidenceRank(a.confidence) - confidenceRank(b.confidence)).slice(0, limit).map((item, index) => ({ ...item, id: `F${index + 1}` }));
}

/** Combine the verdicts of every reviewer of one solution. Disagreement is never resolved by vote. */
export function decide(verdicts) {
  if (!verdicts.length) return 'NEEDS_REVISION';
  const kinds = new Set(verdicts.map(item => item.verdict));
  if (kinds.has('NEEDS_REVISION')) return 'NEEDS_REVISION';
  if (kinds.has('APPROVED') && kinds.has('REJECTED')) return 'NEEDS_REVISION'; // Reviewers disagree: send it back.
  return kinds.has('REJECTED') ? 'REJECTED' : 'APPROVED';
}

/**
 * Run Deep Genius on an analysis result.
 * @param {object} options
 * @param {object} options.result the structural analysis (with the files read)
 * @param {(call: {agent: string, stage: string, payload: object, signal?: AbortSignal}) => Promise<{output: object, usage?: object, model?: string, attempts?: number}>} options.callAgent
 * @param {(event: object) => void} [options.onEvent]
 */
export async function runDeepGenius({ result, callAgent, onEvent = () => {}, signal, provider = '', model = '', concurrency = GENIUS_LIMITS.concurrency, revisionLoops = GENIUS_LIMITS.revisionLoops }) {
  const repo = result.repository; const store = createEvidenceStore(result); const intel = buildIntel(result); const limiter = createLimiter(Math.min(concurrency, GENIUS_LIMITS.concurrency));
  const pack = { version: PIPELINE_VERSION, provider, model, repository: repo.fullName, commit: repo.sha, scope: repo.scope || '', startedAt: new Date().toISOString(), finishedAt: null, status: 'running', stage: 'starting', calls: 0, usage: { input: 0, output: 0 }, agents: {}, findings: [], solutions: [], validations: [], unresolved: [], rejectedSolutions: [], discarded: { findings: 0, solutions: 0, paths: 0, citations: 0 }, evidenceLog: [], loops: 0, team3: { comparisons: [], documentation: null, devpack: null }, synthesis: null, intelligence: null, coverage: null, warnings: [], concurrencyPeak: 0 };
  for (const id of [...TEAMS[1], ...TEAMS[2], ...TEAMS[3], 'core']) pack.agents[id] = { id, team: AGENTS[id].team, title: AGENTS[id].title, short: AGENTS[id].short, status: 'queued', detail: '', runs: [], summary: '', findings: [], solutions: [], verdicts: [], recommendations: [], error: null };
  const emit = event => { try { onEvent({ ...event, at: Date.now() }); } catch { /* A display error never stops the pipeline. */ } };
  const setAgent = (id, status, detail = '') => { Object.assign(pack.agents[id], { status, detail }); emit({ type: 'agent', id, status, detail }); };
  const stage = (name, detail = '') => { pack.stage = name; emit({ type: 'stage', stage: name, detail, loop: pack.loops }); };
  const check = () => { if (signal?.aborted) throw new GeniusError('Deep Genius was cancelled.', { kind: 'cancelled', pack }); };
  const brief = item => ({ id: item.id, severity: item.severity, title: item.title, description: item.description.slice(0, 700), files: item.files, evidence: cite(item.evidence), evidenceStatus: item.evidenceStatus, confidence: item.confidence, whyItMatters: item.whyItMatters?.slice(0, 400), validation: item.validation?.slice(0, 300), origins: item.origins });
  const solutionBrief = item => ({ id: item.id, findingIds: item.findingIds, kind: item.kind, required: item.required, title: item.title, description: item.description.slice(0, 900), files: item.files, newFiles: item.newFiles, steps: item.steps.slice(0, 8), tests: item.tests.slice(0, 6), migrationRisk: item.migrationRisk, order: item.order, compatibility: item.compatibility.slice(0, 300), evidence: cite(item.evidence), revision: item.revision, author: item.author, ...(item.reviews?.length ? { reviewerFeedback: item.reviews.slice(-3).map(review => ({ reviewer: review.reviewer, verdict: review.verdict, reason: review.reason.slice(0, 400), missingValidation: review.missingValidation.slice(0, 300) })) } : {}) });
  const context = intelligence => ({ repository: intelligence.repository.summary, subsystems: intelligence.subsystems, modules: intelligence.modules, files: intelligence.files, relationships: intelligence.relationships });
  const sent = excerpts => excerpts.map(item => ({ path: item.path, lines: `${item.startLine}-${item.endLine}`, role: item.role, reason: item.reason, source: item.source }));
  const around = (paths, budget) => { const read = new Map(result.files.map(file => [file.path, file])); const out = []; let used = 0; for (const { path, line } of paths) { const file = read.get(path); if (!file || out.some(item => item.path === path)) continue; const excerpt = excerptOf(file, { center: line || 1, lines: 50 }); if (used + excerpt.source.length > budget) break; used += excerpt.source.length; out.push({ ...excerpt, role: intel.files.get(path)?.role || 'core', reason: 'Context for a cited line' }); } return out; };

  async function call(id, stageName, payload) {
    check();
    return limiter.run(async () => {
      check(); setAgent(id, 'analyzing', `${stageName}`);
      const started = Date.now(); const response = await callAgent({ agent: id, stage: stageName, payload, signal });
      const usage = usageOf(response.usage); pack.calls++; pack.usage.input += usage.input; pack.usage.output += usage.output; pack.concurrencyPeak = limiter.peak;
      pack.agents[id].runs.push({ stage: stageName, model: response.model || model, attempts: response.attempts || 1, usage, durationMs: Date.now() - started, cached: Boolean(response.cached) });
      emit({ type: 'call', id, stage: stageName, calls: pack.calls, usage: pack.usage });
      return response.output || {};
    });
  }
  function failed(id, error) {
    const kind = error?.kind || 'error'; pack.agents[id].error = { message: error?.message || 'The agent failed.', kind }; setAgent(id, 'failed', error?.message || 'Failed');
    if (FATAL.has(kind)) throw new GeniusError(kind === 'cancelled' ? 'Deep Genius was cancelled.' : error.message, { kind, pack });
  }
  const finish = status => { pack.status = status; pack.finishedAt = new Date().toISOString(); pack.concurrencyPeak = limiter.peak; pack.coverage = evidenceCoverage([...pack.findings, ...pack.solutions], store); pack.intelligence = assembleIntelligence(result, pack, intel); emit({ type: 'done', status }); return pack; };

  try {
    // ——— Team 1: audit, in parallel, each with its own bounded evidence ———
    stage('team1', 'Three auditors read their evidence in parallel.');
    const loaded = new Set(); const expansions = [];
    const audits = await Promise.all(TEAMS[1].map(async id => {
      const evidence = retrieve(intel, result, { ...AGENTS[id].focus, budgetChars: 36000, maxExcerpts: 14, reasonPrefix: `${id}: ` });
      evidence.excerpts.forEach(item => { loaded.add(item.path); pack.evidenceLog.push({ path: item.path, lines: `${item.startLine}-${item.endLine}`, requestedBy: id, status: 'retrieved', reason: item.reason }); });
      setAgent(id, 'reading', `${evidence.excerpts.length} excerpts from ${new Set(evidence.excerpts.map(item => item.path)).size} files`);
      try {
        const output = await call(id, 'audit', { task: 'audit', intelligence: context(evidence), excerpts: sent(evidence.excerpts) });
        const checked = (output.findings || []).slice(0, 16).map(finding => verifyItem(store, finding));
        const kept = checked.filter(item => !item.rejected); pack.discarded.findings += checked.length - kept.length;
        pack.discarded.paths += checked.reduce((sum, item) => sum + item.removed.paths.length, 0); pack.discarded.citations += checked.reduce((sum, item) => sum + item.removed.evidence.length, 0);
        const expansion = expandEvidence(intel, result, output.evidenceRequests, { already: new Set(evidence.excerpts.map(item => item.path)), requestedBy: id, budgetChars: 9000 }); expansions.push(...expansion.excerpts); pack.evidenceLog.push(...expansion.log); // Only what this agent has not seen yet.
        Object.assign(pack.agents[id], { summary: output.summary || '', findings: kept.map(item => item.id), recommendations: [], limitations: output.limitations || [] });
        setAgent(id, 'completed', `${kept.length} finding${kept.length === 1 ? '' : 's'}${checked.length > kept.length ? `, ${checked.length - kept.length} rejected` : ''}`);
        return { id, findings: kept };
      } catch (error) { failed(id, error); return { id, findings: [], failed: true }; }
    }));
    if (audits.every(item => item.failed)) throw new GeniusError('All three audit agents failed, so Deep Genius stopped. The structural analysis is unchanged.', { kind: 'provider_unavailable', pack });
    pack.findings = mergeFindings(audits);
    const findingById = new Map(pack.findings.map(item => [item.id, item]));
    for (const id of TEAMS[1]) pack.agents[id].findings = pack.findings.filter(item => item.origins.includes(id)).map(item => item.id);
    emit({ type: 'findings', count: pack.findings.length });

    // ——— Team 2: solutions, in parallel ———
    stage('team2', 'Three engineers propose solutions to the merged findings.');
    const findingContext = [...expansions, ...around(pack.findings.flatMap(item => item.evidence.filter(c => c.status === 'verified').slice(0, 1).map(c => ({ path: c.path, line: c.line }))), 18000)];
    let serial = 0; const solutionsByAuthor = {};
    await Promise.all(TEAMS[2].map(async id => {
      if (!pack.findings.length && id !== '2C') { setAgent(id, 'skipped', 'No verified findings to address.'); return; }
      setAgent(id, 'reading', `${pack.findings.length} findings`);
      try {
        const output = await call(id, 'solve', { task: 'solve', findings: pack.findings.map(brief), intelligence: { repository: intel.repository.summary, subsystems: intel.subsystems.slice(0, 10).map(item => item.summary), modules: intel.modules.slice(0, 12).map(item => item.summary) }, excerpts: sent(findingContext) });
        const items = (output.solutions || []).slice(0, 12).map(solution => verifyItem(store, solution, { requirePath: false })).filter(item => { if (item.rejected) { pack.discarded.solutions++; return false; } return true; });
        solutionsByAuthor[id] = items.map(item => ({ ...item, findingIds: (item.findingIds || []).filter(fid => findingById.has(fid)), newFiles: (item.newFiles || []).filter(path => !pathExists(store, path)).slice(0, 8), author: id, revision: 0, status: 'pending', reviews: [], kind: item.kind || AGENTS[id].kind }));
        Object.assign(pack.agents[id], { summary: output.summary || '', limitations: output.limitations || [] });
        setAgent(id, 'completed', `${items.length} solution${items.length === 1 ? '' : 's'}`);
      } catch (error) { failed(id, error); }
    }));
    for (const id of TEAMS[2]) for (const item of solutionsByAuthor[id] || []) { if (item.kind === 'fix' && !item.findingIds.length) { pack.discarded.solutions++; continue; } serial++; pack.solutions.push({ ...item, id: `S${serial}` }); }
    for (const id of TEAMS[2]) pack.agents[id].solutions = pack.solutions.filter(item => item.author === id).map(item => item.id);
    emit({ type: 'solutions', count: pack.solutions.length });

    // ——— Validation: Team 1 reviews every solution; at most two revise-and-revalidate loops ———
    const reviewersOf = item => { const origins = new Set(item.findingIds.flatMap(fid => findingById.get(fid)?.origins || [])); if (!origins.size) origins.add(item.kind === 'tooling' || item.kind === 'innovation' ? '1C' : '1B'); return [...origins]; };
    let pending = [...pack.solutions]; let pass = 0;
    while (pending.length) {
      pass++; stage('validation', pass === 1 ? 'Team 1 validates the proposed solutions.' : `Team 1 revalidates revised solutions (loop ${pack.loops} of ${revisionLoops}).`);
      const byReviewer = new Map(); for (const item of pending) for (const reviewer of reviewersOf(item)) { if (!byReviewer.has(reviewer)) byReviewer.set(reviewer, []); byReviewer.get(reviewer).push(item); }
      const verdicts = new Map(pending.map(item => [item.id, []]));
      await Promise.all([...byReviewer].map(async ([reviewer, items]) => {
        setAgent(reviewer, 'reading', `${items.length} solution${items.length === 1 ? '' : 's'} to validate`);
        const related = [...new Set(items.flatMap(item => item.findingIds))].map(fid => findingById.get(fid)).filter(Boolean);
        const evidence = around([...items.flatMap(item => item.evidence.map(c => ({ path: c.path, line: c.line }))), ...related.flatMap(item => item.evidence.slice(0, 1).map(c => ({ path: c.path, line: c.line })))], 20000);
        try {
          const output = await call(reviewer, 'validate', { task: 'validate', pass, solutions: items.map(solutionBrief), findings: related.map(brief), excerpts: sent(evidence) });
          for (const raw of output.verdicts || []) { if (!verdicts.has(raw.solutionId) || !items.some(item => item.id === raw.solutionId)) continue; const checked = verifyItem(store, { ...raw, files: [] }, { requirePath: false }); verdicts.get(raw.solutionId).push({ reviewer, pass, verdict: raw.verdict, reason: raw.reason, risk: raw.risk, missingValidation: raw.missingValidation, findingIds: (raw.findingIds || []).filter(fid => findingById.has(fid)), evidence: checked.evidence }); }
          for (const item of items) if (!verdicts.get(item.id).some(review => review.reviewer === reviewer)) verdicts.get(item.id).push({ reviewer, pass, verdict: 'NEEDS_REVISION', reason: 'The reviewer returned no verdict for this solution.', risk: 'medium', missingValidation: '', findingIds: item.findingIds, evidence: [] });
          setAgent(reviewer, 'completed', `Validated ${items.length}`);
        } catch (error) { failed(reviewer, error); for (const item of items) verdicts.get(item.id).push({ reviewer, pass, verdict: 'NEEDS_REVISION', reason: 'The reviewer could not be reached.', risk: 'medium', missingValidation: '', findingIds: item.findingIds, evidence: [], unavailable: true }); }
      }));
      const revise = [];
      for (const item of pending) {
        const reviews = verdicts.get(item.id); item.reviews.push(...reviews); pack.validations.push(...reviews.map(review => ({ solutionId: item.id, ...review })));
        const decision = decide(reviews); item.status = decision;
        if (decision === 'REJECTED') pack.rejectedSolutions.push({ id: item.id, title: item.title, reasons: reviews.map(review => `${review.reviewer}: ${review.reason}`) });
        if (decision === 'NEEDS_REVISION') revise.push(item);
      }
      emit({ type: 'validation', pass, approved: pending.filter(item => item.status === 'APPROVED').length, revise: revise.length, rejected: pending.filter(item => item.status === 'REJECTED').length });
      if (!revise.length) break;
      if (pack.loops >= revisionLoops) { // Consensus was not reached within the bounded loops: keep both positions.
        for (const item of revise) { item.status = 'UNRESOLVED'; pack.unresolved.push({ id: item.id, title: item.title, author: item.author, authorPosition: item.response || item.description.slice(0, 600), reviewerPositions: item.reviews.filter(review => review.pass === pass).map(review => ({ reviewer: review.reviewer, verdict: review.verdict, reason: review.reason, missingValidation: review.missingValidation })) }); }
        break;
      }
      pack.loops++; stage('revision', `Team 2 revises ${revise.length} solution${revise.length === 1 ? '' : 's'} (loop ${pack.loops} of ${revisionLoops}).`);
      const byAuthor = new Map(); for (const item of revise) { if (!byAuthor.has(item.author)) byAuthor.set(item.author, []); byAuthor.get(item.author).push(item); }
      const revised = [];
      await Promise.all([...byAuthor].map(async ([author, items]) => {
        setAgent(author, 'needs-revision', `${items.length} to revise`);
        const related = [...new Set(items.flatMap(item => item.findingIds))].map(fid => findingById.get(fid)).filter(Boolean);
        try {
          const output = await call(author, 'revise', { task: 'revise', loop: pack.loops, solutions: items.map(solutionBrief), findings: related.map(brief), excerpts: sent(around(items.flatMap(item => item.evidence.map(c => ({ path: c.path, line: c.line }))), 14000)) });
          for (const item of items) {
            const raw = (output.solutions || []).find(candidate => candidate.id === item.id);
            if (!raw) { item.status = 'UNRESOLVED'; pack.unresolved.push({ id: item.id, title: item.title, author, authorPosition: 'The author did not revise this solution.', reviewerPositions: item.reviews.filter(review => review.pass === pass).map(review => ({ reviewer: review.reviewer, verdict: review.verdict, reason: review.reason, missingValidation: review.missingValidation })) }); continue; }
            const checked = verifyItem(store, raw, { requirePath: false });
            Object.assign(item, { title: checked.title || item.title, description: checked.description || item.description, files: checked.files.length ? checked.files : item.files, newFiles: (checked.newFiles || []).filter(path => !pathExists(store, path)).slice(0, 8), steps: checked.steps, tests: checked.tests, migrationRisk: checked.migrationRisk, order: checked.order, compatibility: checked.compatibility, evidence: checked.evidence.length ? checked.evidence : item.evidence, evidenceStatus: checked.evidence.length ? checked.evidenceStatus : item.evidenceStatus, confidence: checked.confidence, response: checked.response, revision: item.revision + 1, status: 'pending' });
            revised.push(item);
          }
          setAgent(author, 'completed', `Revised ${items.length}`);
        } catch (error) { failed(author, error); for (const item of items) { item.status = 'UNRESOLVED'; pack.unresolved.push({ id: item.id, title: item.title, author, authorPosition: 'The author could not be reached to revise this solution.', reviewerPositions: item.reviews.filter(review => review.pass === pass).map(review => ({ reviewer: review.reviewer, verdict: review.verdict, reason: review.reason, missingValidation: review.missingValidation })) }); } }
      }));
      pending = revised;
    }
    for (const id of TEAMS[2]) { const mine = pack.solutions.filter(item => item.author === id); if (pack.agents[id].status === 'failed' || pack.agents[id].status === 'skipped') continue; const statusOf = mine.some(item => item.status === 'NEEDS_REVISION') ? 'needs-revision' : mine.length && mine.every(item => item.status === 'APPROVED') ? 'approved' : 'completed'; setAgent(id, statusOf, `${mine.filter(item => item.status === 'APPROVED').length} of ${mine.length} approved`); }
    for (const id of TEAMS[1]) pack.agents[id].verdicts = pack.validations.filter(review => review.reviewer === id).map(review => ({ solutionId: review.solutionId, pass: review.pass, verdict: review.verdict }));

    // ——— Team 3: comparison, documentation, development pack, in parallel; only validated work enters ———
    stage('team3', 'Team 3 compares, documents, and extracts the validated work.');
    const approved = pack.solutions.filter(item => item.status === 'APPROVED');
    const verified = pack.findings.filter(item => item.evidenceStatus === 'verified');
    const docEvidence = retrieve(intel, result, { roles: ['entrypoint', 'documentation', 'core', 'api', 'service', 'ui', 'hardware'], keywords: ['main', 'start', 'listen', 'setup', 'route', 'request', 'config'], budgetChars: 24000, maxExcerpts: 10, reasonPrefix: '3B: ' });
    const packEvidence = retrieve(intel, result, { roles: ['build', 'configuration', 'deployment', 'documentation', 'test', 'entrypoint'], keywords: ['script', 'install', 'test', 'build', 'deploy', 'env'], budgetChars: 16000, maxExcerpts: 8, reasonPrefix: '3C: ' });
    const structural = { entrypoints: result.entrypoints?.slice(0, 8) || [], readingOrder: result.readingOrder?.slice(0, 10) || [], layers: intel.repository.layers, observedSkills: (result.skills?.observed || []).slice(0, 20).map(item => ({ name: item.name, category: item.category, evidence: item.evidence })), externals: (result.externalModules || []).slice(0, 20), systemMapTour: (result.ai?.graph?.tour || []).map(step => ({ label: step.label, text: step.text, files: step.files || [] })) };
    const unresolvedBrief = pack.unresolved.map(item => ({ id: item.id, title: item.title, reviewerPositions: item.reviewerPositions.map(position => position.reason).slice(0, 3) }));
    const team3 = {
      '3A': () => call('3A', 'compare', { task: 'compare', findings: verified.concat(pack.findings.filter(item => item.evidenceStatus !== 'verified')).map(brief), approvedSolutions: approved.map(solutionBrief), rejected: pack.rejectedSolutions.slice(0, 12), unresolved: unresolvedBrief }),
      '3B': () => call('3B', 'document', { task: 'document', intelligence: context(docEvidence), structural, findings: verified.map(brief).slice(0, 12), approvedSolutions: approved.map(item => ({ id: item.id, title: item.title, files: item.files })), excerpts: sent(docEvidence.excerpts) }),
      '3C': () => call('3C', 'devpack', { task: 'devpack', intelligence: context(packEvidence), structural, findings: verified.map(brief).slice(0, 12), approvedSolutions: approved.map(solutionBrief), excerpts: sent(packEvidence.excerpts) }),
    };
    await Promise.all(TEAMS[3].map(async id => {
      setAgent(id, 'reading', id === '3A' ? `${approved.length} approved solutions` : 'Validated results and summaries');
      try {
        const output = await team3[id]();
        if (id === '3A') { const ok = new Set(approved.map(item => item.id)); pack.team3.comparisons = (output.comparisons || []).filter(item => ok.has(item.recommendedSolutionId)).map(item => ({ ...item, alternativeSolutionIds: item.alternativeSolutionIds.filter(sid => ok.has(sid)), findingIds: item.findingIds.filter(fid => findingById.has(fid)) })); pack.agents[id].summary = output.summary || ''; }
        if (id === '3B') { const files = list => list.filter(path => pathExists(store, path)).slice(0, 6); const sourced = item => ({ ...item, files: files(item.files), basis: item.basis !== 'inferred' && !files(item.files).length ? 'inferred' : item.basis }); pack.team3.documentation = { overview: output.overview, onboarding: output.onboarding, flows: output.flows.map(flow => ({ ...flow, files: files(flow.files) })), tour: output.tour.slice(0, 12).map(sourced), architectureNotes: output.architectureNotes.map(sourced), implementationNotes: output.implementationNotes, limitations: output.limitations }; pack.agents[id].summary = output.overview?.slice(0, 300) || ''; }
        if (id === '3C') { const real = item => pathExists(store, item.path); const dropped = output.essentialFiles.filter(item => !real(item)).length + output.readingOrder.filter(item => !real(item)).length; pack.discarded.paths += dropped; pack.team3.devpack = { ...output, essentialFiles: output.essentialFiles.filter(real), readingOrder: output.readingOrder.filter(real), configuration: output.configuration.filter(real), recommendedSkills: output.recommendedSkills.map(skill => ({ ...skill, relatedModules: skill.relatedModules.filter(path => pathExists(store, path)) })) }; pack.agents[id].summary = output.purpose?.slice(0, 300) || ''; }
        setAgent(id, 'completed', id === '3A' ? `${pack.team3.comparisons.length} comparison${pack.team3.comparisons.length === 1 ? '' : 's'}` : 'Done');
      } catch (error) { failed(id, error); }
    }));

    // ——— Genius Core synthesis ———
    stage('synthesis', 'Genius Core assembles the final engineering pack.');
    setAgent('core', 'reading', 'Validated results from all teams');
    try {
      const output = await call('core', 'synthesize', { task: 'synthesize', findings: pack.findings.map(brief).slice(0, 16), approvedSolutions: approved.map(item => ({ id: item.id, title: item.title, kind: item.kind, required: item.required, order: item.order, findingIds: item.findingIds })), unresolved: unresolvedBrief, rejected: pack.rejectedSolutions.slice(0, 10), comparisons: pack.team3.comparisons, documentation: pack.team3.documentation ? { overview: pack.team3.documentation.overview, flows: pack.team3.documentation.flows.slice(0, 6) } : null, devpack: pack.team3.devpack ? { purpose: pack.team3.devpack.purpose, roadmap: pack.team3.devpack.roadmap } : null, repository: intel.repository.summary });
      const ok = new Set(approved.map(item => item.id));
      pack.synthesis = { overview: output.overview, systemFlow: output.systemFlow.slice(0, 12).map(step => ({ ...step, files: step.files.filter(path => pathExists(store, path)).slice(0, 6) })), nextActions: output.nextActions.slice(0, 10).map(action => ({ ...action, solutionIds: action.solutionIds.filter(sid => ok.has(sid)) })), limitations: output.limitations };
      setAgent('core', 'completed', 'Final pack ready');
    } catch (error) { failed('core', error); pack.warnings.push(`Genius Core synthesis failed (${error.message}); the pack was assembled from the validated team outputs.`); }
    return finish('complete');
  } catch (error) {
    if (error instanceof GeniusError) { finish(error.kind === 'cancelled' ? 'cancelled' : 'failed'); error.pack = pack; throw error; }
    finish('failed'); throw new GeniusError(error.message || 'Deep Genius failed.', { kind: error.kind || 'error', pack });
  }
}

/** The final project intelligence object: twenty sections, each labeled with its basis. */
export function assembleIntelligence(result, pack, intel = buildIntel(result)) {
  const approved = pack.solutions.filter(item => item.status === 'APPROVED');
  const doc = pack.team3.documentation; const devpack = pack.team3.devpack; const synthesis = pack.synthesis;
  const inbound = new Map(); (result.dependencies || []).forEach(edge => inbound.set(edge.to, (inbound.get(edge.to) || 0) + 1));
  const critical = [...new Map([...(devpack?.essentialFiles || []).map(item => [item.path, { path: item.path, why: item.why, basis: 'genius' }]), ...(result.readingOrder || []).map(item => [item.path, { path: item.path, why: item.why, basis: 'verified' }]), ...[...inbound].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([path, count]) => [path, { path, why: `Imported by ${count} files read.`, basis: 'verified' }])]).values()].slice(0, 16);
  return {
    overview: { verified: result.summary, structure: result.structure || '', genius: synthesis?.overview || doc?.overview || '' },
    systemFlow: { steps: synthesis?.systemFlow?.length ? synthesis.systemFlow : (doc?.tour || []).map(step => ({ title: step.title, text: step.text, files: step.files })), tour: doc?.tour || [], basis: 'genius' },
    architecture: { mermaid: result.diagrams?.overview || result.diagrams?.architecture || '', notes: doc?.architectureNotes || [], subsystems: intel.subsystems.map(item => item.summary) },
    softwareHierarchy: { layers: intel.repository.layers },
    mindMap: { mermaid: result.diagrams?.conceptMindmap || result.diagrams?.mindmap || '' },
    criticalFiles: critical,
    auditFindings: pack.findings,
    validatedSolutions: approved.map(item => ({ ...item, comparison: pack.team3.comparisons.find(entry => entry.recommendedSolutionId === item.id) || null })),
    rejectedOrUnresolved: { rejected: pack.rejectedSolutions, unresolved: pack.unresolved },
    improvementOpportunities: approved.filter(item => !item.required || item.kind === 'innovation'),
    developmentSkills: { observed: result.skills?.observed || [], recommended: devpack?.recommendedSkills || [] },
    developmentPrompt: { purpose: devpack?.purpose || '', constraints: devpack?.constraints || [], conventions: devpack?.conventions || [], doNotBreak: devpack?.doNotBreak || [] },
    appBlueprint: devpack?.blueprint || [],
    implementationRoadmap: { phases: devpack?.roadmap || [], requiredFixes: approved.filter(item => item.required).sort((a, b) => a.order - b.order).map(item => ({ id: item.id, title: item.title, order: item.order })) },
    aiReadyContext: { onboarding: doc?.onboarding || '', flows: doc?.flows || [], implementationNotes: doc?.implementationNotes || [] },
    reconstructionContext: { notes: devpack?.reconstruction || [], testStrategy: devpack?.testStrategy || [], configuration: devpack?.configuration || [], dependencies: devpack?.dependencies || [] },
    diagrams: [['Architecture', result.diagrams?.overview || result.diagrams?.architecture], ['System map', result.ai?.graph?.mermaid], ['Repository mind map', result.diagrams?.conceptMindmap || result.diagrams?.mindmap]].filter(([, source]) => source).map(([title, source]) => ({ title, source })),
    limitations: [...new Set([...(synthesis?.limitations || []), ...(doc?.limitations || []), ...(devpack?.limitations || []), ...pack.warnings, `${result.coverage?.readFiles ?? 0} of ${result.coverage?.listedFiles ?? 0} files were read; evidence outside them was not available to any agent.`])],
    evidenceCoverage: pack.coverage,
    nextActions: synthesis?.nextActions?.length ? synthesis.nextActions : approved.filter(item => item.required).sort((a, b) => a.order - b.order).slice(0, 6).map(item => ({ action: item.title, why: item.description.slice(0, 240), solutionIds: [item.id] })),
  };
}
