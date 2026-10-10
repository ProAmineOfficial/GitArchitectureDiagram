// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-ENGINEERING-001
// Project: Git Architecture Diagram | Component: Make Any Product with Genius AI: the "Start from an Idea" workspace.
// Idea → questions → project (requirements, architecture, diagrams, files, validation report) → Development Pack.
// Projects live only in this tab (and in files the visitor exports); the server never saves them. Generation needs the
// visitor's own AI key and the operator's Genius Engineering Engine; without them the labeled ESP32 example is shown.
import { ARTIFACT_STATUS, ARTIFACT_CLASS, SOURCE_LABEL, CHECK_STATUS, checkProjectShape, dependencyMermaid, developmentPack, projectMarkdown, validationMarkdown } from './engineering.js';
import { renderPreview, validateSource } from './diagram.js';
import { download } from './exports.js';
import { readAnalysisResponse } from './analysis-stream.js';
import { redactFiles } from './secret-scan.js';
import { zipSync, strToU8 } from '/vendor/fflate/browser.js';

const EXAMPLE_URL = '/assets/engineering/example-esp32.json';
const TABS = [['overview', 'Overview'], ['requirements', 'Requirements'], ['architecture', 'Architecture'], ['files', 'Files'], ['validation', 'Validation'], ['pack', 'Development Pack']];

/** Create an element with an optional class and text. */
function el(tag, className = '', text = '') { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; }
function badge(text, tone = 'muted') { return el('span', `idea-badge tone-${tone}`, text); }
function tableOf(headers, rows) {
  const table = el('table', 'idea-table'); const head = table.createTHead().insertRow();
  for (const header of headers) head.append(el('th', '', header));
  const body = table.createTBody();
  for (const row of rows) { const tr = body.insertRow(); for (const value of row) { const td = tr.insertCell(); if (value instanceof Node) td.append(value); else td.textContent = value ?? ''; } }
  const wrap = el('div', 'idea-table-wrap'); wrap.append(table); return wrap;
}

/**
 * Wire the workspace. `credentials()` returns { apiKey, model, provider } from API settings (memory only).
 */
