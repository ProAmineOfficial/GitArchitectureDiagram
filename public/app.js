// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-WORKSPACE-UI-001
// Project: Git Architecture Diagram | Component: Repository workspace | Author: Amine Saoud ibn al-Bashir.
// Routing, analysis runs, and the three-panel workspace. Repository-derived text is always inserted with
// textContent (never innerHTML) except the sanitized guide, and every source link is pinned to the analyzed commit.
import { marked } from '/vendor/marked/marked.esm.js';
import DOMPurify from '/vendor/dompurify/purify.es.mjs';
import { renderDiagram, redrawDiagram, clearDiagram, getSource, getSVG, zoom, fit, validateSource, lightTint, decorate } from './diagram.js';
import { startTour, stopTour, tourActive } from './tour.js';
import { setupExtras, openDoc, runAction } from './extras.js';
import { setupExtractView } from './extract-view.js';
import { setupDock } from './dock.js';
import { exportGuide, exportDiagram } from './exports.js';
import { readAnalysisResponse } from './analysis-stream.js';
import { PROVIDERS, MODEL_ROLES, ROLE_LABELS, CATALOG_CHECKED, roleOf, checkKeyFormat } from './providers.js';
import { setupSocialDock } from './social-dock.js'; // Glass social dock with proximity magnification.
import { redactSecrets } from './secret-scan.js'; // Copied and downloaded text never carries credential-shaped values.
import { setupDeepGenius, errorTitle } from './deep-genius.js';
import { pinnedSourceURL } from './source-navigation.js';
import { icon, installIcons } from './icons.js';
import { parseRoute, workspacePath, inputToPath, lineAnchor, DEFAULT_FILES } from './route.js';
import { setupAsk } from './ask.js';
import { renderBrowse, renderStarters } from './browse.js';
import { setupBrand } from './brand.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const state = { result: null, view: 'architecture', mode: 'overview', drill: '', controller: null, filter: 'all', current: null, edits: new Map(), cache: new Map(), displayKey: '', maxFiles: 120, pairs: {}, role: 'fast', deepCache: new Map() };
const CODE = /\.(m?[jc]?[jt]sx?|py|c|cc|cpp|h|hpp|ino|rs|go|java|kt|cs|rb|php|swift|vue|svelte)$/i;
const DOC = /\.(md|mdx|mmd|rst|txt)$/i;
const VIEWS = new Set(['system', 'architecture', 'hierarchy', 'mindmap', 'documented', 'source', 'guide', 'extract', 'pipeline']);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Create an element with safe text content. */
function el(tag, className, text) { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; }
let toastTimer;
function toast(text) { $('#toast').textContent = text; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200); }
function status(text, { error = false, progress = null } = {}) { $('#status').hidden = false; $('#status').classList.toggle('error', error); $('#status-text').textContent = text; $('#status-progress').style.width = progress === null ? '0' : `${Math.round(progress * 100)}%`; $('#status').classList.toggle('has-progress', progress !== null); }
function hideStatus() { $('#status').hidden = true; }
const sourceURL = (path, line) => pinnedSourceURL(state.result.repository, { path, line, type: 'blob' });

// ——— Credentials and request settings (memory only) ———
function requestHeaders() { return { 'Content-Type': 'application/json' }; } // No instance password and no GitHub token: the public site needs neither.
function credentials() { return { apiKey: $('#api-key').value.trim(), model: $('#model').value.trim(), provider: $('#provider').value }; } // The provider key entered in this tab, for the AI request being made.
function aiConfigured() { const { apiKey, model } = credentials(); return Boolean(apiKey && model); }
function analysisMode() { return document.querySelector('[name=analysis-mode]:checked')?.value || 'quick'; }
function setMode(mode) { const input = document.querySelector(`[name=analysis-mode][value=${mode}]`); if (input) input.checked = true; $('#use-ai').checked = mode === 'genius'; updateCostNote(); }

// ——— Pages and routing ———
function showPage(page) {
  const bar = $('.command-bar'); if (page === 'home') $('#hero-slot').append(bar); else if (bar.parentElement !== $('#main')) $('#main').prepend(bar); bar.classList.toggle('tucked', page === 'repo'); // Home centers the input; a repository page tucks it away.
  $('#welcome').hidden = page !== 'home'; $('#browse-view').hidden = page !== 'browse'; $('#workspace').hidden = page !== 'repo';
  $('#workspace-nav').toggleAttribute('aria-current', page !== 'browse'); $('#browse-nav').toggleAttribute('aria-current', page === 'browse');
  if (page === 'browse') { document.title = 'Browse examples · Git Architecture Diagram'; renderBrowse(); }
  if (page === 'home') document.title = 'Git Architecture Diagram';
}
const keyOf = (pathname = location.pathname, search = location.search) => pathname.replace(/\/+$/, '') + search;

