// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-ENGINEERING-001
// Project: Git Architecture Diagram | Component: Make Any Product with Genius AI in the unified workspace.
// An idea project (gad.project/1) opens in the same workspace as a repository: the Files sidebar lists its generated
// engineering files, the canvas shows its diagrams per Dock view, the Genius sidebar shows its status and next steps,
// and the Workspace view holds the composer and the project overview. Repository-only controls are hidden by CSS
// (#workspace[data-source=project] .repo-only). All project text is inserted with textContent; Markdown is sanitized.
import { ARTIFACT_CLASS, SOURCE_LABEL, checkProjectShape, developmentPack, projectMarkdown, validationMarkdown } from './engineering.js';
import { artifactTree, projectDiagrams, validationByTier, buildSteps, isStale, projectProgress, statusLine, summaryText, statusOf, checkLabel, originLabel, SHORT_STATUS } from './project-views.js';
import { setupIdeaComposer, IDEA_TITLE } from './idea.js';
import { download } from './exports.js';
import { redactFiles } from './secret-scan.js';
import { zipSync, strToU8 } from '/vendor/fflate/browser.js';

const CODE = /\.(m?[jc]?[jt]sx?|py|c|cc|cpp|h|hpp|ino|rs|go|java|kt|cs|rb|php|swift|vue|svelte|dart|ini|json|ya?ml|csv)$/i;
const DOC = /\.(md|mdx|mmd|rst|txt)$/i;
const toneOf = status => ({ pass: 'good', warn: 'warn', fail: 'bad', not_run: 'muted' })[status] || 'muted';

/**
 * Wire the project side of the workspace. `ctx` provides the application's state and helpers:
 * { state, $, $$, el, icon, toast, setDrawer, selectView, closeMenus, credentials, aiConfigured, openSettings, renderMarkdown, navigate, inputToPath }.
 */
