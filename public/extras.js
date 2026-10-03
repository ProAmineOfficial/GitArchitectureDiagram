// Project: Git Architecture Diagram | Component: Highlights, hierarchy, cross-view selection, exports, Build With Genius | Author: Amine Saoud ibn al-Bashir.
// Connected to the workspace through a small API object so the stable app.js modules stay as they are.
import { MODES, computeHighlight, readModel, applyHighlight, clearHighlight } from './highlights.js';
import * as knowledge from './knowledge.js';
import { workspacePath } from './route.js';
import { zipSync, strToU8 } from '/vendor/fflate/browser.js';
import { renderPreview } from './diagram.js';
import { exportDiagram } from './exports.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
function el(tag, className, text) { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; }
function download(name, data, type) { const url = URL.createObjectURL(new Blob([data], { type })); const anchor = el('a'); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
const BASIS = { source: 'Source-derived', genius: 'Genius interpretation', keyword: 'Keyword match', selection: 'Your selection' };
let api; let current = null; // The active highlight: {mode, query, paths, label}.

export function setupExtras(workspace) {
  api = workspace;
  buildHighlightMenu(); wireExportMenu(); wireDocDialog(); wireBuild();
  $('#hl-clear').addEventListener('click', () => clearCurrent());
  return { afterRender, renderHierarchyView, selectPaths, reset, explain };
}

// ——— Highlights ———
function buildHighlightMenu() {
  const menu = $('#hl-menu'); menu.replaceChildren();
  const form = el('form', 'hl-query'); const input = el('input'); input.id = 'hl-input'; input.placeholder = 'Highlight… (e.g. authentication flow)'; input.setAttribute('aria-label', 'Highlight by keyword'); const go = el('button', 'quiet-button', 'Go'); go.type = 'submit'; form.append(input, go);
  form.addEventListener('submit', event => { event.preventDefault(); if (input.value.trim()) highlight({ mode: 'query', query: input.value.trim(), label: `“${input.value.trim()}”` }); });
  menu.append(form);
  const groups = [['Structure', ['key', 'entry', 'core', 'hubs', 'flow']], ['Layers', ['frontend', 'backend', 'api', 'storage', 'external']], ['Concerns', ['ai', 'hardware', 'security', 'build', 'tests', 'docs']], ['Genius', ['genius']]];
  for (const [title, ids] of groups) { menu.append(el('p', 'menu-heading', title)); const grid = el('div', 'hl-grid'); ids.forEach(id => { const mode = MODES.find(item => item.id === id); const button = el('button', 'hl-mode', mode.label); button.type = 'button'; button.dataset.mode = id; if (mode.basis === 'genius') button.append(el('span', 'tiny-badge', 'AI')); button.addEventListener('click', () => highlight({ mode: id, label: mode.label })); grid.append(button); }); menu.append(grid); }
}
function flowchartView() { return ['system', 'architecture'].includes(api.state.view); }
async function ensureFlowchart() { if (flowchartView()) return; await api.selectView(api.state.result.ai?.graph ? 'system' : 'architecture'); }
export async function highlight(request) {
  api.closeMenus(); await ensureFlowchart(); current = request; apply();
}
function apply() {
  const content = $('#diagram-content'); if (!current || !flowchartView()) { $('#hl-chip').hidden = true; return; }
  const diagram = api.diagramFor(api.state.view); const model = readModel(content, diagram?.paths || {});
  const tour = (diagram?.tour || []).map(step => step.id); const selection = computeHighlight(model, current.mode, { tour, flowEdges: diagram?.flowEdges || [], query: current.query, paths: current.paths || [], ai: Boolean(api.state.result.ai) });
  const count = applyHighlight(content, model, selection);
  $('#hl-chip').hidden = false; $('#hl-label').textContent = count ? `${current.label}: ${count} of ${model.nodes.length}` : `${current.label}: nothing matched in this view`; $('#hl-basis').textContent = BASIS[selection.basis]; $('#hl-basis').dataset.basis = selection.basis; $('#hl-chip').title = selection.note;
}
function clearCurrent() { current = null; clearHighlight($('#diagram-content')); $('#hl-chip').hidden = true; }
function afterRender(view) { if (current && ['system', 'architecture'].includes(view)) apply(); else { clearHighlight($('#diagram-content')); $('#hl-chip').hidden = true; } }
function reset() { current = null; $('#hl-chip').hidden = true; }

// ——— Cross-view selection and Genius explanations ———
/** Select the same thing everywhere: highlight in a diagram, reveal files, and explain in Genius. */
export function selectPaths({ paths, label, line = null }) {
  const clean = paths.filter(item => item && item !== '.'); explain({ paths: clean, label, line });
  api.setDrawer('genius', true); if (clean[0]) api.revealInTree(clean[0], { select: false });
}
export function explain({ paths, label }) {
  const { result } = api.state; const box = $('#genius-focus'); box.replaceChildren(); box.hidden = false;
  const inside = path => paths.some(prefix => path === prefix || path.startsWith(prefix + '/'));
  const listed = result.repository.entries.filter(entry => entry.type === 'blob' && inside(entry.path)); const read = result.files.filter(file => inside(file.path));
  const inbound = new Map(); result.dependencies.forEach(edge => inbound.set(edge.to, (inbound.get(edge.to) || 0) + 1));
  const incoming = result.dependencies.filter(edge => inside(edge.to) && !inside(edge.from)); const outgoing = result.dependencies.filter(edge => inside(edge.from) && !inside(edge.to));
  const external = Object.entries(result.externalUsage || {}).filter(([, users]) => users.some(inside)).map(([name]) => name);
  const key = read.map(file => file.path).sort((a, b) => (inbound.get(b) || 0) - (inbound.get(a) || 0)).slice(0, 5);
  const entries = result.entrypoints.filter(item => inside(item.path));
  box.append(el('p', 'focus-kicker', 'Selected'), el('h3', '', label));
  const facts = el('ul', 'focus-facts');
  [[`${listed.length} files listed, ${read.length} read`, 'source'], [entries.length ? `Entry point${entries.length > 1 ? 's' : ''}: ${entries.map(item => item.path.split('/').pop()).join(', ')}` : '', 'source'], [incoming.length ? `Used by ${new Set(incoming.map(edge => edge.from.split('/').slice(0, -1).join('/') || '(root)')).size} other folders (${incoming.length} imports)` : '', 'source'], [outgoing.length ? `Depends on ${new Set(outgoing.map(edge => edge.to)).size} files outside this selection` : '', 'source'], [external.length ? `Imports ${external.slice(0, 5).join(', ')}` : '', 'source']].filter(([text]) => text).forEach(([text]) => facts.append(el('li', '', text)));
  box.append(facts);
  if (key.length) { box.append(el('p', 'focus-sub', 'Start reading')); const files = el('ol', 'reading-order compact'); key.forEach(path => { const row = el('li'); const button = el('button', 'genius-file', path.split('/').pop()); button.type = 'button'; button.title = path; button.addEventListener('click', () => api.inspect({ path, type: 'blob' })); row.append(button, el('span', 'why', inbound.get(path) ? `imported by ${inbound.get(path)} files` : 'read')); files.append(row); }); box.append(files); }
  if (!listed.length) box.append(el('p', 'fineprint', 'No repository files map to this item; it is a concept or an outside system.'));
  const actions = el('div', 'focus-actions');
  const action = (text, handler) => { const button = el('button', 'glass-pill', text); button.type = 'button'; button.addEventListener('click', handler); actions.append(button); };
  if (paths.length) { if (api.state.result.ai?.graph) action('Highlight in System map', async () => { await api.selectView('system'); highlight({ mode: 'paths', paths, label }); }); action('Highlight in Architecture', async () => { await api.selectView('architecture'); highlight({ mode: 'paths', paths, label }); }); action('Show in hierarchy', () => api.selectView('hierarchy').then(() => focusHierarchy(paths))); action('Reveal files', () => { api.setDrawer('tree', true); api.revealInTree(paths[0]); }); }
  if (api.aiConfigured()) action(`Ask Genius about ${label}`, () => { $('#question').value = `Explain ${label}: its responsibility, dependencies, important files, and how to modify it.`; $('#ask-ai').click(); });
  box.append(actions, el('p', 'fineprint', 'Source-derived from files listed and read at this commit.'));
}

// ——— Software hierarchy view ———
const KIND_COLOR = { entry: '#66d4ff', config: '#f2c66d', ui: '#e3a0ed', service: '#8fb3ff', source: '#55d6ca', data: '#9fb0c8', hardware: '#79d99b', examples: '#6fc3df', tests: '#c3e36b', automation: '#ff9f68', docs: '#b9a4ff', assets: '#8aa0b6', external: '#8a96a8', actor: '#c9a7ff', concept: '#b0b8c6', file: '#7f8aa0', folder: '#9aa6bd', more: '#6b7487', root: '#9ccaff' };
let hierarchyMode = 'source';
export function renderHierarchyView() {
  const view = $('#hierarchy-view'); const data = api.state.result.hierarchy; view.replaceChildren();
  const tools = el('div', 'hier-tools');
  if (data.genius) { const seg = el('div', 'segmented'); [['source', 'Source-derived'], ['genius', 'Genius interpretation']].forEach(([id, text]) => { const button = el('button', '', text); button.type = 'button'; button.setAttribute('aria-pressed', String(hierarchyMode === id)); button.addEventListener('click', () => { hierarchyMode = id; renderHierarchyView(); }); seg.append(button); }); tools.append(seg); } else tools.append(el('span', 'evidence-badge', 'Source-derived'));
  const tree = hierarchyMode === 'genius' && data.genius ? data.genius : data.source;
  const expand = el('button', 'glass-pill', 'Expand all'); expand.type = 'button'; expand.addEventListener('click', () => view.querySelectorAll('li[aria-expanded]').forEach(item => item.setAttribute('aria-expanded', 'true')));
  const collapse = el('button', 'glass-pill', 'Collapse all'); collapse.type = 'button'; collapse.addEventListener('click', () => view.querySelectorAll('li[aria-expanded]').forEach((item, index) => item.setAttribute('aria-expanded', String(index === 0))));
  const copy = el('button', 'glass-pill', 'Copy as text'); copy.type = 'button'; copy.addEventListener('click', () => copyText(knowledge.hierarchyText(tree.root, { depth: 5 }), 'Hierarchy copied.'));
  tools.append(el('span', 'hier-count', `${tree.nodeCount} nodes · ${tree.type === 'embedded' ? 'embedded project' : tree.type}`), expand, collapse, copy);
  const list = el('ul', 'hier'); list.setAttribute('role', 'tree'); list.setAttribute('aria-label', 'Software hierarchy'); list.append(row(tree.root, 0));
  view.append(tools, list);
}
function row(node, depth) {
  const item = el('li'); item.setAttribute('role', 'treeitem'); item.dataset.paths = node.paths.join('|'); if (node.children.length) item.setAttribute('aria-expanded', String(depth < 2)); item.style.setProperty('--depth', depth);
  const line = el('div', 'hier-row'); line.style.setProperty('--kind', KIND_COLOR[node.kind?.replace('layer-', '')] || KIND_COLOR[node.kind] || '#9ccaff');
  const toggle = el('button', 'hier-caret'); toggle.type = 'button'; toggle.setAttribute('aria-label', node.children.length ? `Expand or collapse ${node.label}` : node.label); toggle.disabled = !node.children.length; toggle.addEventListener('click', () => item.setAttribute('aria-expanded', String(item.getAttribute('aria-expanded') !== 'true')));
  const label = el('span', `hier-label${node.kind?.startsWith('layer') || depth === 0 ? ' strong' : ''}`, node.label);
  line.append(toggle, el('i', 'hier-dot'), label);
  node.badges.forEach(badge => line.append(el('span', `hier-badge b-${badge.toLowerCase().replace(/[^a-z]+/g, '-')}`, badge)));
  if (node.basis === 'genius' && depth === 0) line.append(el('span', 'hier-badge b-genius', 'GENIUS'));
  if (node.detail) line.append(el('span', 'hier-detail', node.detail));
  const actions = el('span', 'hier-actions');
  const mapped = node.paths.filter(path => path && path !== '.');
  if (mapped.length && node.kind !== 'more') { const show = el('button', 'hier-action', 'Diagram'); show.type = 'button'; show.title = 'Highlight in the diagram'; show.addEventListener('click', async () => { await api.selectView(api.state.result.ai?.graph && hierarchyMode === 'genius' ? 'system' : 'architecture'); highlight({ mode: 'paths', paths: mapped, label: node.label }); }); actions.append(show); }
  if (node.kind === 'file') { const open = el('button', 'hier-action', 'Source'); open.type = 'button'; open.addEventListener('click', () => api.inspect({ path: node.paths[0], type: 'blob' })); actions.append(open); }
  else { const why = el('button', 'hier-action', 'Explain'); why.type = 'button'; why.title = 'Explain with Genius'; why.addEventListener('click', () => selectPaths({ paths: mapped, label: node.label })); actions.append(why); }
  line.append(actions); item.append(line);
  if (node.children.length) { const children = el('ul'); children.setAttribute('role', 'group'); node.children.forEach(child => children.append(row(child, depth + 1))); const wrap = el('div', 'hier-children'); wrap.append(children); item.append(wrap); }
  return item;
}
function focusHierarchy(paths) {
  const match = $$('#hierarchy-view li[role=treeitem]').find(item => item.dataset.paths.split('|').some(path => paths.includes(path)));
  if (!match) return; let parent = match.parentElement.closest('li[role=treeitem]'); while (parent) { parent.setAttribute('aria-expanded', 'true'); parent = parent.parentElement.closest('li[role=treeitem]'); }
  $$('#hierarchy-view .hier-row.selected').forEach(item => item.classList.remove('selected')); match.querySelector('.hier-row').classList.add('selected'); match.scrollIntoView({ block: 'center' });
}

// ——— Export menu and document dialog ———
function permalinkPath() { const { result } = api.state; return workspacePath(result.repository, { pinned: true, files: result.coverage.maxFiles }); }
async function copyText(text, message = 'Copied.') { try { await navigator.clipboard.writeText(text); api.toast(message); } catch { api.toast('Copying is blocked here; use Download.'); } }
function wireExportMenu() {
  $$('#export-menu [data-group-tab]').forEach(tab => tab.addEventListener('click', event => { event.stopPropagation(); $$('#export-menu [data-group-tab]').forEach(item => item.setAttribute('aria-selected', String(item === tab))); $$('#export-menu [data-group]').forEach(group => { group.hidden = group.dataset.group !== tab.dataset.groupTab; }); }));
  $$('#export-menu [data-action]').forEach(item => item.addEventListener('click', () => { api.closeMenus(); if (api.state.result) runAction(item.dataset.action); }));
}
export async function runAction(action, options = {}) {
  const { result } = api.state; const repo = result.repository; const origin = location.origin; const base = `${repo.repo}-${repo.sha.slice(0, 7)}`;
  const docs = {
    'readme-badge': () => { const badge = knowledge.readmeBadge(repo, origin, permalinkPath()); return { title: 'README badge', basis: 'Links to this exact commit', text: `${badge.markdown}\n\n${badge.genius}`, filename: `${base}-readme-badge.md`, note: 'Paste into README.md. The badge image is served by shields.io; the link opens this commit here.' }; },
    'clone': () => ({ title: 'Clone repository', basis: 'Exact analyzed commit', text: knowledge.cloneCommand(repo), filename: `${base}-clone.sh`, note: repo.private ? 'Private repository: authenticate with your own Git credentials. No token is included.' : 'Checks out the same commit that was analyzed.' }),
    'skills': () => ({ title: 'Development skills', basis: 'Observed with evidence, recommendations separate', text: knowledge.skillsMarkdown(result), filename: `${base}-development-skills.md`, json: knowledge.skillsJSON(result) }),
    'prompt': () => ({ title: options.title || 'Development prompt by Genius', basis: 'Source-derived; AI parts labeled', text: knowledge.developmentPrompt(result, options.mode || 'similar'), filename: `${base}-${options.mode && options.mode !== 'similar' ? options.mode + '-' : ''}development-prompt.md`, modes: knowledge.PROMPT_MODES, mode: options.mode || 'similar', render: mode => knowledge.developmentPrompt(result, mode) }),
    'blueprint': () => ({ title: 'App blueprint', basis: 'Structure source-derived; order recommended', text: knowledge.appBlueprint(result), filename: `${base}-app-blueprint.md` }),
    'roadmap': () => ({ title: 'Implementation roadmap', basis: 'Phases from the repository layers', text: knowledge.implementationRoadmap(result), filename: `${base}-implementation-roadmap.md` }),
    'context': () => { const text = knowledge.aiReadyContext(result); return { title: 'AI-ready context', basis: `About ${knowledge.estimateTokens(text).toLocaleString('en')} tokens`, text, filename: `${base}-ai-context.md` }; },
    'extract': () => { const extract = knowledge.projectExtract(result); return { title: 'Project extract', basis: `Files read only · about ${extract.tokens.toLocaleString('en')} tokens`, text: extract.text, filename: `${base}-extract.txt`, note: 'Summary, directory structure, and the content of every file that was read. Diagrams remain the main view; this is for pasting into other tools.' }; },
    'hierarchy': () => ({ title: 'Software hierarchy', basis: 'Source-derived', text: `${knowledge.hierarchyText(result.hierarchy.source.root, { depth: 5 })}\n\n\`\`\`mermaid\n${knowledge.hierarchyMermaid(result.hierarchy.source.root)}\n\`\`\`\n`, filename: `${base}-software-hierarchy.md` }),
    'mermaid-system': () => (result.ai?.graph ? { title: 'System map Mermaid', basis: 'Genius interpretation, validated', text: result.ai.graph.mermaid, filename: `${base}-system-map.mmd` } : { title: 'System map Mermaid', basis: 'Not generated yet', text: '%% Generate a system map first (System map tab).', filename: `${base}-system-map.mmd` }),
    'mermaid-architecture': () => ({ title: 'Architecture Mermaid', basis: 'Source-derived', text: result.diagrams.overview || result.diagrams.architecture, filename: `${base}-architecture.mmd` }),
    'mermaid-mindmap': () => ({ title: 'Repository mind map Mermaid', basis: 'Source-derived', text: result.diagrams.conceptMindmap || result.diagrams.mindmap, filename: `${base}-mind-map.mmd` }),
    'mermaid-hierarchy': () => ({ title: 'Software hierarchy Mermaid', basis: 'Source-derived', text: knowledge.hierarchyMermaid(result.hierarchy.source.root), filename: `${base}-software-hierarchy.mmd` }),
    'tree': () => ({ title: 'Repository tree', basis: 'Listing at this commit', text: result.tree, filename: `${base}-tree.txt` }),
  };
  const zip = (name, files, folder) => { download(name, zipSync(Object.fromEntries(Object.entries(files).map(([file, text]) => [`${folder}/${file}`, strToU8(text)]))), 'application/zip'); };
  if (action === 'developer-pack') { zip(`${base}-developer-pack.zip`, knowledge.developerPack(result, { origin, path: permalinkPath() }), `${repo.repo}-developer-pack`); api.toast('Developer pack downloaded.'); return; }
  if (action === 'knowledge-pack') { zip(`${base}-knowledge-pack.zip`, knowledge.knowledgePack(result), `${repo.repo}-knowledge-pack`); api.toast('Project knowledge pack downloaded.'); return; }
  if (action === 'pack') { const files = knowledge.reconstructionPack(result, { origin, path: permalinkPath() }); download(`${base}-reconstruction-pack.zip`, zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [`${repo.repo}-reconstruction-pack/${name}`, strToU8(text)]))), 'application/zip'); api.toast('Project reconstruction pack downloaded.'); return; }
  if (action === 'readme-picture') { openReadmePicture(); return; }
  if (action === 'extract') { await api.selectView('extract'); return; } // The standalone Project extract view.
  if (docs[action]) openDoc(docs[action]());
}
let doc = null;
function wireDocDialog() {
  $('#doc-copy').addEventListener('click', () => copyText($('#doc-text').textContent, `${doc?.title || 'Text'} copied.`));
  $('#doc-download').addEventListener('click', () => { if (!doc) return; const format = $('#doc-format').value; const text = format === 'json' && doc.json ? doc.json : $('#doc-text').textContent; const name = doc.filename.replace(/\.(md|txt|mmd|sh)$/, '') + (format === 'json' ? '.json' : format === 'txt' ? '.txt' : doc.filename.match(/\.(md|txt|mmd|sh)$/)?.[0] || '.md'); download(name, text, format === 'json' ? 'application/json' : 'text/plain;charset=utf-8'); });
  $('#doc-mode').addEventListener('change', () => { if (doc?.render) $('#doc-text').textContent = doc.render($('#doc-mode').value); });
}
export function openDoc(spec) {
  doc = spec; $('#doc-title').textContent = spec.title; $('#doc-basis').textContent = spec.basis || ''; $('#doc-note').textContent = spec.note || ''; $('#doc-note').hidden = !spec.note; $('#doc-text').textContent = spec.text;
  $('#doc-mode-label').hidden = !spec.modes; if (spec.modes) $('#doc-mode').replaceChildren(...Object.entries(spec.modes).map(([id, label]) => { const option = el('option', '', label); option.value = id; if (id === (spec.mode || 'similar')) option.selected = true; return option; }));
  $('#doc-format').replaceChildren(...[['md', spec.filename.endsWith('.mmd') ? 'Mermaid (.mmd)' : spec.filename.endsWith('.sh') ? 'Shell (.sh)' : 'Markdown (.md)'], ['txt', 'Text (.txt)'], ...(spec.json ? [['json', 'JSON (.json)']] : [])].map(([value, label]) => { const option = el('option', '', label); option.value = value; return option; }));
  $('#doc-picture').hidden = true; $('#doc-dialog').showModal();
}
/** Mermaid source of any exportable view. */
export function sourceFor(view, index = 0) {
  const { result } = api.state; const d = result.diagrams;
  return { architecture: d.overview || d.architecture, system: result.ai?.graph?.mermaid || '', hierarchy: knowledge.hierarchyMermaid(result.hierarchy.source.root), mindmap: d.conceptMindmap || d.mindmap, documented: result.documented[index]?.source || '' }[view] || '';
}
/** Export any view as PNG, SVG, or Mermaid without leaving the current view: it is rendered off-screen. */
export async function exportDiagramFor(view, format, { filename, index = 0 } = {}) {
  const source = sourceFor(view, index); const name = filename || `${api.state.result.repository.repo}-${view}`;
  if (!source) { api.toast('This diagram is not available for this repository yet.'); return false; }
  if (format === 'copy') { await copyText(source, 'Mermaid copied.'); return true; }
  if (format === 'mmd') { download(`${name}.mmd`, source, 'text/plain;charset=utf-8'); return true; }
  const host = el('div', 'offscreen-render'); document.body.append(host);
  try { if (!(await renderPreview(host, source))) { api.toast('This diagram could not be rendered.'); return false; } await exportDiagram(format, source, host.querySelector('svg'), name); return true; } finally { host.remove(); }
}
function openReadmePicture() {
  const { result } = api.state; const views = [['architecture', 'Architecture', 'architecture'], ...(result.ai?.graph ? [['system', 'System map', 'system-map']] : []), ['hierarchy', 'Software hierarchy', 'software-hierarchy'], ['mindmap', 'Repository mind map', 'mind-map']];
  openDoc({ title: 'README picture', basis: 'PNG plus the Markdown to embed it', text: knowledge.readmePicture(result.repository, location.origin, permalinkPath()), filename: 'readme.md', note: 'Choose a view. The PNG downloads with the file name used in the Markdown; commit it under docs/ next to your README. Copy then copies the README Markdown.' });
  const box = $('#doc-picture'); box.replaceChildren(); box.hidden = false;
  views.forEach(([view, label, file]) => { const button = el('button', 'glass-pill', `${label} PNG`); button.type = 'button'; button.addEventListener('click', async () => { $('#doc-text').textContent = knowledge.readmePicture(result.repository, location.origin, permalinkPath(), { file: `docs/${file}.png`, view: label }); await exportDiagramFor(view, 'png', { filename: file }); }); box.append(button); });
}

// ——— Build With Genius ———
function wireBuild() {
  $$('#build-genius [data-action]').forEach(button => button.addEventListener('click', () => { if (api.state.result) runAction(button.dataset.action); }));
  $('#your-app-form').addEventListener('submit', event => { event.preventDefault(); if (!api.state.result) return; openDoc({ title: 'Skills needed to build your app', basis: 'Repository evidence plus your description', text: knowledge.skillsForYourApp(api.state.result, $('#your-app').value.trim()), filename: 'skills-for-your-app.md' }); });
}