function cancelRun() { const running = state.controller; state.controller = null; if (running) { running.abort(); setBusy(false); } } // Leaving a route discards its unfinished analysis without touching history.
async function route() {
  const target = parseRoute(location.pathname, location.search, location.hash);
  if (target.page === 'invalid') { cancelRun(); showPage('home'); status(target.reason, { error: true }); return; }
  if (target.page !== 'repo') { cancelRun(); hideStatus(); showPage(target.page); return; }
  const key = keyOf();
  if (state.result && state.displayKey === key) { cancelRun(); hideStatus(); showPage('repo'); applyFocus(target.lines); return; } // Only the line anchor changed.
  if (state.cache.has(key)) { cancelRun(); hideStatus(); state.result = state.cache.get(key); state.displayKey = key; showPage('repo'); showResult(); applyFocus(target.lines); return; } // Back/forward to a snapshot analyzed in this tab.
  $('#repository').value = target.repository; $('#ref').value = target.ref; $('#scope').value = target.scope;
  $('#max-files').value = String(Math.min(target.files || DEFAULT_FILES, state.maxFiles));
  await analyze({ history: 'replace', lines: target.lines, view: new URLSearchParams(location.search).get('view') });
}
function navigate(path) { history.pushState({}, '', path); route(); }
document.addEventListener('click', event => { // Keep internal links inside the single-page workspace.
  const link = event.target.closest('a[data-internal]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault(); navigate(link.getAttribute('href'));
});
window.addEventListener('popstate', route);

// ——— Analysis ———
function setBusy(busy) {
  $('#analyze').disabled = busy; $('#cancel').hidden = !busy; $('#refresh').disabled = busy;
  $('#analyze').textContent = busy ? 'Analyzing…' : 'Analyze';
  $('#workspace').setAttribute('aria-busy', String(busy));
}
async function analyze({ refresh = false, history: mode = 'push', lines = null, view = null } = {}) {
  if (state.controller) state.controller.abort();
  const controller = new AbortController(); state.controller = controller; setBusy(true);
  status('Connecting to GitHub…', { progress: 0 });
  const deepAfter = analysisMode() === 'deep'; const input = { repository: $('#repository').value.trim(), ref: $('#ref').value.trim(), scope: $('#scope').value.trim(), maxFiles: Number($('#max-files').value) || DEFAULT_FILES, ai: $('#use-ai').checked, refresh, ...($('#use-ai').checked ? credentials() : {}) }; // The provider key travels only with an AI request.
  try {
    const response = await fetch('/api/analyze', { method: 'POST', headers: requestHeaders(), body: JSON.stringify(input), signal: controller.signal });
    const result = await readAnalysisResponse(response, event => status(`${event.stage}${event.detail ? ` — ${event.detail}` : ''}`, { progress: Number.isFinite(event.read) && event.total ? event.read / event.total : null }));
    if (state.controller !== controller) return; // A newer run replaced this one.
    state.result = result; state.edits.clear();
    const path = workspacePath(result.repository, { focus: result.repository.focus, lines, files: input.maxFiles });
    if (location.pathname + location.search + location.hash !== path) window.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', path);
    state.displayKey = keyOf(); remember(state.displayKey, result);
    hideStatus(); showPage('repo'); showResult(); if (VIEWS.has(view)) selectView(view); applyFocus(lines);
    if (deepAfter && !result.deep) deep.confirm(); // Deep Genius always asks before spending model calls.
  } catch (error) {
    if (state.controller !== controller) return;
    status(error.name === 'AbortError' ? 'Analysis cancelled.' : error.message, { error: error.name !== 'AbortError' });
  } finally { if (state.controller === controller) { state.controller = null; setBusy(false); } }
}
function remember(key, result) { state.cache.set(key, result); while (state.cache.size > 4) state.cache.delete(state.cache.keys().next().value); }

// ——— Result presentation ———
function showResult() {
  const { result } = state; const repo = result.repository; state.drill = ''; state.mode = result.diagrams.overview ? 'overview' : 'files';
  $('#file-inspector').hidden = true; $('#search-results').replaceChildren(); state.current = null;
  $('#repo-title').textContent = repo.fullName; $('#repo-description').textContent = repo.description || '';
  document.title = `${repo.fullName}${repo.scope ? '/' + repo.scope : ''} · Git Architecture Diagram`;
  $('#commit').replaceChildren(icon('branch'), document.createTextNode(` ${repo.branch === repo.sha ? repo.sha.slice(0, 7) : repo.branch} · ${repo.sha.slice(0, 7)}${repo.private ? ' · private' : ''}`));
  $('#commit').title = `Analyzed commit ${repo.sha}${repo.committedAt ? `, committed ${new Date(repo.committedAt).toUTCString()}` : ''}. Select to change the branch, tag, or commit.`;
  renderCrumbs(); renderMetrics();
  $('#architecture-mode').value = state.mode; $('#architecture-mode option[value=overview]').disabled = !result.diagrams.overview;
  $('#docs-count').textContent = result.documented.length; $('#docs-count').hidden = !result.documented.length; // Show the count only when there are diagrams.
  $('#document-select').replaceChildren(...result.documented.map((item, index) => { const option = el('option', '', `${item.path}:${item.line}`); option.value = index; return option; }));
  $('#tree-search').value = ''; setFilter('all', false); renderTree(); revealInTree(repo.scope, { select: false });
  $('#tree-count').textContent = String(repo.listedEntries ?? repo.entries.length);
  $('#tree-foot').textContent = `${result.coverage.readFiles} of ${result.coverage.listedFiles} files read. Unread files are dimmed; their contents were not analyzed.${result.coverage.treeTruncated ? ' The listing is partial.' : ''}`;
  renderGenius(); renderGuide(); fillSourceTargets(); renderInfo(); closeMenus(); extras.reset(); extractView.reset(); deep.reset(); $('#genius-focus').hidden = true;
  $('[data-view=system]').dataset.ready = String(Boolean(result.ai?.graph));
  state.defaultView = result.ai?.graph ? 'system' : repo.scope && result.documented.length && !result.dependencies.length && !result.diagrams.components?.some(item => item.read && item.kind === 'source') ? 'documented' : 'architecture';
  selectView(result.ai?.graph ? 'system' : repo.scope && result.documented.length && !result.dependencies.length && !result.diagrams.components?.some(item => item.read && item.kind === 'source') ? 'documented' : 'architecture');
}

function renderCrumbs() {
  const repo = state.result.repository; const nav = $('#scope-crumbs'); nav.replaceChildren();
  const parts = repo.scope ? repo.scope.split('/') : [];
  const link = (label, scope) => { const anchor = el('a', 'crumb', label); anchor.href = workspacePath({ ...repo, scope, focus: '' }, { files: state.result.coverage.maxFiles }); anchor.dataset.internal = ''; return anchor; };
  nav.append(link(repo.repo, ''));
  parts.forEach((part, index) => { nav.append(el('span', 'crumb-sep', '/')); if (index === parts.length - 1) { const current = el('span', 'crumb current', part); current.setAttribute('aria-current', 'location'); nav.append(current); } else nav.append(link(part, parts.slice(0, index + 1).join('/'))); });
  nav.hidden = !parts.length;
}

function renderMetrics() {
  const { coverage, dependencies, documented, diagrams, cacheHit } = state.result;
  const items = [[coverage.listedFiles, 'files listed'], [coverage.readFiles, 'read'], [coverage.followedReferences || 0, 'reached by following references'], [dependencies.length, 'local imports located'], [documented.length, 'authored diagrams'], [diagrams.components?.filter(item => item.name !== '.').length || 0, 'top-level folders']];
  $('#metrics').replaceChildren(...items.map(([value, label]) => { const item = el('span', 'metric'); item.append(el('strong', '', String(value)), document.createTextNode(` ${label}`)); return item; }));
  const fresh = el('span', 'metric freshness', cacheHit ? 'Reused analysis of this commit' : 'Fresh analysis');
  if (coverage.rateLimit?.remaining !== undefined && coverage.rateLimit?.remaining !== null) fresh.title = `GitHub requests left this hour: ${coverage.rateLimit.remaining}`;
  $('#metrics').append(fresh);
}

// ——— Views ———
function diagramFor(view = state.view) {
  const { result } = state; const d = result.diagrams;
  if (view === 'system') { const a = result.ai?.diagrams; if (!a || !result.ai.graph) return null; return { key: 'ai', label: 'System map', source: a.architecture, paths: a.nodePaths || {}, legend: (a.legend || []).map(item => ({ ...item, label: `${item.label} (${item.count})` })), edgeLegend: a.edgeLegend, legendTitle: 'Kinds', basis: result.ai.saved ? 'AI system map, saved for this commit' : 'AI system map. Check the evidence', caption: `${result.ai.providerName} · ${result.ai.model}. Solid arrows cite a line the model was shown; dotted arrows are inferences; dashed shapes have no file.`, tour: result.ai.graph.tour || [], flowEdges: result.ai.graph.flowEdges || [] }; }
  if (view === 'mindmap' && $('#mindmap-mode').value !== 'folders' && d.conceptMindmap) return { key: 'concepts', label: 'Repository mind map', source: d.conceptMindmap, paths: d.conceptMindmapPaths || {}, legend: (d.conceptMindmapLegend || []).map(item => ({ ...item, label: `${item.label} (${item.count})` })), legendTitle: 'Concepts', basis: 'Concepts from the analysis. Select one to explore it everywhere', caption: 'Each concept maps to repository paths: selecting it explains it in Genius and can highlight it in the diagrams and hierarchy.' };
  if (view === 'mindmap') return { key: 'mindmap', label: 'Mind map', source: d.mindmap, paths: d.mindmapPaths || {}, legend: (d.mindmapLegend || []).map(item => ({ ...item, label: `${item.label} (${item.count})` })), legendTitle: 'Folders', basis: 'Folder hierarchy from the file tree', caption: 'Bounded preview: up to 14 folders and 5 files each; the full inventory is in the file tree.' };
  if (view === 'documented') { const item = result.documented[Number($('#document-select').value) || 0]; return item ? { key: `doc:${item.path}:${item.line}`, label: `${item.path}:${item.line}`, source: item.source, paths: {}, basis: 'Written by the repository author', caption: 'Authored intent, shown with its original styles. It is not a runtime verification.', item } : null; }
  if (state.mode === 'ai' && result.ai?.diagrams) { const a = result.ai.diagrams; return { key: 'ai', label: 'Genius interpretation', source: a.architecture, paths: a.nodePaths || {}, legend: (a.legend || []).map(item => ({ ...item, label: `${item.label} (${item.count})` })), edgeLegend: a.edgeLegend, legendTitle: 'Kinds', basis: 'AI interpretation. Check the evidence', caption: `${result.ai.providerName} · ${result.ai.model}. Dotted arrows are inferences; dashed nodes have no verified file.` }; }
  if (state.mode === 'files' || !d.overview) {
    const graph = state.drill ? d.componentGraphs?.[state.drill] : d;
    if (!graph) return null;
    return { key: state.drill ? `files:${state.drill}` : 'files', label: state.drill ? `Files in ${state.drill}` : 'Files and imports', source: graph.architecture, paths: graph.nodePaths || {}, legend: (graph.legend || []).map(item => ({ ...item, label: `${item.label} (${item.count})` })), legendTitle: 'Role hints from file names', basis: 'Located imports and includes', caption: `${graph.displayedFiles} files shown, ${graph.omittedNodes} omitted. Colors are file-name hints, not verified behavior.` };
  }
  return { key: 'overview', label: 'Components', source: d.overview, paths: d.overviewPaths || {}, legend: (d.overviewLegend || []).map(item => ({ ...item, label: `${item.label} (${item.count})` })), edgeLegend: d.overviewEdges, legendTitle: 'Kinds', basis: 'Folders from the file tree; arrows from located imports', caption: `${d.components.length} components. Select one to inspect it, or switch to Files and imports for file-level detail.${d.overviewTour?.length ? ' Play the tour for a guided walk from the README and entry point, built only from located evidence.' : ''}`, tour: d.overviewTour || [] };
}

async function selectView(next, { focusTab = false } = {}) {
  state.view = next; if (tourActive()) stopTour({ refit: false }); $('#system-empty').hidden = true; $('#tour-start').hidden = true; $('#tour-action').hidden = true;
  $$('#view-dock [role=tab]').forEach(tab => { const selected = tab.dataset.view === next; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; if (selected && focusTab) tab.focus(); });
  const isDiagram = ['system', 'architecture', 'mindmap', 'documented'].includes(next); $('#hierarchy-view').hidden = next !== 'hierarchy'; $('#extract-view').hidden = next !== 'extract'; $('#pipeline-view').hidden = next !== 'pipeline'; $('#mindmap-mode-label').hidden = next !== 'mindmap';
  $('#canvas').hidden = !isDiagram; $('#source-view').hidden = next !== 'source'; $('#guide').hidden = next !== 'guide';
  $('.diagram-meta').hidden = !isDiagram; $('#diagram-legend').hidden = true;
  $('#architecture-mode-label').hidden = next !== 'architecture'; $('#drill-chip').hidden = !(next === 'architecture' && state.mode === 'files' && state.drill);
  $('#document-picker').hidden = next !== 'documented' || !state.result.documented.length;
  $('.node-action').hidden = next === 'documented';
  $('#diagram-source-link').hidden = true;
  if (next === 'pipeline') { deep.renderPipeline(); $('#diagram-caption').textContent = 'How Genius Core coordinates three teams of three agents. Solid entries are verified at this commit; dotted entries are Genius inference.'; return; }
  if (next === 'extract') { extractView.render(); $('#diagram-caption').textContent = 'Clone the source, export project files and diagrams, skills, prompts, plans, and AI-ready knowledge. Repository text is shown as plain text.'; return; }
  if (next === 'hierarchy') { extras.renderHierarchyView(); $('#diagram-caption').textContent = 'How the software is organized: layers, components, and key files. Repository Tree shows where files are; this shows what they are for.'; return; }
  if (next === 'source') { $('#diagram-caption').textContent = 'Edit any diagram source; Preview edits renders it in its own view.'; loadSourceEditor(); return; }
  if (next === 'guide') { $('#diagram-caption').textContent = 'The same guide is in the .genius export, with every citation pinned to this commit.'; return; }
  const diagram = diagramFor(next);
  if (next === 'system' && !diagram) { $('#canvas').hidden = true; $('.diagram-meta').hidden = true; renderSystemEmpty(); $('#system-empty').hidden = false; $('#diagram-caption').textContent = 'The system map is optional and uses an AI model; every other view works without one.'; return; }
  if (!diagram) { $('#diagram-basis').textContent = ''; clearDiagram(next === 'documented' ? 'No Mermaid diagrams were found in the files read.\nIncrease the file budget or open a documentation folder.' : 'Nothing to draw for this view.'); $('#diagram-caption').textContent = ''; return; }
  const edited = state.edits.get(diagram.key);
  $('#diagram-basis').textContent = edited ? 'Edited preview · source links removed' : diagram.basis;
  $('#diagram-basis').dataset.basis = edited ? 'edited' : next === 'documented' ? 'documented' : next === 'system' ? 'inferred' : 'observed';
  $('#diagram-caption').textContent = diagram.caption;
  if (diagram.item) { $('#diagram-source-link').hidden = false; $('#diagram-source-link').href = sourceURL(diagram.item.path, diagram.item.line); }
  if (!diagram.item) $('#drill-label').textContent = state.drill ? `Files in ${state.drill}` : '';
  renderLegend(diagram, edited);
  await renderDiagram(edited ?? diagram.source, edited ? {} : diagram.paths, navigateTarget, { generated: !edited && next !== 'documented' });
  if (state.view !== next) return; queueMicrotask(() => extras.afterRender(next)); decorate({ flowEdges: edited ? [] : diagram.flowEdges || [] }); $('#tour-start').hidden = !((next === 'system' || (next === 'architecture' && diagram.key === 'overview')) && !edited && diagram.tour?.length); $('#tour-action').hidden = $('#tour-start').hidden;
}

function renderLegend(diagram, edited) {
  const legend = $('#diagram-legend');
  if (edited || (!diagram.legend?.length && !diagram.edgeLegend?.length)) { legend.hidden = true; return; }
  legend.replaceChildren(el('span', 'legend-label', diagram.legendTitle || 'Legend'));
  for (const item of diagram.legend || []) { const entry = el('span', 'legend-item'); const swatch = el('i'); const light = document.documentElement.dataset.theme === 'light' && /^#[0-9a-f]{6}$/i.test(item.stroke || ''); const tint = light ? lightTint(item.stroke) : item; swatch.style.borderColor = tint.stroke; swatch.style.backgroundColor = tint.fill || 'transparent'; if (item.dashed) swatch.style.borderStyle = 'dashed'; entry.append(swatch, document.createTextNode(item.label)); legend.append(entry); }
  for (const item of diagram.edgeLegend || []) { const entry = el('span', `legend-item edge-${item.basis}`); entry.append(el('b', '', ''), document.createTextNode(item.label)); legend.append(entry); }
  legend.hidden = false;
}

// ——— Node, tree, and inspector navigation ———
function navigateTarget(target) {
  if (target.paths?.length) { extras.selectPaths({ paths: target.paths, label: target.concept || target.path, line: target.line }); return; } // Mind map concepts select across views.
  if ($('#node-action').value === 'github') { window.open(pinnedSourceURL(state.result.repository, target), '_blank', 'noopener,noreferrer'); return; }
  inspect(target);
}

function buildTree() {
  const root = { children: new Map(), path: '', type: 'tree' };
  for (const entry of state.result.repository.entries) {
    const parts = entry.path.split('/'); let branch = root;
    parts.forEach((name, index) => { if (!branch.children.has(name)) branch.children.set(name, { name, path: parts.slice(0, index + 1).join('/'), children: new Map(), type: 'tree' }); branch = branch.children.get(name); if (index === parts.length - 1) branch.type = entry.type; });
  }
  return root;
}
const readSet = () => new Set(state.result.files.map(file => file.path));
function fileButton(path, label = path.split('/').pop(), read = readSet()) {
  const button = el('button', 'tree-file'); button.type = 'button';
  button.append(icon(CODE.test(path) ? 'code' : 'file'), el('span', 'name', label));
  button.title = read.has(path) ? `${path} (read)` : `${path} (listed, not read)`;
  button.dataset.path = path; button.dataset.read = String(read.has(path));
  if (state.current?.path === path) button.setAttribute('aria-current', 'true');
  button.addEventListener('click', () => inspect({ path, type: 'blob' }));
  return button;
}
function appendBranches(parent, branch, read) {
  const children = [...branch.children.values()].sort((a, b) => Number(b.type === 'tree') - Number(a.type === 'tree') || a.name.localeCompare(b.name));
  for (const child of children) {
    if (child.type !== 'tree') { parent.append(fileButton(child.path, child.name + (child.type === 'commit' ? ' (submodule)' : ''), read)); continue; }
    const details = el('details'); details.dataset.path = child.path;
    const summary = el('summary'); summary.append(icon('folder'), el('span', 'name', child.name)); details.append(summary);
    let populated = false; const populate = () => { if (populated) return; populated = true; const nested = el('div', 'tree-children'); appendBranches(nested, child, read); details.append(nested); };
    details.addEventListener('reveal', populate); details.addEventListener('toggle', () => { if (details.open) populate(); });
    summary.addEventListener('dblclick', event => { event.preventDefault(); inspect({ path: child.path, type: 'tree' }); });
    parent.append(details);
  }
}
function setFilter(filter, render = true) { state.filter = filter; $$('#tree-filters .chip').forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.filter === filter))); if (render) renderTree(); }
function renderTree() {
  const query = $('#tree-search').value.toLowerCase().trim(); const read = readSet(); const tree = $('#tree'); tree.replaceChildren();
  if (query || state.filter !== 'all') {
    const tests = { all: () => true, read: path => read.has(path), code: path => CODE.test(path), docs: path => DOC.test(path) };
    const hits = state.result.repository.entries.filter(entry => entry.type !== 'tree' && tests[state.filter](entry.path) && (!query || entry.path.toLowerCase().includes(query)));
    tree.append(el('p', 'subtle tree-note', `${hits.length} file${hits.length === 1 ? '' : 's'}${hits.length > 200 ? ', showing the first 200' : ''}`), ...hits.slice(0, 200).map(entry => fileButton(entry.path, entry.path, read)));
    return;
  }
  const root = el('div', 'tree-root'); appendBranches(root, buildTree(), read); tree.append(root);
}
function revealInTree(path, { select = true } = {}) {
  if (!path) return;
  if ($('#tree-search').value || state.filter !== 'all') { $('#tree-search').value = ''; setFilter('all'); }
  const parts = path.split('/');
  for (let index = 1; index <= parts.length; index++) { const folder = $$('#tree details').find(item => item.dataset.path === parts.slice(0, index).join('/')); if (folder) { folder.dispatchEvent(new Event('reveal')); folder.open = true; } }
  if (!select) return;
  $$('#tree [aria-current]').forEach(item => item.removeAttribute('aria-current'));
  const selected = $$('#tree .tree-file').find(item => item.dataset.path === path) || $$('#tree details').find(item => item.dataset.path === path)?.querySelector('summary');
  if (selected) { selected.setAttribute('aria-current', 'true'); selected.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); }
}