export function setupIdeaWorkspace({ credentials, aiConfigured, toast, openSettings }) {
  const $ = selector => document.querySelector(selector);
  const view = $('#idea-view'); if (!view) return { show() {} };
  const state = { project: null, tab: 'overview', file: null, connected: false, busy: false, stale: false, controller: null, render: 0 };

  const progress = (text, error = false) => { const line = $('#idea-progress'); line.hidden = !text; line.textContent = text || ''; line.classList.toggle('error', error); };
  const setBusy = busy => { state.busy = busy; for (const id of ['#idea-run', '#idea-design', '#idea-skip', '#idea-example']) if ($(id)) $(id).disabled = busy; };

  async function refreshStatus() {
    try { const response = await fetch('/api/engineering/status'); state.connected = response.ok && Boolean((await response.json()).connected); } catch { state.connected = false; }
    const line = $('#idea-engine');
    line.textContent = state.connected ? 'Genius Engineering Engine: connected. Generation uses the AI key in API settings.' : 'Genius Engineering Engine: not connected on this site yet. You can explore the ESP32 example project.';
    line.classList.toggle('connected', state.connected);
  }

  /** Run one engineering stage on the server (which calls the private engine and the provider with this tab's key). */
  async function runStage(body, label) {
    const { apiKey, model, provider } = credentials();
    if (!state.connected) { progress('The Genius Engineering Engine is not connected on this site yet. Open the ESP32 example to explore the workspace.', true); return null; }
    if (!aiConfigured()) { progress('Add your AI provider key and model in API settings first.', true); openSettings(); return null; }
    state.controller?.abort(); state.controller = new AbortController(); setBusy(true); progress(label);
    try {
      const response = await fetch('/api/engineering/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, provider, model, apiKey }), signal: state.controller.signal });
      const result = await readAnalysisResponse(response, event => progress(`${event.stage}${event.detail ? ` · ${event.detail}` : ''}`), value => Boolean(value?.project));
      progress('');
      return result;
    } catch (error) { if (error.name !== 'AbortError') progress(error.message || 'The engineering run failed.', true); return null; }
    finally { setBusy(false); }
  }

  // ——— Idea → questions → design ———
  $('#idea-form').addEventListener('submit', async event => {
    event.preventDefault();
    const idea = $('#idea-text').value.trim();
    if (idea.length < 12) { progress('Describe your idea in at least a sentence.', true); return; }
    const result = await runStage({ stage: 'clarify', idea }, 'Genius AI is reading your idea…');
    if (result) { state.project = result.project; showQuestions(); }
  });
  function showQuestions() {
    const box = $('#idea-question-list'); box.replaceChildren();
    const questions = state.project.questions || [];
    for (const question of questions) {
      const row = el('label', 'idea-question'); row.append(el('span', 'idea-question-text', question.question));
      if (question.why) row.append(el('small', '', question.why));
      const input = el('input'); input.dataset.question = question.id; input.placeholder = question.default ? `Default: ${question.default}` : 'Your answer'; input.maxLength = 600; row.append(input);
      box.append(row);
    }
    if (!questions.length) box.append(el('p', 'idea-muted', 'No open questions: the idea is specific enough to design.'));
    $('#idea-questions').hidden = false; $('#idea-project').hidden = true;
    $('#idea-requirements-preview').replaceChildren(tableOf(['ID', 'Requirement', 'Priority', 'Source'], (state.project.requirements || []).map(item => [item.id, item.text, item.priority, SOURCE_LABEL[item.source] || item.source])));
    $('#idea-questions').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  async function design(useDefaults) {
    const answers = {};
    if (!useDefaults) for (const input of document.querySelectorAll('#idea-question-list input')) if (input.value.trim()) answers[input.dataset.question] = input.value.trim();
    const result = await runStage({ stage: 'design', project: state.project, answers }, 'Genius AI is designing the architecture…');
    if (result) openProject(result.project);
  }
  $('#idea-design').addEventListener('click', () => design(false));
  $('#idea-skip').addEventListener('click', () => design(true));

  // ——— Example and project files ———
  async function openExample() {
    setBusy(true); progress('Opening the ESP32 example…');
    try { const response = await fetch(EXAMPLE_URL); if (!response.ok) throw new Error(); const project = await response.json(); progress(''); openProject(project); } // Clear the progress line first, so the scroll position is not shifted afterwards.
    catch { progress('The example project could not be loaded.', true); }
    finally { setBusy(false); }
  }
  $('#idea-example').addEventListener('click', openExample);
  $('#idea-import').addEventListener('click', () => $('#idea-file').click());
  $('#idea-file').addEventListener('change', async () => {
    const file = $('#idea-file').files[0]; $('#idea-file').value = '';
    if (!file) return;
    if (file.size > 2_500_000) { progress('That file is larger than 2.5 MB.', true); return; }
    let project; try { project = JSON.parse(await file.text()); } catch { progress('That file is not valid JSON.', true); return; }
    const problems = checkProjectShape(project);
    if (problems.length) { progress(`This is not a usable project file: ${problems[0]}`, true); return; }
    openProject(project); toast('Project imported. It stays in this tab until you export it again.');
  });

  function openProject(project) {
    const problems = checkProjectShape(project);
    if (problems.length) { progress(`The project could not be shown: ${problems[0]}`, true); return; }
    state.project = project; state.stale = false; state.file = project.artifacts?.[0]?.id || null;
    $('#idea-questions').hidden = true; $('#idea-project').hidden = false;
    const banner = $('#idea-banner');
    banner.hidden = !project.provenance?.example;
    banner.textContent = project.provenance?.example ? 'Example project — prepared by Pro_Amine LLC to show the workspace, not generated from your text. Its validation report was produced by the Genius Engineering Engine\'s code checks.' : '';
    $('#idea-project-title').textContent = project.title;
    $('#idea-project-summary').textContent = project.summary || '';
    const badges = $('#idea-badges'); badges.replaceChildren(...(project.domains || []).map(domain => badge(domain, 'info')), ...(project.targets || []).map(target => badge(target.name || target.id, 'muted')));
    selectTab('overview');
    $('#idea-project').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // ——— Tabs ———
  const tabBar = $('#idea-tabs');
  for (const [id, label] of TABS) { const button = el('button', 'idea-tab', label); button.type = 'button'; button.setAttribute('role', 'tab'); button.dataset.tab = id; button.addEventListener('click', () => selectTab(id)); tabBar.append(button); }
  function selectTab(tab) {
    state.tab = tab;
    for (const button of tabBar.querySelectorAll('.idea-tab')) button.setAttribute('aria-selected', String(button.dataset.tab === tab));
    const panel = $('#idea-panel'); panel.replaceChildren(); const render = ++state.render; // Diagrams render asynchronously; a newer tab wins.
    ({ overview: renderOverview, requirements: renderRequirements, architecture: renderArchitecture, files: renderFiles, validation: renderValidation, pack: renderPack })[tab](panel, () => render === state.render);
  }

  function renderOverview(panel) {
    const project = state.project; const report = project.validation;
    const stats = el('div', 'idea-stats');
    for (const [value, label] of [[project.requirements?.length || 0, 'requirements'], [project.components?.length || 0, 'components'], [project.interfaces?.length || 0, 'interfaces'], [project.diagrams?.length || 0, 'diagrams'], [project.artifacts?.length || 0, 'files']]) { const tile = el('div', 'idea-stat'); tile.append(el('strong', '', String(value)), el('span', '', label)); stats.append(tile); }
    panel.append(stats);
    if (report) panel.append(el('p', 'idea-muted', `Validation: ${report.summary.pass} pass · ${report.summary.warn} warnings · ${report.summary.fail} failures · ${report.summary.notRun} not run${state.stale ? ' — files changed since this report' : ''}.`));
    if ((project.risks || []).length) { panel.append(el('h3', '', 'Risks')); panel.append(tableOf(['ID', 'Risk', 'Severity', 'Mitigation'], project.risks.map(item => [item.id, item.text, badge(item.severity, item.severity === 'high' ? 'bad' : item.severity === 'medium' ? 'warn' : 'muted'), item.mitigation]))); }
    if ((project.milestones || []).length) { panel.append(el('h3', '', 'Milestones')); panel.append(tableOf(['ID', 'Milestone', 'Deliverables', 'After'], project.milestones.map(item => [item.id, item.title, (item.deliverables || []).join(', '), (item.dependsOn || []).join(', ')]))); }
    const meta = project.provenance || {};
    panel.append(el('p', 'idea-muted', meta.example ? 'Prepared example; no AI model was used for this project.' : `Generated by ${meta.provider || 'an AI provider'} ${meta.model || ''} through the Genius Engineering Engine ${meta.engineVersion || ''} on ${meta.generatedAt ? new Date(meta.generatedAt).toLocaleString() : 'an unknown date'}. Everything AI-generated is a proposal until validation, tools, and people confirm it.`));
  }

  function renderRequirements(panel) {
    const project = state.project;
    panel.append(el('h3', '', 'Requirements'), tableOf(['ID', 'Requirement', 'Kind', 'Priority', 'Source'], (project.requirements || []).map(item => [item.id, item.text, item.kind, item.priority, badge(SOURCE_LABEL[item.source] || item.source, item.source === 'user' || item.source === 'user-confirmed' ? 'good' : item.source === 'assumed' ? 'warn' : 'info')])));
    if ((project.assumptions || []).length) panel.append(el('h3', '', 'Assumptions'), tableOf(['ID', 'Assumption'], project.assumptions.map(item => [item.id, item.text])));
    if ((project.questions || []).length) panel.append(el('h3', '', 'Questions'), tableOf(['ID', 'Question', 'Answer'], project.questions.map(item => [item.id, item.question, item.answer || (item.default ? `Not answered — assumed: ${item.default}` : 'Not answered')])));
    if ((project.validationPlan || []).length) panel.append(el('h3', '', 'Verification plan'), tableOf(['ID', 'Test', 'Verifies', 'Method', 'Tool'], project.validationPlan.map(item => [item.id, item.title, (item.verifies || []).join(', '), item.method, item.tool || ''])));
  }

  async function renderArchitecture(panel, current) {
    const project = state.project;
    const diagrams = [...(project.diagrams || []), { id: 'deps', title: 'Components and interfaces (drawn from the project data)', mermaid: dependencyMermaid(project) }];
    for (const diagram of diagrams) {
      if (!current()) return;
      const card = el('figure', 'idea-diagram'); const canvas = el('div', 'idea-diagram-canvas'); const caption = el('figcaption', '', diagram.title);
      card.append(canvas, caption); panel.append(card);
      const check = await validateSource(diagram.mermaid);
      if (!current()) return;
      if (!check.ok || !(await renderPreview(canvas, diagram.mermaid))) { canvas.append(el('pre', 'idea-code', diagram.mermaid)); caption.append(' — ', badge(`Mermaid parser: ${check.ok ? 'could not render' : check.message}`, 'bad')); }
      else caption.append(' ', badge('Mermaid syntax checked in your browser', 'info'));
    }
    if (!current()) return;
    panel.append(el('h3', '', 'Components'), tableOf(['ID', 'Component', 'Kind', 'Part number', 'Satisfies', 'Depends on'], (project.components || []).map(item => [item.id, item.name, item.kind, item.partNumber || '', (item.satisfies || []).join(', '), (item.dependsOn || []).join(', ')])));
    if ((project.interfaces || []).length) panel.append(el('h3', '', 'Interfaces'), tableOf(['ID', 'From', 'To', 'Kind', 'Signals', 'Voltage'], project.interfaces.map(item => [item.id, item.from, item.to, item.kind, (item.signals || []).join(', '), item.voltage ? `${item.voltage} V` : ''])));
    if ((project.pinMap || []).length) panel.append(el('h3', '', 'Pin map'), tableOf(['GPIO', 'Signal', 'Component', 'Direction', 'Voltage'], project.pinMap.map(item => [item.gpio, item.signal, item.component, item.direction, item.voltage ? `${item.voltage} V` : ''])));
    if ((project.bom || []).length) panel.append(el('h3', '', 'Bill of materials'), tableOf(['Ref', 'Part number', 'Description', 'Qty', 'Component'], project.bom.map(item => [item.ref, item.partNumber || '—', item.description, item.quantity, item.component])));
  }

  function statusBadge(status) { const info = ARTIFACT_STATUS[status] || ARTIFACT_STATUS.generated; return badge(info.label, info.tone); }
  function renderFiles(panel) {
    const project = state.project; const files = project.artifacts || [];
    if (!files.length) { panel.append(el('p', 'idea-muted', 'This project has no files yet.')); return; }
    const layout = el('div', 'idea-files'); const list = el('nav', 'idea-file-list'); list.setAttribute('aria-label', 'Project files');
    const editor = el('div', 'idea-editor'); layout.append(list, editor); panel.append(layout);
    const show = id => {
      state.file = id; const artifact = files.find(item => item.id === id); if (!artifact) return;
      for (const button of list.querySelectorAll('button')) button.setAttribute('aria-current', String(button.dataset.file === id));
      editor.replaceChildren();
      const head = el('div', 'idea-editor-head'); head.append(el('strong', '', artifact.path), statusBadge(artifact.status), badge(ARTIFACT_CLASS[artifact.class] || artifact.class, 'muted'));
      if (artifact.tool) head.append(badge(artifact.tool, 'muted'));
      editor.append(head, el('p', 'idea-muted', artifact.purpose || ''));
      const area = el('textarea', 'idea-code-editor'); area.value = artifact.content; area.spellcheck = false; area.setAttribute('aria-label', `Edit ${artifact.path}`);
      area.addEventListener('input', () => { artifact.content = area.value; if (artifact.status !== 'edited') { artifact.status = 'edited'; state.stale = true; head.children[1].replaceWith(statusBadge('edited')); list.querySelector(`[data-file="${id}"] .idea-badge`)?.replaceWith(statusBadge('edited')); } });
      editor.append(area);
      const checks = (project.validation?.checks || []).filter(check => check.target === artifact.id);
      if (checks.length) editor.append(tableOf(['Check', 'Status', 'Evidence'], checks.map(check => [check.title, badge(CHECK_STATUS[check.status], toneOf(check.status)), check.evidence])));
      const actions = el('div', 'idea-actions');
      const revalidate = el('button', 'quiet-button', 'Re-validate'); revalidate.type = 'button'; revalidate.addEventListener('click', revalidateProject);
      const instruction = el('input', 'idea-instruction'); instruction.placeholder = 'Instruction for Genius AI, e.g. "read the sensor every 5 seconds"'; instruction.maxLength = 1000;
      const regenerate = el('button', 'quiet-button', 'Regenerate this file'); regenerate.type = 'button';
      regenerate.addEventListener('click', async () => { const result = await runStage({ stage: 'regenerate', project: state.project, artifactId: artifact.id, instruction: instruction.value.trim() }, `Genius AI is rewriting ${artifact.path}…`); if (result) { state.project = result.project; state.stale = false; selectTab('files'); show(artifact.id); toast(`${artifact.path} regenerated and re-validated.`); } });
      const save = el('button', 'quiet-button', 'Download file'); save.type = 'button'; save.addEventListener('click', () => download(artifact.path.split('/').pop(), artifact.content));
      actions.append(revalidate, instruction, regenerate, save); editor.append(actions);
    };
    for (const artifact of files) { const button = el('button', 'idea-file'); button.type = 'button'; button.dataset.file = artifact.id; button.append(el('span', '', artifact.path), statusBadge(artifact.status)); button.addEventListener('click', () => show(artifact.id)); list.append(button); }
    show(state.file && files.some(item => item.id === state.file) ? state.file : files[0].id);
  }

  async function revalidateProject() {
    if (!state.connected) { progress('Re-validation runs in the Genius Engineering Engine, which is not connected on this site yet. Your edits are kept in this tab and in exported files.', true); return; }
    setBusy(true); progress('Re-validating with the Genius Engineering Engine…');
    try {
      const response = await fetch('/api/engineering/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: state.project }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.project) throw new Error(typeof body.error === 'string' ? body.error : `Validation failed (HTTP ${response.status}).`);
      state.project = body.project; state.stale = false; progress(''); selectTab(state.tab); toast('Validation report updated.');
    } catch (error) { progress(error.message, true); }
    finally { setBusy(false); }
  }

  const toneOf = status => ({ pass: 'good', warn: 'warn', fail: 'bad', not_run: 'muted' })[status] || 'muted';
  function renderValidation(panel) {
    const report = state.project.validation;
    if (!report) { panel.append(el('p', 'idea-muted', 'This project has no validation report yet.')); return; }
    const summary = el('div', 'idea-stats');
    for (const [key, label] of [['pass', 'pass'], ['warn', 'warnings'], ['fail', 'failures'], ['notRun', 'not run']]) { const tile = el('div', `idea-stat tone-${toneOf(key === 'notRun' ? 'not_run' : key)}`); tile.append(el('strong', '', String(report.summary[key])), el('span', '', label)); summary.append(tile); }
    panel.append(summary);
    panel.append(el('p', 'idea-note', 'Every check here is run by code, not by an AI model. "Not run" means the check needs a tool or a person that was not available, such as a compiler, a simulator, or a prototype on the bench. It is never counted as a pass.'));
    if (state.stale) panel.append(el('p', 'idea-progress error', 'Files changed since this report. Re-validate to update it.'));
    const tiers = new Map(); for (const check of report.checks) { if (!tiers.has(check.tier)) tiers.set(check.tier, []); tiers.get(check.tier).push(check); }
    for (const [tier, checks] of [...tiers.entries()].sort((a, b) => a[0] - b[0])) {
      panel.append(el('h3', '', `Tier ${tier} · ${checks[0].tierName || ''}`));
      panel.append(tableOf(['Check', 'Status', 'Tool', 'Evidence', 'Limitation and next step'], checks.map(check => [check.title, badge(CHECK_STATUS[check.status] || check.status, toneOf(check.status)), check.tool, check.evidence, [check.limitation, check.recommendation].filter(Boolean).join(' ')])));
    }
    panel.append(el('p', 'idea-muted', `Report ${report.generatedAt} · Genius Engineering Engine ${report.engineVersion}`));
  }

  function renderPack(panel) {
    const project = state.project; const { folder, files } = developmentPack(project);
    panel.append(el('p', '', `The Development Pack holds every engineering file at its path, plus the project data, the overview, the diagrams, and the validation report in ${folder}/.genius-project/. Credential-shaped values are redacted.`));
    panel.append(tableOf(['File', 'Status'], (project.artifacts || []).map(item => [item.path, statusBadge(item.status)])));
    const actions = el('div', 'idea-actions');
    const zip = el('button', 'primary-button', 'Download Development Pack (.zip)'); zip.type = 'button';
    zip.addEventListener('click', () => { const safe = redactFiles(files); download(`${folder}-development-pack.zip`, zipSync(Object.fromEntries(Object.entries(safe.files).map(([path, text]) => [path, strToU8(text)]))), 'application/zip'); if (safe.count) toast(`${safe.count} credential-shaped value(s) redacted.`); });
    const json = el('button', 'quiet-button', 'Export project file (.json)'); json.type = 'button'; json.addEventListener('click', () => download(`${folder}.gad-project.json`, JSON.stringify(project, null, 2), 'application/json'));
    const overview = el('button', 'quiet-button', 'Download overview (.md)'); overview.type = 'button'; overview.addEventListener('click', () => download(`${folder}-overview.md`, projectMarkdown(project)));
    const report = el('button', 'quiet-button', 'Download validation report (.md)'); report.type = 'button'; report.addEventListener('click', () => download(`${folder}-validation-report.md`, validationMarkdown(project)));
    actions.append(zip, json, overview, report); panel.append(actions);
  }

  return {
    async show() { document.title = 'Start from an Idea · Make Any Product with Genius AI'; await refreshStatus(); },
    openExample,
  };
}