export function setupProjectWorkspace(ctx) {
  const { state, $, $$, el, icon, toast, setDrawer, selectView, renderMarkdown } = ctx;
  const composer = setupIdeaComposer({ credentials: ctx.credentials, aiConfigured: ctx.aiConfigured, toast, openSettings: ctx.openSettings, onProject: (project, origin) => open(project, origin) });
  const badge = (text, tone = 'muted') => el('span', `idea-badge tone-${tone}`, text);
  const statusBadge = status => { const info = statusOf(status); return badge(info.label, info.tone); };
  const project = () => state.project;
  const log = text => { state.operations.unshift({ at: new Date(), text }); state.operations.length = Math.min(state.operations.length, 30); };
  const table = (headers, rows) => {
    const node = el('table', 'idea-table'); const head = node.createTHead().insertRow(); for (const header of headers) head.append(el('th', '', header));
    const body = node.createTBody(); for (const row of rows) { const tr = body.insertRow(); for (const value of row) { const td = tr.insertCell(); if (value instanceof Node) td.append(value); else td.textContent = value ?? ''; } }
    const wrap = el('div', 'idea-table-wrap'); wrap.append(node); return wrap;
  };
  const button = (text, handler, className = 'quiet-button') => { const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', handler); return node; };

  // ——— Entering the project side ———
  /** Show the project side: the open project, or the composer when there is none. */
  async function enter() {
    $('#workspace').dataset.source = 'project'; renderChrome();
    if (project()) { renderTree(); renderGenius(); renderInfo(); }
    else { $('#tree').replaceChildren(el('p', 'subtle tree-note', 'Engineering files appear here once a project is created or opened.')); $('#genius-content').replaceChildren(el('p', 'subtle', 'Start from an idea, open the example project, or import a project file. Genius explains the project here.')); }
    selectView('workspace'); await composer.show(); if (project()) document.title = `${project().title} · Git Architecture Diagram`;
  }

  /** Open a project in the workspace. `origin` is generated, example, or imported. */
  function open(next, origin) {
    const problems = checkProjectShape(next);
    if (problems.length) { toast(`The project could not be opened: ${problems[0]}`); return; }
    state.project = next; state.projectOrigin = origin; state.composing = false; state.edits.clear(); state.projectFile = null;
    log(origin === 'example' ? 'Opened the example project' : origin === 'imported' ? 'Imported a project file' : 'Designed the project with Genius AI');
    ctx.resetHighlights?.(); $('#file-inspector').hidden = true;
    renderChrome(); renderTree(); renderGenius(); renderInfo(); fillDocuments();
    document.title = `${next.title} · Git Architecture Diagram`;
    selectView('workspace');
    scrollTo({ top: 0 }); // The composer may be scrolled far down on a phone; the overview starts at its title.
  }

  /** Replace the project after an engine run, keeping the view and the open file. */
  function update(next, text) {
    state.project = next; log(text); state.edits.clear();
    renderChrome(); renderTree(); renderGenius(); renderInfo(); fillDocuments();
    if (state.projectFile) inspect(state.projectFile, { scroll: false });
    selectView(state.view);
  }

  function renderChrome() {
    const current = project(); const pill = $('#project-pill');
    $('#repo-title').textContent = current ? current.title : 'Start from an Idea';
    $('#scope-crumbs').hidden = true;
    pill.textContent = current ? `${originLabel(current, state.projectOrigin)} · ${statusLine(current)}` : 'New project';
    pill.dataset.tone = current && (current.validation?.summary.fail ? 'bad' : isStale(current) ? 'warn' : '') || '';
    $('#repo-description').textContent = current?.summary || '';
    $('#genius-mode').textContent = current ? originLabel(current, state.projectOrigin) : 'New project';
    $('#tree-count').textContent = String(current?.artifacts?.length || 0);
    $('#tree-foot').textContent = current ? 'Generated engineering files, not a repository. Badges show each file\'s status from the validation report.' : '';
    $('#docs-count').textContent = String(current?.diagrams?.length || 0); $('#docs-count').hidden = !current?.diagrams?.length;
    $('[data-view=system]').dataset.ready = String(Boolean(current?.diagrams?.length));
    for (const item of $$('#view-dock .dock-item')) { if (!current && item.dataset.view !== 'workspace') item.setAttribute('aria-disabled', 'true'); else item.removeAttribute('aria-disabled'); }
  }
  function fillDocuments() { $('#document-select').replaceChildren(...(project()?.diagrams || []).map((diagram, index) => { const option = el('option', '', diagram.title || diagram.id); option.value = String(index); return option; })); }

  // ——— Files sidebar: the engineering files, never a repository tree ———
  function fileButton(artifact, label = artifact.path.split('/').pop()) {
    const node = el('button', 'tree-file'); node.type = 'button';
    const info = statusOf(artifact.status); node.append(icon(CODE.test(artifact.path) ? 'code' : 'file'), el('span', 'name', label), badge(SHORT_STATUS[artifact.status] || info.label, info.tone));
    node.title = `${artifact.path} · ${info.label}`; node.dataset.path = artifact.path; node.dataset.project = 'true';
    if (state.projectFile === artifact.id) node.setAttribute('aria-current', 'true');
    node.addEventListener('click', () => inspect(artifact.id));
    return node;
  }
  function appendBranch(parent, branch) {
    const children = [...branch.children.values()].sort((a, b) => Number(b.type === 'tree') - Number(a.type === 'tree') || a.name.localeCompare(b.name));
    for (const child of children) {
      if (child.type === 'blob') { parent.append(fileButton(child.artifact)); continue; }
      const details = el('details'); details.open = true; details.dataset.path = child.path;
      const summary = el('summary'); summary.append(icon('folder'), el('span', 'name', child.name)); details.append(summary);
      const nested = el('div', 'tree-children'); appendBranch(nested, child); details.append(nested); parent.append(details);
    }
  }
  function renderTree() {
    const current = project(); const tree = $('#tree'); tree.replaceChildren(); if (!current) return;
    const query = $('#tree-search').value.toLowerCase().trim(); const filter = state.filter === 'read' ? 'all' : state.filter;
    if (query || filter !== 'all') {
      const tests = { all: () => true, code: path => CODE.test(path), docs: path => DOC.test(path) };
      const hits = (current.artifacts || []).filter(item => tests[filter](item.path) && (!query || item.path.toLowerCase().includes(query)));
      tree.append(el('p', 'subtle tree-note', `${hits.length} file${hits.length === 1 ? '' : 's'}`), ...hits.map(item => fileButton(item, item.path)));
      return;
    }
    const root = el('div', 'tree-root'); appendBranch(root, artifactTree(current)); tree.append(root);
  }

  // ——— File inspector: read, edit, regenerate, re-validate, download ———
  function inspect(id, { scroll = true } = {}) {
    const current = project(); const artifact = current?.artifacts?.find(item => item.id === id); if (!artifact) return;
    state.projectFile = id;
    $$('#tree [aria-current]').forEach(item => item.removeAttribute('aria-current')); $$('#tree .tree-file').find(item => item.dataset.path === artifact.path)?.setAttribute('aria-current', 'true');
    $('#file-inspector').hidden = false; $('#file-name').textContent = artifact.path;
    $('#file-info').textContent = [ARTIFACT_CLASS[artifact.class] || artifact.class, statusOf(artifact.status).label, artifact.tool, artifact.purpose].filter(Boolean).join(' · ');
    $('#inspector-actions').replaceChildren(); $('#file-relationships').replaceChildren();
    const checks = (current.validation?.checks || []).filter(check => check.target === artifact.id);
    for (const check of checks) { const row = el('p', 'reference-link'); row.append(badge(checkLabel(check.status), toneOf(check.status)), document.createTextNode(` ${check.title}: ${check.evidence}`)); $('#file-relationships').append(row); }
    const panel = $('#project-file'); panel.replaceChildren();
    const editor = el('textarea'); editor.value = artifact.content; editor.spellcheck = false; editor.setAttribute('aria-label', `Edit ${artifact.path}`);
    editor.addEventListener('input', () => {
      artifact.content = editor.value;
      if (artifact.status !== 'edited') { artifact.status = 'edited'; log(`Edited ${artifact.path}`); renderChrome(); renderTree(); renderGenius(); $('#file-info').textContent = [ARTIFACT_CLASS[artifact.class] || artifact.class, statusOf('edited').label, artifact.tool].filter(Boolean).join(' · '); }
    });
    const line = el('p', 'project-file-status'); line.setAttribute('role', 'status');
    const report = (text, error = false, actions = []) => { line.replaceChildren(); line.classList.toggle('error', error); if (text) line.append(text); for (const [label, action] of actions) line.append(' ', button(label, action, 'quiet-button idea-progress-action')); };
    const instruction = el('input', 'idea-instruction'); instruction.placeholder = 'Instruction for Genius AI, e.g. "read the sensor every 5 seconds"'; instruction.maxLength = 1000; instruction.setAttribute('aria-label', 'Instruction for rewriting this file');
    const actions = el('div', 'idea-actions');
    actions.append( // The instruction first and the buttons on the right, clear of the Files drawer when it is open.
      instruction,
      button('Regenerate this file', () => composer.regenerate({ project: current, artifactId: artifact.id, instruction: instruction.value.trim(), report, onDone: next => { update(next, `Regenerated ${artifact.path}`); toast(`${artifact.path} regenerated and re-validated.`); } })),
      button('Re-validate', () => composer.revalidate({ project: current, report, onDone: next => update(next, 'Re-validated the project') })),
      button('Download file', () => download(artifact.path.split('/').pop(), artifact.content)),
    );
    panel.append(editor, actions, line);
    if (scroll) $('#file-inspector').scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  // ——— Genius sidebar and Info ———
  function renderGenius() {
    const current = project(); const panel = $('#genius-content'); panel.replaceChildren(); if (!current) return;
    const section = (title, ...children) => { const block = el('section', 'genius-section'); block.append(el('h3', '', title), ...children); panel.append(block); };
    section('At a glance', el('p', '', current.summary || ''), el('p', 'fineprint', current.provenance?.example ? 'Example project, prepared by Pro_Amine LLC to show the workspace. It was not generated from your text.' : `${originLabel(current, state.projectOrigin)}. Everything generated is a proposal until validation, tools, and people confirm it.`));
    const report = current.validation; const stale = isStale(current);
    const validation = [el('p', '', report ? summaryText(report) : 'Not validated yet.')];
    if (stale) validation.push(el('p', 'idea-progress error', 'Files changed since this report. Re-validate to update it.'));
    validation.push(button('Open the validation details', () => selectView('pipeline')));
    section('Validation by code', ...validation);
    const steps = buildSteps(current);
    if (steps.length) { const list = el('ul', 'suggestions'); for (const step of steps) { const item = el('li'); item.append(el('strong', '', step.title), document.createTextNode(step.command ? ` — ${step.command}` : '')); list.append(item); } section('Build and test (not run here)', list, el('p', 'fineprint', 'These steps need a toolchain, a simulator, or a person. Nothing is compiled or executed on this site.')); panel.lastElementChild.id = 'project-build'; }
    if ((current.assumptions || []).length) { const list = el('ul', 'warning-list'); current.assumptions.forEach(item => list.append(el('li', '', `${item.id}: ${item.text}`))); section('Assumptions to confirm', list); }
    const open = (current.questions || []).filter(item => !item.answer); if (open.length) { const list = el('ul', 'warning-list'); open.forEach(item => list.append(el('li', '', `${item.question}${item.default ? ` (assumed: ${item.default})` : ''}`))); section('Open questions', list); }
  }
  function renderInfo() {
    const current = project(); const body = $('#info-body'); body.replaceChildren(); if (!current) return;
    const add = (title, ...children) => { const block = el('section', 'info-section'); block.append(el('h3', '', title), ...children); body.append(block); };
    const chips = items => { const row = el('div', 'chip-row'); items.forEach(item => row.append(el('span', 'info-chip', item))); return row; };
    add('What this project is', el('p', '', current.summary || ''), el('p', 'fineprint', originLabel(current, state.projectOrigin)));
    if ((current.domains || []).length) add('Domains', chips(current.domains));
    if ((current.targets || []).length) add('Targets', chips(current.targets.map(item => item.name || item.id)));
    add('Contents', el('p', '', `${(current.requirements || []).length} requirements, ${(current.components || []).length} components, ${(current.interfaces || []).length} interfaces, ${(current.diagrams || []).length} diagrams, ${(current.artifacts || []).length} files.`));
    add('Validation', el('p', '', statusLine(current)));
  }

  // ——— Panel views: Workspace, Genius guide, Process, Export Project ———
  /** Render a non-diagram view. Returns true when `view` is one of them. */
  function showPanel(view) {
    if (view === 'workspace') { renderHome(); $('#diagram-caption').textContent = project() ? 'The project at a glance. Every other view in the Dock shows the same project.' : 'Describe a product, open the example project, import a project file, or import a GitHub repository.'; return true; }
    if (!project()) return false;
    if (view === 'guide') { $('#guide').innerHTML = renderMarkdown(projectMarkdown(project())); $('#diagram-caption').textContent = 'The project overview as Markdown; the same text is in the Development Pack.'; return true; }
    if (view === 'pipeline') { renderProcess(); $('#diagram-caption').textContent = 'How the project was made and checked. Every check is run by code, not by an AI model.'; return true; }
    if (view === 'extract') { renderExport(); $('#diagram-caption').textContent = 'Every engineering file at its path, plus the project data, the diagrams, and the validation report.'; return true; }
    return false;
  }

  function renderHome() {
    const current = project(); const composing = !current || state.composing;
    $('#workspace-start').hidden = !composing; $('#workspace-overview').hidden = composing;
    $('#workspace-back').hidden = !current; $('#workspace-back').textContent = current ? `Back to ${current.title}` : '';
    if (composing) return;
    const view = $('#workspace-overview'); view.replaceChildren();
    const head = el('div', 'ws-head');
    if (current.provenance?.example) head.append(el('p', 'idea-banner', 'Example project — prepared by Pro_Amine LLC to show the workspace, not generated from your text. Its validation report was produced by the Genius Engineering Engine\'s code checks.'));
    const badges = el('div', 'idea-badges'); badges.append(badge(originLabel(current, state.projectOrigin), current.provenance?.example ? 'warn' : 'info'), ...(current.domains || []).map(item => badge(item, 'info')), ...(current.targets || []).map(item => badge(item.name || item.id, 'muted')));
    head.append(el('h2', '', current.title), el('p', '', current.summary || ''), badges);
    const steps = el('ol', 'ws-steps'); steps.setAttribute('aria-label', 'Project progress');
    for (const step of projectProgress(current)) { const item = el('li'); item.dataset.state = step.state; item.append(el('strong', '', step.label), el('span', '', step.detail)); steps.append(item); }
    const grid = el('div', 'ws-grid'); const card = (title, wide = false) => { const node = el('section', `ws-card${wide ? ' wide' : ''}`); node.append(el('h3', '', title)); grid.append(node); return node; };
    card('Requirements', true).append(table(['ID', 'Requirement', 'Priority', 'Source'], (current.requirements || []).map(item => [item.id, item.text, item.priority, badge(SOURCE_LABEL[item.source] || item.source, item.source === 'user' || item.source === 'user-confirmed' ? 'good' : item.source === 'assumed' ? 'warn' : 'info')])));
    const diagrams = card('Diagrams'); const links = el('div', 'ws-links');
    for (const item of projectDiagrams(current, state.projectOrigin)) links.append(button(item.label, () => { if (item.index !== undefined) $('#document-select').value = String(item.index); selectView(item.view); }));
    diagrams.append(links);
    const files = card('Engineering files'); const list = el('ul', 'ws-list');
    for (const artifact of current.artifacts || []) { const row = el('li'); row.append(button(artifact.path, () => { setDrawer('tree', true); inspect(artifact.id); }, 'link'), statusBadge(artifact.status)); list.append(row); }
    files.append(list.childElementCount ? list : el('p', 'idea-muted', 'No files yet.'));
    const validation = card('Validation'); const report = current.validation;
    validation.append(el('p', '', report ? summaryText(report) : 'Not validated yet.'), el('p', 'idea-muted', 'Checks are run by code. "Not run" means a tool or a person was not available; it is never counted as a pass.'), button('Open the validation details', () => selectView('pipeline')));
    if (report && isStale(current)) validation.append(button('Re-validate now', () => composer.revalidate({ project: current, report: (text, error) => { if (text) toast(text); }, onDone: next => update(next, 'Re-validated the project') }), 'primary-button'));
    const operations = card('Recent operations'); const ops = el('ul', 'ws-list ws-ops');
    for (const item of state.operations.slice(0, 8)) { const row = el('li'); const time = el('time', '', item.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); row.append(time, document.createTextNode(item.text)); ops.append(row); }
    for (const change of (current.changes || []).slice(-3).reverse()) ops.append(el('li', '', `${change.summary}${change.at ? ` (${new Date(change.at).toLocaleDateString()})` : ''}`));
    operations.append(ops);
    const exports = card('Exports'); const exportLinks = el('div', 'ws-links');
    exportLinks.append(button('Development Pack (.zip)', downloadPack), button('Project file (.json)', downloadJSON), button('Export Project view', () => selectView('extract')));
    exports.append(exportLinks);
    const actions = el('div', 'idea-actions'); actions.append(button('New project', () => { state.composing = true; renderHome(); $('#idea-text').focus(); }), button('Open Genius', () => setDrawer('genius', true)));
    view.append(head, steps, grid, actions);
  }

  function renderProcess() {
    const current = project(); const view = $('#pipeline-view'); view.replaceChildren(); const panel = el('div', 'project-panel');
    panel.append(el('h3', '', 'How this project was made'));
    const steps = el('ol', 'ws-steps'); for (const step of projectProgress(current)) { const item = el('li'); item.dataset.state = step.state; item.append(el('strong', '', step.label), el('span', '', step.detail)); steps.append(item); }
    panel.append(steps, el('p', 'idea-note', 'Every check here is run by code, not by an AI model. "Not run" means the check needs a tool or a person that was not available, such as a compiler, a simulator, or a prototype on the bench. It is never counted as a pass.'));
    if (isStale(current)) panel.append(el('p', 'idea-progress error', 'Files changed since this report. Re-validate to update it.'));
    for (const tier of validationByTier(current)) {
      panel.append(el('h3', '', `Tier ${tier.tier} · ${tier.name}`));
      panel.append(table(['Check', 'Status', 'Tool', 'Evidence', 'Limitation and next step'], tier.checks.map(check => [check.title, badge(checkLabel(check.status), toneOf(check.status)), check.tool, check.evidence, [check.limitation, check.recommendation].filter(Boolean).join(' ')])));
    }
    if (!current.validation) panel.append(el('p', 'idea-muted', 'This project has no validation report yet.'));
    else panel.append(el('p', 'idea-muted', `Report ${current.validation.generatedAt} · Genius Engineering Engine ${current.validation.engineVersion}`));
    view.append(panel);
  }

  function packFiles() { const { folder, files } = developmentPack(project()); return { folder, safe: redactFiles(files) }; }
  function downloadPack() { const { folder, safe } = packFiles(); download(`${folder}-development-pack.zip`, zipSync(Object.fromEntries(Object.entries(safe.files).map(([path, text]) => [path, strToU8(text)]))), 'application/zip'); log('Downloaded the Development Pack'); if (safe.count) toast(`${safe.count} credential-shaped value(s) redacted.`); }
  function downloadJSON() { const { folder } = developmentPack(project()); download(`${folder}.gad-project.json`, JSON.stringify(project(), null, 2), 'application/json'); log('Exported the project file'); }
  function renderExport() {
    const current = project(); const view = $('#extract-view'); view.replaceChildren(); const panel = el('div', 'project-panel');
    const { folder } = developmentPack(current);
    panel.append(el('h3', '', 'Development Pack'), el('p', '', `Every engineering file at its path, plus the project data, the overview, the diagrams, and the validation report in ${folder}/.genius-project/. Credential-shaped values are redacted.`));
    panel.append(table(['File', 'Status'], (current.artifacts || []).map(item => [item.path, statusBadge(item.status)])));
    const actions = el('div', 'idea-actions');
    actions.append(button('Download Development Pack (.zip)', downloadPack, 'primary-button'), button('Export project file (.json)', downloadJSON), button('Download overview (.md)', () => download(`${folder}-overview.md`, projectMarkdown(current))), button('Download validation report (.md)', () => download(`${folder}-validation-report.md`, validationMarkdown(current))));
    panel.append(actions); view.append(panel);
  }

  // ——— Diagrams and the Mermaid Source editor ———
  /** The diagram a Dock view shows for the open project, in the shape the canvas expects. */
  function diagramFor(view) {
    const current = project(); if (!current) return null;
    const list = projectDiagrams(current, state.projectOrigin);
    const found = view === 'documented' ? list.find(item => item.view === 'documented' && item.index === (Number($('#document-select').value) || 0)) : list.find(item => item.view === view);
    return found ? { ...found, paths: {}, legend: [], edgeLegend: [] } : null;
  }
  function sourceTargets() { const current = project(); return current ? projectDiagrams(current, state.projectOrigin) : []; }

  // ——— The Workspace › Start alternatives ———
  $('#workspace-repo-form').addEventListener('submit', event => {
    event.preventDefault(); const path = ctx.inputToPath($('#workspace-repo').value, location.host);
    if (!path) { toast('Enter a GitHub repository, for example github.com/owner/repository.'); return; }
    ctx.navigate(path);
  });
  $('#workspace-back').addEventListener('click', () => { state.composing = false; renderHome(); });

  return { enter, open, diagramFor, sourceTargets, renderTree, showPanel, inspect, exportName: () => developmentPack(project() || { title: 'project' }).folder, focusBuild: () => { setDrawer('genius', true); setTimeout(() => $('#project-build')?.scrollIntoView({ block: 'start' }), 80); }, title: IDEA_TITLE };
}