function applyFocus(lines) { const focus = state.result?.repository.focus; if (focus) inspect({ path: focus, type: 'blob' }, { lines, scroll: false }); }

function inspect(target, { lines = null, scroll = true } = {}) {
  const { result } = state; const repo = result.repository;
  const path = target.path; const folder = target.type === 'tree';
  state.current = { path, type: folder ? 'tree' : 'blob', lines };
  const file = folder ? null : result.files.find(item => item.path === path);
  $('#file-inspector').hidden = false; $('#file-name').textContent = path || repo.fullName;
  $('#source-link').href = pinnedSourceURL(repo, { path, type: folder ? 'tree' : 'blob' }) + (lines && !folder ? lineAnchor(lines) : '');
  const actions = $('#inspector-actions'); actions.replaceChildren(); $('#file-relationships').replaceChildren();
  const code = $('#file-code'); code.replaceChildren();
  if (folder) {
    const inside = repo.entries.filter(item => item.type !== 'tree' && (!path || item.path.startsWith(path + '/')));
    const read = inside.filter(item => result.files.some(fileItem => fileItem.path === item.path)).length;
    const component = result.diagrams.components?.find(item => item.folder === path);
    $('#file-info').textContent = `Folder at commit ${repo.sha.slice(0, 7)}. ${inside.length} files listed, ${read} read${component ? `. Classified as ${component.kind} from its name and contents` : ''}.`;
    if (result.diagrams.componentGraphs?.[path]) { const show = el('button', 'quiet-button', 'Show files and imports'); show.type = 'button'; show.addEventListener('click', () => drillInto(path)); actions.append(show); }
    if (path !== repo.scope) { const deeper = el('a', 'quiet-button', 'Analyze this folder'); deeper.href = workspacePath({ ...repo, scope: path, focus: '' }, { files: result.coverage.maxFiles }); deeper.dataset.internal = ''; actions.append(deeper); }
    code.textContent = inside.slice(0, 150).map(item => (path ? item.path.slice(path.length + 1) : item.path)).join('\n') + (inside.length > 150 ? `\n… ${inside.length - 150} more in the file tree` : '');
  } else if (file) {
    const edges = result.dependencies.filter(edge => edge.from === path || edge.to === path);
    const all = file.content.split('\n');
    const start = lines ? Math.max(1, lines.start - 30) : 1; const end = Math.min(all.length, start + 299);
    $('#file-info').textContent = `${file.size.toLocaleString('en')} bytes · lines ${start}–${end} of ${all.length} · ${file.reason || 'read'} · blob ${file.sha.slice(0, 10)}`;
    const fragment = document.createDocumentFragment();
    for (let number = start; number <= end; number++) {
      const row = el('span', 'code-line'); if (lines && number >= lines.start && number <= lines.end) row.classList.add('highlight');
      const anchor = el('a', 'line-number', String(number)); anchor.href = `#L${number}`; anchor.dataset.line = String(number);
      row.append(anchor, el('span', 'line-text', all[number - 1] + '\n')); fragment.append(row);
    }
    code.append(fragment);
    edges.slice(0, 20).forEach(edge => { const row = el('a', 'reference-link', `${edge.from}:${edge.line} ${edge.kind === 'include' ? 'includes' : 'imports'} ${edge.to}`); row.href = sourceURL(edge.from, edge.line); row.target = '_blank'; row.rel = 'noreferrer'; $('#file-relationships').append(row); });
    if (lines) requestAnimationFrame(() => code.querySelector('.highlight')?.scrollIntoView({ block: 'center', behavior: 'auto' }));
  } else {
    const skipped = result.coverage.skipped.find(item => item.path === path);
    $('#file-info').textContent = skipped ? `Listed but not read: ${skipped.reason}` : 'Listed but not read, so its contents are not part of this analysis.';
    const open = el('a', 'quiet-button', 'Analyze with this file first'); open.href = workspacePath(repo, { focus: path, files: result.coverage.maxFiles }); open.dataset.internal = ''; actions.append(open);
    code.textContent = 'Source preview is available for files that were read.';
  }
  revealInTree(path);
  if (scroll) $('#file-inspector').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' });
}
$('#file-code').addEventListener('click', event => { // Line numbers set a shareable GitHub-style anchor.
  const anchor = event.target.closest('.line-number'); if (!anchor || !state.current) return; event.preventDefault();
  const line = Number(anchor.dataset.line); const lines = event.shiftKey && state.current.lines ? { start: Math.min(state.current.lines.start, line), end: Math.max(state.current.lines.start, line) } : { start: line, end: line };
  state.current.lines = lines; $$('#file-code .highlight').forEach(row => row.classList.remove('highlight'));
  $$('#file-code .line-number').forEach(item => { const number = Number(item.dataset.line); if (number >= lines.start && number <= lines.end) item.parentElement.classList.add('highlight'); });
  $('#source-link').href = sourceURL(state.current.path) + lineAnchor(lines);
  if (state.result.repository.focus === state.current.path) history.replaceState({}, '', location.pathname + location.search + lineAnchor(lines));
});
function drillInto(folder) { state.mode = 'files'; state.drill = folder; $('#architecture-mode').value = 'files'; selectView('architecture'); $('#canvas').scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); }

// ——— Action bar: info, export, drawers, layout ———
function renderInfo() {
  const { result } = state; const body = $('#info-body'); body.replaceChildren();
  const add = (title, ...children) => { const block = el('section', 'info-section'); block.append(el('h3', '', title), ...children); body.append(block); };
  const chips = items => { const row = el('div', 'chip-row'); items.forEach(item => row.append(el('span', 'info-chip', item))); return row; };
  const readme = result.files.find(file => /(^|\/)readme(\.md)?$/i.test(file.path))?.content.split('\n').find(line => line.trim().length > 40 && !/^[#!<[|>]/.test(line.trim()));
  add('What this project does', el('p', '', result.ai?.overview || readme?.trim().slice(0, 400) || result.summary), ...(result.ai?.overview ? [el('p', 'fineprint', 'Genius interpretation.')] : readme ? [el('p', 'fineprint', 'From the README.')] : []));
  const type = result.hierarchy?.source.type; add('Architecture style', el('p', '', `${{ embedded: 'Embedded / firmware project', application: 'Application', library: 'Library or toolkit' }[type] || 'Repository'} organized as ${result.hierarchy?.source.root.children.map(layer => layer.label.toLowerCase()).join(', ') || 'a flat set of files'}.`));
  const stack = result.skills?.observed.filter(item => ['Languages', 'Frontend', 'Backend', 'Embedded', 'Database', 'AI / ML'].includes(item.category)).slice(0, 8).map(item => item.name) || []; if (stack.length) add('Primary stack', chips(stack));
  const core = (result.diagrams.components || []).filter(item => item.name !== '.' && item.read).slice(0, 6); if (core.length) add('Core components', chips(core.map(item => `${item.name} · ${item.kind}`)));
  if (result.entrypoints.length) add('Likely entry points', chips(result.entrypoints.slice(0, 4).map(item => item.path.split('/').pop())));
  if (result.externalModules?.length) add('Key dependencies', chips(result.externalModules.slice(0, 8)));
  if (result.readingOrder?.length) { const list = el('ol', 'reading-order compact'); result.readingOrder.slice(0, 5).forEach(item => { const row = el('li'); const button = el('button', 'genius-file', item.path.split('/').pop()); button.type = 'button'; button.title = item.path; button.addEventListener('click', () => { closeMenus(); inspect({ path: item.path, type: 'blob' }); }); row.append(button, el('span', 'why', item.why)); list.append(row); }); add('Where to start reading', list); }
  const inbound = new Map(); result.dependencies.forEach(edge => inbound.set(edge.to, (inbound.get(edge.to) || 0) + 1)); const hubs = [...inbound].sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (hubs.length) add('Important files', chips(hubs.map(([path, count]) => `${path.split('/').pop()} · imported ${count}×`)));
  add('Analysis coverage', el('p', '', `${result.coverage.readFiles} of ${result.coverage.listedFiles} files read (${result.coverage.followedReferences || 0} reached by following references). ${result.coverage.treeTruncated ? 'The file listing is partial. ' : ''}${result.warnings.length ? `${result.warnings.length} note${result.warnings.length > 1 ? 's' : ''} in Genius.` : ''}`));
  const fanIn = hubs[0]?.[1] || 0; add('Complexity hints', el('p', '', `${(result.diagrams.components || []).filter(item => item.name !== '.').length} top-level folders, ${result.dependencies.length} located imports, ${result.externalModules?.length || 0} external modules, highest fan-in ${fanIn}.`));
  const more = el('div', 'info-actions'); [['Open Genius', () => setDrawer('genius', true)], ['Build with Genius', () => { setDrawer('genius', true); $('#build-genius').scrollIntoView({ block: 'start' }); }], ['Export options', () => toggleMenu('#export-toggle', '#export-menu')]].forEach(([text, handler]) => { const button = el('button', 'glass-pill', text); button.type = 'button'; button.addEventListener('click', event => { event.stopPropagation(); closeMenus(); handler(); }); more.append(button); }); body.append(more);
}
function closeMenus(except = null) { if (except !== '#export-menu') { homeExportMenu(); $('#dock-export')?.setAttribute('aria-expanded', 'false'); } for (const [toggle, panel] of [['#info-toggle', '#info-panel'], ['#export-toggle', '#export-menu'], ['#hl-toggle', '#hl-menu']]) { if (panel === except) continue; $(panel).hidden = true; $(toggle).setAttribute('aria-expanded', 'false'); } }
function toggleMenu(toggle, panel) { const open = $(panel).hidden; closeMenus(panel); $(panel).hidden = !open; $(toggle).setAttribute('aria-expanded', String(open)); if (open) $(panel).querySelector('button, a')?.focus({ preventScroll: true }); }
$('#info-toggle').addEventListener('click', event => { event.stopPropagation(); toggleMenu('#info-toggle', '#info-panel'); });
$('#export-toggle').addEventListener('click', event => { event.stopPropagation(); homeExportMenu(); toggleMenu('#export-toggle', '#export-menu'); });
const exportHome = $('#export-menu').parentElement; // One export menu, shown from the command bar or the dock.
function homeExportMenu() { const menu = $('#export-menu'); menu.removeAttribute('style'); delete menu.dataset.anchor; if (menu.parentElement !== exportHome) exportHome.append(menu); }
function openExportFromDock(button) {
  const menu = $('#export-menu'); const wasOpen = !menu.hidden && menu.dataset.anchor === 'dock'; closeMenus(); if (wasOpen) return;
  document.body.append(menu); menu.dataset.anchor = 'dock'; menu.hidden = false; const rect = button.getBoundingClientRect(); const width = menu.offsetWidth; // Leave the glass bar: backdrop-filter would trap position:fixed.
  Object.assign(menu.style, { position: 'fixed', top: `${Math.round(rect.bottom + 12)}px`, left: `${Math.round(Math.max(12, Math.min(innerWidth - width - 12, rect.left + rect.width / 2 - width / 2)))}px`, right: 'auto' });
  button.setAttribute('aria-expanded', 'true'); menu.querySelector('[role=menuitem]:not([hidden])')?.focus({ preventScroll: true });
}
$('#dock-export').addEventListener('click', event => { event.stopPropagation(); openExportFromDock(event.currentTarget); });
$('#dock-build').addEventListener('click', () => { setDrawer('genius', true); setTimeout(() => $('#build-genius').scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' }), 80); });
$('#zoom-toggle').addEventListener('click', () => { const on = $('#canvas').dataset.wheel !== 'on'; $('#canvas').dataset.wheel = on ? 'on' : 'off'; $('#zoom-toggle').setAttribute('aria-pressed', String(on)); toast(on ? 'Scrolling over the diagram now zooms.' : 'Scrolling scrolls the page again; click the diagram to zoom.'); });
setupDock($('#view-dock'));
$('#hl-toggle').addEventListener('click', event => { event.stopPropagation(); toggleMenu('#hl-toggle', '#hl-menu'); });
$('#mindmap-mode').addEventListener('change', () => selectView('mindmap'));
document.addEventListener('click', event => { if (!event.target.closest('.menu, .popover')) closeMenus(); });
$$('#export-menu [data-export]').forEach(item => item.addEventListener('click', async () => { closeMenus(); if (!state.result) return; const format = item.dataset.export; if (format === 'copy') { try { await navigator.clipboard.writeText(getSource()); toast('Mermaid source copied.'); } catch { toast('Copying is blocked here; use Mermaid source (.mmd).'); } return; } try { await exportDiagram(format, getSource(), getSVG(), `${state.result.repository.repo}-${diagramFor()?.key.replace(/[^a-z0-9]+/gi, '-') || state.view}`); } catch (error) { toast(error.message); } }));
$('#fullscreen-action').addEventListener('click', () => $('#fullscreen').click());
$('#tour-action').addEventListener('click', () => $('#tour-start').click());
$('#change-repo').addEventListener('click', () => { const bar = $('.command-bar'); bar.classList.toggle('tucked'); if (!bar.classList.contains('tucked')) { $('#repository').select(); $('#repository').focus(); } });
function focusLayout() { return $('#studio').dataset.layout === 'focus'; }
function placeDrawers() { if ($('#workspace').hidden) return; const top = Math.max($('.action-bar').getBoundingClientRect().bottom, $('.topbar').getBoundingClientRect().bottom) + 8; $('#studio').style.setProperty('--drawer-top', `${Math.round(top)}px`); } // Drawers start below the action bar so its toggles stay reachable.
addEventListener('scroll', placeDrawers, { passive: true }); addEventListener('resize', placeDrawers);
function syncDrawers() { placeDrawers(); for (const pane of ['tree', 'genius']) { const open = $('#studio').dataset[pane] === 'open'; $(`[data-drawer=${pane}]`).setAttribute('aria-pressed', String(open)); const collapse = $(`[data-collapse=${pane}]`); collapse.setAttribute('aria-expanded', String(open)); } $('#layout-toggle').setAttribute('aria-pressed', String(!focusLayout())); }
function setDrawer(pane, open) { $('#studio').dataset[pane] = open ? 'open' : 'closed'; syncDrawers(); if (!focusLayout()) try { localStorage.setItem(`gad-${pane}`, open ? 'open' : 'closed'); } catch { /* optional */ } }
$$('[data-drawer]').forEach(button => button.addEventListener('click', () => setDrawer(button.dataset.drawer, $('#studio').dataset[button.dataset.drawer] !== 'open')));
function setLayout(layout, save = true) { const studio = $('#studio'); studio.dataset.layout = layout; const open = layout === 'studio'; studio.dataset.tree = open ? 'open' : 'closed'; studio.dataset.genius = open ? 'open' : 'closed'; $('#layout-toggle').setAttribute('aria-label', open ? 'Diagram-first layout' : 'Show panels side by side'); $('#layout-toggle').title = $('#layout-toggle').getAttribute('aria-label'); syncDrawers(); if (save) try { localStorage.setItem('gad-layout', layout); } catch { /* optional */ } }
$('#layout-toggle').addEventListener('click', () => setLayout(focusLayout() ? 'studio' : 'focus'));

// ——— Genius panel ———
function renderGenius() {
  const { result } = state; const panel = $('#genius-content'); panel.replaceChildren();
  $('#genius-mode').textContent = result.deep ? 'Deep Genius + source' : result.ai ? 'AI + source' : 'Source mode';
  const section = (title, ...children) => { const block = el('section', 'genius-section'); block.append(el('h3', '', title), ...children); panel.append(block); };
  section('At a glance', el('p', '', result.summary));
  if (result.structure) section('Structure', el('p', '', result.structure));
  if (result.readingOrder?.length) {
    const list = el('ol', 'reading-order');
    const scopePrefix = result.repository.scope ? result.repository.scope + '/' : ''; result.readingOrder.forEach(item => { const entry = el('li'); const button = el('button', 'genius-file', item.path.startsWith(scopePrefix) ? item.path.slice(scopePrefix.length) : item.path); button.title = item.path; button.type = 'button'; button.addEventListener('click', () => inspect({ path: item.path, type: 'blob' })); entry.append(button, el('span', 'why', item.why)); list.append(entry); });
    section('Suggested reading order', list, el('p', 'fineprint', 'Ordered from files the analyzer read: the README, manifests, declared entry points, then the most-imported modules.'));
  }
  if (result.technologies.length) section('Stack hints', el('p', '', `${result.technologies.join(', ')}, from manifest file names.`));
  const checks = el('div', 'checks'); result.checks.forEach(check => { const row = el('div', 'check-row'); row.append(el('span', '', check.name), el('span', check.found ? 'found' : 'missing', check.found ? 'Present' : 'Not found')); checks.append(row); });
  section('Documentation', checks);
  if (result.ai) {
    const block = [el('p', '', result.ai.overview)];
    result.ai.components.slice(0, 8).forEach(item => { const row = el('p', 'genius-item'); const link = el('a', '', item.path); link.href = sourceURL(item.path); link.target = '_blank'; link.rel = 'noreferrer'; row.append(link, document.createTextNode(` — ${item.description}`)); block.push(row); });
    if (result.ai.recommendations.length) { const list = el('ul', 'suggestions'); result.ai.recommendations.forEach(item => list.append(el('li', '', item))); block.push(el('h4', '', 'Suggestions (not findings)'), list); }
    if (result.ai.graphNotes?.length) block.push(el('p', 'fineprint', `Validation removed or downgraded ${result.ai.graphNotes.length} graph item${result.ai.graphNotes.length > 1 ? 's' : ''}: ${result.ai.graphNotes.slice(0, 2).join(' ')}`));
    const usage = result.ai.usage ? ` · ${result.ai.usage.input_tokens ?? result.ai.usage.prompt_tokens ?? result.ai.usage.promptTokenCount ?? '?'} input / ${result.ai.usage.output_tokens ?? result.ai.usage.completion_tokens ?? result.ai.usage.candidatesTokenCount ?? '?'} output tokens` : '';
    block.push(el('p', 'fineprint', `${result.ai.providerName} · ${result.ai.model}${usage}. An interpretation of ${result.ai.includedPaths.length} excerpts; review the cited source.`));
    section('Genius AI interpretation', ...block);
  }
  const warnings = el('ul', 'warning-list'); [...result.warnings, ...(result.ai?.limitations || [])].forEach(item => warnings.append(el('li', '', item)));
  section('Coverage and limits', warnings);
}
function renderGuide() {
  $('#guide').innerHTML = DOMPurify.sanitize(marked.parse(state.result.guide), { FORBID_TAGS: ['img', 'iframe', 'video', 'audio', 'form', 'style', 'input'], FORBID_ATTR: ['style'] });
  $('#guide').querySelectorAll('a').forEach(anchor => { if (!anchor.href.startsWith('https://github.com/')) anchor.removeAttribute('href'); anchor.target = '_blank'; anchor.rel = 'noreferrer'; });
}

// ——— Mermaid source editor ———
function sourceTargets() {
  const { result } = state; const d = result.diagrams; const targets = [];
  if (d.overview) targets.push({ key: 'overview', label: 'Architecture: components', view: 'architecture', mode: 'overview', source: d.overview });
  targets.push({ key: 'files', label: 'Architecture: files and imports', view: 'architecture', mode: 'files', source: d.architecture });
  if (result.ai?.diagrams) targets.push({ key: 'ai', label: 'System map (AI)', view: 'system', source: result.ai.diagrams.architecture });
  targets.push({ key: 'mindmap', label: 'Mind map', view: 'mindmap', source: d.mindmap });
  result.documented.forEach((item, index) => targets.push({ key: `doc:${item.path}:${item.line}`, label: `Authored: ${item.path}:${item.line}`, view: 'documented', index, source: item.source }));
  return targets;
}
function fillSourceTargets() { $('#source-target').replaceChildren(...sourceTargets().map(target => { const option = el('option', '', target.label); option.value = target.key; return option; })); }
function currentTarget() { return sourceTargets().find(target => target.key === $('#source-target').value) || sourceTargets()[0]; }
function loadSourceEditor() {
  const last = diagramFor(state.lastDiagramView || 'architecture'); if (last && sourceTargets().some(target => target.key === last.key)) $('#source-target').value = last.key;
  const target = currentTarget(); $('#mermaid-source').value = state.edits.get(target.key) ?? target.source; $('#source-status').textContent = state.edits.has(target.key) ? 'Showing your edits.' : 'Original analysis output.'; $('#source-status').dataset.state = '';
}
$('#source-target').addEventListener('change', () => { const target = currentTarget(); $('#mermaid-source').value = state.edits.get(target.key) ?? target.source; $('#source-status').textContent = ''; });
$('#validate-source').addEventListener('click', async () => { const check = await validateSource($('#mermaid-source').value); $('#source-status').textContent = check.message; $('#source-status').dataset.state = check.ok ? 'ok' : 'error'; });
$('#render-source').addEventListener('click', async () => {
  const target = currentTarget(); const text = $('#mermaid-source').value; const check = await validateSource(text);
  if (!check.ok) { $('#source-status').textContent = check.message; $('#source-status').dataset.state = 'error'; return; }
  if (text === target.source) state.edits.delete(target.key); else state.edits.set(target.key, text);
  if (target.mode) { state.mode = target.mode; state.drill = ''; $('#architecture-mode').value = target.mode; }
  if (target.index !== undefined) $('#document-select').value = String(target.index);
  selectView(target.view);
});
$('#reset-source').addEventListener('click', () => { const target = currentTarget(); state.edits.delete(target.key); $('#mermaid-source').value = target.source; $('#source-status').textContent = 'Reset to the original analysis output.'; $('#source-status').dataset.state = 'ok'; });
$('#copy-source').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#mermaid-source').value); toast('Mermaid source copied.'); } catch { toast('Select the text and copy it manually.'); } });

// ——— Controls ———
$('#analyze-form').addEventListener('submit', event => {
  event.preventDefault();
  const custom = $('#ref').value.trim() || $('#scope').value.trim();
  const path = inputToPath($('#repository').value, location.host);
  if (path && !custom) { const url = new URL(path, location.origin); const files = Number($('#max-files').value); if (files && files !== DEFAULT_FILES && !url.searchParams.has('files')) url.searchParams.set('files', String(files)); navigate(url.pathname + url.search + url.hash); return; }
  analyze({ history: 'push' });
});
$('#cancel').addEventListener('click', () => state.controller?.abort());
$('#refresh').addEventListener('click', () => { if (!state.result) return; const repo = state.result.repository; $('#repository').value = `https://github.com/${repo.fullName}`; $('#ref').value = repo.refKind === 'default' ? '' : repo.branch; $('#scope').value = repo.focus || repo.scope; analyze({ refresh: true, history: 'replace', lines: state.current?.lines }); });
$('#commit').addEventListener('click', () => { $('#analysis-options').hidden = false; $('#options-toggle').setAttribute('aria-expanded', 'true'); $('#ref').value = state.result?.repository.branch || ''; $('#scope').value = state.result?.repository.scope || ''; $('#ref').focus(); $('#ref').select(); });
$('#options-toggle').addEventListener('click', () => { const open = $('#analysis-options').hidden; $('#analysis-options').hidden = !open; $('#options-toggle').setAttribute('aria-expanded', String(open)); });
$('#use-ai').addEventListener('change', updateCostNote);
$('#tree-search').addEventListener('input', () => state.result && renderTree());
$$('#tree-filters .chip').forEach(chip => chip.addEventListener('click', () => state.result && setFilter(chip.dataset.filter)));
$('#close-inspector').addEventListener('click', () => { $('#file-inspector').hidden = true; state.current = null; });
$$('#view-dock [role=tab]').forEach(tab => {
  tab.addEventListener('click', () => { if (['system', 'architecture', 'mindmap', 'documented'].includes(state.view)) state.lastDiagramView = state.view; selectView(tab.dataset.view); });
});
$('#architecture-mode').addEventListener('change', event => { state.mode = event.target.value; if (state.mode !== 'files') state.drill = ''; selectView('architecture'); });
$('#drill-clear').addEventListener('click', () => { state.drill = ''; state.mode = state.result.diagrams.overview ? 'overview' : 'files'; $('#architecture-mode').value = state.mode; selectView('architecture'); });
$('#document-select').addEventListener('change', () => selectView('documented'));
$('#zoom-in').addEventListener('click', () => zoom(1.2)); $('#zoom-out').addEventListener('click', () => zoom(1 / 1.2)); $('#fit').addEventListener('click', fit);
$('#fullscreen').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('#canvas').requestFullscreen(); } catch { toast('Fullscreen is not available in this browser.'); } });
$('#export-guide').addEventListener('click', () => { if (state.result) exportGuide(state.result); });
$('#export-format').addEventListener('change', async event => { const format = event.target.value; event.target.value = ''; if (!format || !state.result) return; try { await exportDiagram(format, getSource(), getSVG(), `${state.result.repository.repo}-${diagramFor()?.key.replace(/[^a-z0-9]+/gi, '-') || state.view}`); } catch (error) { toast(error.message); } });
$('#share').addEventListener('click', async () => {
  if (!state.result) return; const repo = state.result.repository; const current = state.current?.type === 'blob' ? state.current : null;
  const url = new URL(location.origin + workspacePath(repo, { pinned: true, focus: current?.path || repo.focus, lines: current?.lines, files: state.result.coverage.maxFiles })); if (VIEWS.has(state.view) && state.view !== state.defaultView) url.searchParams.set('view', state.view); const link = url.href; // Safe state only: repository, commit, path, lines, view.
  try { await navigator.clipboard.writeText(link); toast(`Permalink to commit ${repo.sha.slice(0, 7)} copied.${repo.private ? ' Recipients need their own access to this private repository.' : ''}`); } catch { toast(link); }
});
$$('[data-collapse]').forEach(button => button.addEventListener('click', () => setDrawer(button.dataset.collapse, $('#studio').dataset[button.dataset.collapse] !== 'open'))); // In focus layout these close the drawers.
$$('.mobile-switch [role=tab]').forEach(tab => tab.addEventListener('click', () => { $('#studio').dataset.pane = tab.dataset.pane; $$('.mobile-switch [role=tab]').forEach(item => item.setAttribute('aria-selected', String(item === tab))); }));
document.addEventListener('keydown', event => { // "/" finds a file; Escape closes the inspector.
  if (event.key === '/' && !event.target.closest('input, textarea, select') && state.result && !$('#workspace').hidden) { event.preventDefault(); setDrawer('tree', true); $('#tree-search').focus(); }
  if (event.key === 'Escape' && !event.target.closest('dialog')) { if (!$('#info-panel').hidden || !$('#export-menu').hidden || !$('#hl-menu').hidden) closeMenus(); else if (focusLayout() && ($('#studio').dataset.tree === 'open' || $('#studio').dataset.genius === 'open') && !tourActive()) { setDrawer('tree', false); setDrawer('genius', false); } else if (!$('#file-inspector').hidden) $('#file-inspector').hidden = true; }
});
document.addEventListener('diagram-error', () => { if (state.view !== 'source') $('#diagram-caption').textContent = 'This diagram has a syntax problem. Open the Mermaid source tab to fix it or reset it.'; });

// ——— Settings and theme ———
function pairFor(provider) { return state.pairs[provider] || Object.fromEntries(MODEL_ROLES.map(role => [role, { role, id: PROVIDERS[provider].recommended[role].id, note: PROVIDERS[provider].recommended[role].note, available: null }])); }
function syncModel() { const custom = $('#model-custom').value.trim(); $('#model').value = custom || pairFor($('#provider').value)[state.role].id; updateCostNote(); askControls?.refresh(); }
function renderModelOptions() {
  const provider = $('#provider').value; const pair = pairFor(provider);
  $('#model-options').replaceChildren(...MODEL_ROLES.map(role => {
    const item = pair[role]; const label = el('label', 'model-option'); const input = el('input'); input.type = 'radio'; input.name = 'model-role'; input.value = role; input.checked = state.role === role;
    input.addEventListener('change', () => { state.role = role; syncModel(); $('#connection-status').hidden = true; });
    const card = el('span', 'model-card'); card.append(el('strong', '', role === 'fast' ? 'Fast · economy' : 'Advanced · best quality'), el('code', '', item.id), el('small', '', item.note));
    if (item.available === true) card.append(el('em', 'availability ok', 'Listed for your key')); else if (item.available === false) card.append(el('em', 'availability missing', 'Not listed for your key'));
    label.append(input, card); return label;
  }));
}
async function discoverModels(connected = false) { // Refresh the two recommended models for the pasted key; never shows raw model lists.
  connected = connected === true; const provider = $('#provider').value; const apiKey = $('#api-key').value.trim(); if (!checkKeyFormat(provider, apiKey).ok) return;
  try { const response = await fetch('/api/models', { method: 'POST', headers: requestHeaders(), body: JSON.stringify({ provider, apiKey }) }); const data = await response.json(); if (!response.ok || provider !== $('#provider').value) return; state.pairs[provider] = data.pair; renderModelOptions(); syncModel(); $('#preset-note').textContent = data.source === 'bundled' ? `Recommended models checked against ${PROVIDERS[provider].name}'s documentation on ${CATALOG_CHECKED}.${data.warning ? ` ${connected && data.kind !== 'auth' ? 'Connected, but live model discovery is unavailable. Using bundled verified recommendations.' : data.warning}` : ''}` : `Availability checked for your key ${data.source === 'cached' ? '(cached)' : 'just now'}; recommendations come only from verified models.`; } catch { /* The bundled pair stays in use. */ }
}
function updateProvider(clearKey = false) {
  const provider = PROVIDERS[$('#provider').value]; if (clearKey) { $('#api-key').value = ''; $('#model-custom').value = ''; }
  $('#provider-key-label').textContent = `${provider.name} API key`; $('#api-key').placeholder = `Paste your ${provider.name} API key (${provider.keyHint})`;
  renderModelOptions(); syncModel(); $('#connection-status').hidden = true;
  $('#provider-docs').href = provider.docs; $('#preset-note').textContent = `Two recommended models, checked against ${provider.name}'s documentation on ${CATALOG_CHECKED}.`;
  $('#provider-disclosure').textContent = `AI features send selected source excerpts to ${provider.name} and bill your ${provider.name} account. Nothing is sent until you choose an AI action.`;
  updateCostNote(); askControls?.refresh();
}
const CHECK_ICONS = { ok: 'check', warn: 'info', fail: 'warning', skip: 'info' };
function diagnosticsList(info) { // Safe facts only: never the key, never a header.
  const rows = [['Provider', `${PROVIDERS[info.provider]?.name || info.provider} · ${info.model || 'no model'}`], ['Key received by the server', info.apiKeyPresent ? `yes, ${info.keyLength} characters${info.keyPrefixMatches === false ? `, does not start with ${PROVIDERS[info.provider].keyPrefix}` : ''}` : 'no'], ['Endpoint', info.endpointHost], ['Model list', info.modelList ? `HTTP ${info.modelList.httpStatus ?? '—'} · ${info.modelList.classification}` : 'not checked'], ['Tiny inference', info.inference ? `HTTP ${info.inference.httpStatus ?? '—'} · ${info.inference.classification}` : 'not checked'], ['Result', `${info.classification} in ${info.durationMs} ms`]];
  const list = el('dl', 'connection-diagnostics'); rows.forEach(([term, value]) => list.append(el('dt', '', term), el('dd', '', value))); return list;
}
async function testConnection() {
  const box = $('#connection-status'); const provider = $('#provider').value; const apiKey = $('#api-key').value.trim(); const model = $('#model').value.trim();
  box.hidden = false; box.dataset.state = 'pending'; box.replaceChildren(el('strong', '', 'Testing…'), el('span', 'subtle', `Model list, then one tiny request to ${PROVIDERS[provider].name}.`));
  try {
    const response = await fetch('/api/provider/test', { method: 'POST', headers: requestHeaders(), body: JSON.stringify({ provider, apiKey, model }) }); const data = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(data.checks)) throw new Error(data.error || `The Git Architecture Diagram server answered HTTP ${response.status}.`);
    if (provider !== $('#provider').value) return; // The person switched provider meanwhile.
    box.dataset.state = data.ok ? 'ok' : 'error'; const list = el('ul', 'connection-checks');
    data.checks.forEach(check => { const row = el('li', `check-${check.status}`); const text = el('span', 'check-text'); text.append(el('strong', '', check.label), el('span', '', check.detail)); row.append(icon(CHECK_ICONS[check.status] || 'info'), text); list.append(row); });
    const details = el('details', 'connection-more'); details.append(el('summary', '', 'Diagnostics'), diagnosticsList(data.diagnostics));
    box.replaceChildren(el('strong', '', data.status), el('p', 'connection-message', data.message || ''), list, ...(data.keyNote ? [el('p', 'connection-key-note', data.keyNote)] : []), ...(data.suggestion ? [el('p', 'fineprint', data.suggestion)] : []), details);
    if (data.ok) discoverModels(true);
  } catch (error) { box.dataset.state = 'error'; box.replaceChildren(el('strong', '', 'Connection test failed'), el('p', 'fineprint', error.message)); }
}
function setupKeyField() { // A masked text field: password managers do not autofill or save it, unlike type="password" (which ignores autocomplete="off").
  const input = $('#api-key'); const button = $('#key-reveal');
  if (!globalThis.CSS?.supports?.('-webkit-text-security', 'disc')) { input.type = 'password'; input.autocomplete = 'new-password'; } // Older browsers: fall back to a password field that is not filled with saved passwords.
  const show = visible => { input.classList.toggle('revealed', visible); if (input.type === 'password' || input.dataset.fallback) { input.type = visible ? 'text' : 'password'; input.dataset.fallback = '1'; } button.setAttribute('aria-pressed', String(visible)); button.setAttribute('aria-label', visible ? 'Hide key' : 'Show key'); button.replaceChildren(icon(visible ? 'eye-off' : 'eye')); };
  button.addEventListener('click', () => show(button.getAttribute('aria-pressed') !== 'true'));
  $('#settings').addEventListener('close', () => show(false)); // Never leave a key visible after the dialog closes.
}
function renderSystemEmpty() {
  const provider = PROVIDERS[$('#provider').value]; const failure = state.result?.aiError; const warning = !failure && state.result?.warnings.find(item => /AI|model|provider|system maps|HTTP/.test(item) && !/lexical/.test(item));
  const button = $('#system-generate'); button.hidden = false; $('#system-error')?.remove();
  if (aiConfigured()) { $('#system-empty-text').textContent = 'Genius reads the files already analyzed and draws the people, components, and main flow of this repository, with a guided tour. Every link is checked against this commit.'; button.textContent = `Generate with ${provider.name}`; $('#system-cost').textContent = `Uses your key: up to 110,000 characters in, at most 12,000 output tokens, model ${$('#model').value.trim()}.`; }
  else if (state.publicAI?.remainingToday) { $('#system-empty-text').textContent = 'Genius reads the files already analyzed and draws the people, components, and main flow of this repository, with a guided tour. Every link is checked against this commit.'; button.textContent = 'Generate system map'; $('#system-cost').textContent = `Free on this site (${state.publicAI.remainingToday} left today). The result is saved, so everyone who opens this commit sees it without another model call.`; }
  else { $('#system-empty-text').textContent = 'A system map needs an AI model. Add a provider key and model in API settings to generate one for this repository.'; button.textContent = 'Open API settings'; $('#system-cost').textContent = state.publicAI ? 'Today\'s free system maps on this site are used up.' : 'The site operator can also enable free, cached system maps for public repositories.'; }
  if (failure) { // A provider failure is explained as what it is, never as a broken feature.
    const card = el('div', `provider-error kind-${failure.kind}`); card.id = 'system-error'; card.setAttribute('role', 'alert');
    card.append(el('strong', '', `${errorTitle(failure.kind)} · ${failure.providerName}`), el('p', '', failure.message), el('p', 'fineprint', `${failure.suggestion || ''} The structural analysis, tree, and every other view are unaffected.`.trim()));
    if (['rate_limited', 'model_unavailable', 'timeout', 'provider_unavailable'].includes(failure.kind) && roleOf($('#provider').value, $('#model').value) === 'advanced') { const fast = el('button', 'quiet-button', 'Switch to the Fast model'); fast.type = 'button'; fast.addEventListener('click', () => { state.role = 'fast'; $('#model-custom').value = ''; renderModelOptions(); syncModel(); toast(`Fast model selected: ${$('#model').value}.`); renderSystemEmpty(); }); card.append(fast); }
    $('#system-cost').after(card); button.textContent = failure.kind === 'quota_exhausted' || failure.kind === 'auth' ? 'Open API settings' : 'Try again';
  } else if (warning) $('#system-cost').textContent = `Last attempt: ${warning}`;
}
$('#system-generate').addEventListener('click', () => { const kind = state.result?.aiError?.kind; if ((!aiConfigured() && !state.publicAI?.remainingToday) || kind === 'quota_exhausted' || kind === 'auth') { $('#settings').showModal(); return; } setMode('genius'); analyze({ history: 'replace' }); });
$('#tour-start').addEventListener('click', () => startTour(diagramFor(state.view)?.tour, { onFile: path => inspect({ path, type: state.result.repository.entries.some(entry => entry.path === path && entry.type === 'tree') ? 'tree' : 'blob' }) })); // System map or component overview; supporting files open in the inspector.
function updateCostNote() {
  const provider = PROVIDERS[$('#provider').value]; const mode = analysisMode(); const model = $('#model').value.trim();
  if (mode === 'quick') $('#ai-cost').textContent = 'Structure, tree, and source links need no AI key.';
  else if (mode === 'deep') $('#ai-cost').textContent = aiConfigured() ? `Runs the Quick analysis, then asks before Deep Genius starts: up to 25 calls to ${provider.name} ${model}, at most 3 at a time. Provider usage may incur cost.` : `Deep Genius needs your ${provider.name} key in API settings. The Quick analysis still runs.`;
  else $('#ai-cost').textContent = !aiConfigured() && state.publicAI?.remainingToday ? `Draws a system map with this site's ${state.publicAI.provider} model (${state.publicAI.remainingToday} free today). Saved maps are reused at no cost.` : aiConfigured() ? `Sends up to 110,000 characters of the files read (about 28,000 tokens) to ${provider.name}, model ${model}, with at most 12,000 output tokens. Billed to your key.` : `Add a ${provider.name} key in API settings; without it you get the structural analysis only.`;
}
$('#provider').addEventListener('change', () => updateProvider(true));
$('#api-key').addEventListener('input', () => { updateCostNote(); askControls.refresh(); $('#connection-status').hidden = true; });
$('#api-key').addEventListener('change', discoverModels);
$('#model-custom').addEventListener('input', syncModel);
$('#test-connection').addEventListener('click', testConnection);
document.querySelectorAll('[name=analysis-mode]').forEach(input => input.addEventListener('change', () => setMode(analysisMode())));
$('#settings-open').addEventListener('click', () => $('#settings').showModal());
$('#clear-credentials').addEventListener('click', () => { ['api-key', 'model-custom'].forEach(id => { $(`#${id}`).value = ''; }); state.cache.clear(); state.pairs = {}; renderModelOptions(); syncModel(); $('#connection-status').hidden = true; updateCostNote(); askControls.refresh(); toast('Key removed from this tab, and cached analyses cleared.'); });
function applyTheme(theme) { document.documentElement.dataset.theme = theme; $('#theme').setAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`); }
try { applyTheme(localStorage.getItem('gad-theme') === 'light' ? 'light' : 'dark'); } catch { applyTheme('dark'); }
$('#theme').addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; applyTheme(theme); try { localStorage.setItem('gad-theme', theme); } catch { /* Theme still applies without storage. */ } if (state.result && ['system', 'architecture', 'mindmap', 'documented'].includes(state.view)) selectView(state.view); });
try { setLayout(localStorage.getItem('gad-layout') === 'studio' ? 'studio' : 'focus', false); if (!focusLayout()) for (const pane of ['tree', 'genius']) if (localStorage.getItem(`gad-${pane}`) === 'closed') setDrawer(pane, false); } catch { setLayout('focus', false); }
$('#copy-host').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.host); toast('Hostname copied. Paste it in place of github.com.'); } catch { toast(`Use ${location.host} in place of github.com.`); } });

function exportView(format, name) { return exportDiagram(format, getSource(), getSVG(), name); }
const askControls = setupAsk({ getResult: () => state.result, credentials, headers: requestHeaders, aiConfigured, onInspect: (path, line) => inspect({ path, type: 'blob' }, { lines: line ? { start: line, end: line } : null }) });
const extras = setupExtras({ state, selectView, diagramFor, inspect, revealInTree, setDrawer, closeMenus, toast, aiConfigured, exportView });
async function copyText(text, message = 'Copied.') { try { const safe = redactSecrets(text); await navigator.clipboard.writeText(safe.text); toast(safe.count ? `${message} ${safe.count} credential-shaped value${safe.count === 1 ? ' was' : 's were'} redacted.` : message); } catch { toast('Copying is blocked here; use Download.'); } }
function downloadText(name, data, type) { const url = URL.createObjectURL(new Blob([typeof data === 'string' ? redactSecrets(data).text : data], { type })); const anchor = el('a'); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
const extractView = setupExtractView({ state, headers: requestHeaders, credentials, copy: copyText, download: downloadText, openDoc });
const deep = setupDeepGenius({ state, credentials, headers: requestHeaders, aiConfigured, toast, selectView: view => selectView(view), inspect: (path, line) => inspect({ path, type: 'blob' }, { lines: line ? { start: line, end: line } : null }), openSettings: role => { if (role) { state.role = role; $('#model-custom').value = ''; renderModelOptions(); syncModel(); } $('#settings').showModal(); }, runAction: action => runAction(action), onComplete: () => { $('#genius-mode').textContent = 'Deep Genius + source'; extractView.reset(); if (state.view === 'extract') extractView.render(); } });

// ——— Startup ———
async function start() {
  installIcons(); setupKeyField(); setupBrand(); setupSocialDock(); $$('.site-host').forEach(element => { element.textContent = location.host; });
  updateProvider(); renderStarters($('#starter-examples'));
  try { const response = await fetch('/api/health'); const type = response.headers.get('Content-Type') || ''; if (response.ok && type.includes('json')) { const health = await response.json(); state.maxFiles = Number(health.limits?.maxFiles) || 120; state.limits = health.limits || {}; state.publicAI = health.publicAI?.enabled ? health.publicAI : null; if (state.publicAI?.remainingToday) setMode('genius'); updateCostNote(); $('#max-files').max = String(state.maxFiles); if (Number($('#max-files').value) > state.maxFiles) $('#max-files').value = String(state.maxFiles); } } catch { /* The analysis request reports connection problems itself. */ }
  await route();
}
start();

// Optional, feature-detected WebMCP tool: read-only access to the analysis already on screen.
const modelContext = document.modelContext; const modelLifecycle = new AbortController();
if (modelContext?.registerTool) {
  try { Promise.resolve(modelContext.registerTool({ name: 'get_repository_analysis', title: 'Read the current repository analysis', description: 'Read the displayed repository summary, structure, reading order, coverage, and located dependency evidence. This does not start analysis, call AI, or change the repository.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute(input) { if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('This tool accepts an empty object only.'); const result = state.result; if (!result) return { status: 'not_analyzed', message: 'Analyze a repository in the workspace first.' }; return { status: 'ready', repository: result.repository.fullName, commit: result.repository.sha, scope: result.repository.scope, summary: result.summary, structure: result.structure, readingOrder: result.readingOrder, coverage: result.coverage, dependencies: result.dependencies.slice(0, 30), aiEnabled: Boolean(result.ai), warnings: result.warnings }; } }, { signal: modelLifecycle.signal })).catch(() => {}); } catch { /* Optional integration. */ }
  window.addEventListener('pagehide', () => modelLifecycle.abort(), { once: true });
}
