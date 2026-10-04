// Project: Git Architecture Diagram | Component: Project extract view | Author: Amine Saoud ibn al-Bashir.
// Five sections (summary, statistics, directory structure, important files, file contents), each with Copy,
// plus Copy all and Download. Files come from the analysis (instant) or the full archive (one GitHub request).
// Repository text is always inserted with textContent.
import { runAction, exportDiagramFor } from './extras.js';
import { cloneCommand, engineeringPrompt, skillsMarkdown, hierarchyMermaid } from './knowledge.js';
import { icon } from './icons.js';
import { DEFAULT_EXCLUDE, SIZE_CHOICES, compileFilter, parsePatterns, isCredentialPath, isBinaryPath, statistics, sections, allText, asMarkdown, formatBytes, estimateTokens } from './extract-core.js';

const $ = selector => document.querySelector(selector);
function el(tag, className, text) { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; }
const PALETTE = ['#6f8dff', '#55d6ca', '#e3a0ed', '#f2c66d', '#79d99b', '#ff9f68', '#b9a4ff', '#66d4ff', '#c3e36b', '#8aa0b6'];
const PREVIEW = 300000; // Characters shown on screen; Copy and Download always include everything.
let api; let current = null; let controller = null; let built = false; let forCommit = '';

export function setupExtractView(workspace) { api = workspace; return { render, reset: () => { current = null; built = false; forCommit = ''; } }; }

function controls() {
  const box = el('div', 'extract-controls');
  const source = el('div', 'segmented'); source.id = 'extract-source'; source.setAttribute('role', 'group'); source.setAttribute('aria-label', 'Files to include');
  [['analysis', 'Analyzed files'], ['archive', 'Entire repository']].forEach(([id, label], index) => { const button = el('button', '', label); button.type = 'button'; button.dataset.source = id; button.setAttribute('aria-pressed', String(index === 0)); button.addEventListener('click', () => { source.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button))); note(); }); source.append(button); });
  const field = (label, input) => { const wrap = el('label', 'extract-field'); wrap.append(el('span', '', label), input); return wrap; };
  const include = el('input'); include.id = 'extract-include'; include.placeholder = 'Everything (e.g. *.md, src/)'; include.autocomplete = 'off'; include.spellcheck = false;
  const exclude = el('input'); exclude.id = 'extract-exclude'; exclude.value = DEFAULT_EXCLUDE.join(', '); exclude.autocomplete = 'off'; exclude.spellcheck = false;
  const size = el('select'); size.id = 'extract-size'; SIZE_CHOICES.forEach(bytes => { const option = el('option', '', formatBytes(bytes)); option.value = String(bytes); if (bytes === 50000) option.selected = true; size.append(option); });
  const run = el('button', 'primary-button', 'Export Project'); run.id = 'extract-run'; run.type = 'button'; run.addEventListener('click', build);
  const cancel = el('button', 'quiet-button', 'Cancel'); cancel.id = 'extract-cancel'; cancel.type = 'button'; cancel.hidden = true; cancel.addEventListener('click', () => controller?.abort());
  const row = el('div', 'extract-row'); row.append(field('Include', include), field('Exclude', exclude), field('Largest file', size));
  const actions = el('div', 'extract-run'); actions.append(run, cancel);
  const hint = el('p', 'fineprint extract-note'); hint.id = 'extract-note';
  box.append(source, row, actions, hint);
  [include, exclude].forEach(input => input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); build(); } }));
  return box;
}
function sourceChoice() { return $('#extract-source [aria-pressed=true]')?.dataset.source || 'analysis'; }
function note() {
  const limits = api.state.limits?.extract; const { result } = api.state;
  $('#extract-note').textContent = sourceChoice() === 'archive'
    ? `Downloads this commit's archive from GitHub in one request${limits ? ` (up to ${limits.compressedBytes / 1e6} MB compressed on this server)` : ''} and reads it on the server. Nothing is stored. Credential files are never read.`
    : `Uses the ${result.files.length} files the analysis already read, out of ${result.coverage.listedFiles}. Instant, with no extra GitHub requests.`;
}

const CARDS = [['genius-pack', 'Genius Development Pack', 'The .gitarchitecture folder: architecture, findings, validated fixes, skills, prompt, roadmap, evidence', 'dock-agents'], ['clone', 'Clone Repository', 'The git command for this exact commit', 'branch'], ['files', 'Project Files', 'Summary, statistics, structure, important files, contents', 'file'], ['diagrams', 'Project Diagrams', 'PNG, SVG, Mermaid, README picture and badge', 'dock-diagrams'], ['skills', 'Project Skills', 'Observed and recommended development skills', 'layers'], ['genius', 'Genius', 'Development prompt, blueprint, roadmap, and plans', 'spark'], ['context', 'AI / Developer Context', 'AI-ready context, developer, knowledge, and reconstruction packs', 'dock-export-project']];
function actionButton(label, handler, iconName) { const button = el('button', 'xp-action'); button.type = 'button'; if (iconName) button.append(icon(iconName)); button.append(document.createTextNode(label)); button.addEventListener('click', handler); return button; }
function cardBody(id) {
  const { result } = api.state; const repo = result.repository; const body = el('div', 'xp-body');
  if (id === 'genius-pack') {
    const deep = result.deep; const base = `${repo.repo}-${repo.sha.slice(0, 7)}`;
    const status = el('p', 'subtle', deep ? `Includes Deep Genius (${deep.provider} · ${deep.model}): ${deep.findings.length} findings, ${deep.solutions.filter(item => item.status === 'APPROVED').length} validated solutions, ${deep.unresolved.length} unresolved. Verified evidence and Genius inference are labeled throughout.` : 'Structural analysis only. Run Deep Genius from the Genius panel to add audit findings, validated solutions, and the extracted development pack.');
    const pack = el('div', 'xp-actions'); pack.append(actionButton('Download Genius Development Pack (.zip)', () => runAction('genius-pack'), 'download'));
    const prompt = el('div', 'xp-actions'); prompt.append(actionButton('Copy Development Prompt', () => api.copy(engineeringPrompt(result), 'Development prompt copied.'), 'link'), actionButton('Download Development Prompt', () => api.download(`${base}-DEVELOPMENT_PROMPT.md`, engineeringPrompt(result), 'text/markdown;charset=utf-8'), 'download'));
    const skills = el('div', 'xp-actions'); skills.append(actionButton('Copy Skills', () => api.copy(skillsMarkdown(result), 'Development skills copied.'), 'link'), actionButton('Download Skills', () => api.download(`${base}-DEVELOPMENT_SKILLS.md`, skillsMarkdown(result), 'text/markdown;charset=utf-8'), 'download'));
    const diagrams = el('div', 'xp-actions wrap'); [['Download Architecture Mermaid', 'ARCHITECTURE.mmd', () => result.diagrams.overview || result.diagrams.architecture], ['Download System Map Mermaid', 'SYSTEM_MAP.mmd', () => result.ai?.graph?.mermaid || `%% No AI system map was generated; component overview instead.\n${result.diagrams.overview || result.diagrams.architecture}`], ['Download Software Hierarchy', 'SOFTWARE_HIERARCHY.mmd', () => hierarchyMermaid(result.hierarchy.source.root)], ['Download Mind Map', 'REPOSITORY_MIND_MAP.mmd', () => result.diagrams.conceptMindmap || result.diagrams.mindmap]].forEach(([label, file, text]) => diagrams.append(actionButton(label, () => api.download(`${base}-${file}`, `${text()}\n`, 'text/plain;charset=utf-8'), 'code')));
    body.append(status, pack, el('h4', 'xp-sub', 'Development prompt'), prompt, el('h4', 'xp-sub', 'Development skills'), skills, el('h4', 'xp-sub', 'Diagrams'), diagrams, el('p', 'fineprint', 'OVERVIEW, ARCHITECTURE, SYSTEM_MAP, SOFTWARE_HIERARCHY, REPOSITORY_MIND_MAP, CRITICAL_FILES, READING_ORDER, AUDIT_FINDINGS, VALIDATED_SOLUTIONS, DEVELOPMENT_SKILLS, DEVELOPMENT_PROMPT, APP_BLUEPRINT, IMPLEMENTATION_ROADMAP, AI_READY_CONTEXT, RECONSTRUCTION_GUIDE, PROJECT_KNOWLEDGE.json, EVIDENCE.json, and manifest.json. No credential is ever included.'));
  }
  if (id === 'clone') {
    const command = cloneCommand(repo); const pre = el('pre', 'extract-pre clone-command'); pre.textContent = command;
    const row = el('div', 'xp-actions'); row.append(actionButton('Copy Clone Command', () => api.copy(command, 'Clone command copied.'), 'link'));
    const github = el('a', 'xp-action', 'Open on GitHub'); github.href = `${repo.htmlUrl || `https://github.com/${repo.fullName}`}/tree/${repo.sha}`; github.target = '_blank'; github.rel = 'noreferrer'; row.append(github);
    body.append(pre, row, el('p', 'fineprint', `Git clone downloads the source at ${repo.sha.slice(0, 7)}. No token or password is ever included${repo.private ? '; use your own Git credentials for this private repository' : ''}. Project reconstruction is different: it describes how to build something similar, under AI / Developer Context.`));
  }
  if (id === 'files') { body.append(controls(), el('div', 'extract-status'), el('div', 'extract-output')); body.querySelector('.extract-status').id = 'extract-status'; body.querySelector('.extract-output').id = 'extract-output'; }
  if (id === 'diagrams') {
    const views = [['architecture', 'Architecture'], ...(result.ai?.graph ? [['system', 'System map']] : []), ['hierarchy', 'Software hierarchy'], ['mindmap', 'Repository mind map'], ...result.documented.slice(0, 6).map((item, index) => [`documented:${index}`, `Project diagram: ${item.path.split('/').pop()}:${item.line}`])];
    const table = el('div', 'xp-diagrams');
    views.forEach(([key, label]) => { const [view, index] = key.split(':'); const row = el('div', 'xp-diagram-row'); row.dataset.view = key; const actions = el('div', 'xp-actions'); [['PNG', 'png', 'download'], ['SVG', 'svg', 'download'], ['Copy Mermaid', 'copy', 'link'], ['Mermaid file', 'mmd', 'code']].forEach(([text, format, iconName]) => actions.append(actionButton(text, () => exportDiagramFor(view, format, { index: Number(index || 0), filename: `${repo.repo}-${key.replace(':', '-')}` }), iconName))); row.append(el('span', 'xp-diagram-name', label), actions); table.append(row); });
    const readme = el('div', 'xp-actions'); readme.append(actionButton('README Picture…', () => runAction('readme-picture'), 'file'), actionButton('README Badge…', () => runAction('readme-badge'), 'spark'));
    body.append(table, readme);
  }
  if (id === 'skills') { const row = el('div', 'xp-actions'); row.append(actionButton('Export Project Skills…', () => runAction('skills'), 'layers')); body.append(el('p', 'subtle', 'Observed skills cite the file that shows them; recommended skills are listed separately with a reason. Formats: Markdown, text, JSON.'), row); }
  if (id === 'genius') { const row = el('div', 'xp-actions wrap'); [['Development Prompt by Genius…', 'similar', 'Development prompt by Genius'], ['Build Similar App…', 'similar', 'Build a similar app'], ['MVP Plan…', 'mvp', 'MVP plan'], ['Frontend Plan…', 'frontend', 'Frontend plan'], ['Backend Plan…', 'backend', 'Backend plan'], ['API Plan…', 'api', 'API plan'], ['Database Plan…', 'database', 'Database plan']].forEach(([label, mode, title]) => row.append(actionButton(label, () => runAction('prompt', { mode, title }), 'spark'))); row.append(actionButton('App Blueprint…', () => runAction('blueprint'), 'dock-hierarchy'), actionButton('Implementation Roadmap…', () => runAction('roadmap'), 'layers')); body.append(row, el('p', 'fineprint', 'Assembled from this analysis without a model call; anything from the AI system map is labeled.')); }
  if (id === 'context') { const row = el('div', 'xp-actions wrap'); row.append(actionButton('AI-Ready Context…', () => runAction('context'), 'spark'), actionButton('Developer Pack (.zip)', () => runAction('developer-pack'), 'download'), actionButton('Project Knowledge Pack (.zip)', () => runAction('knowledge-pack'), 'download'), actionButton('Project Reconstruction Pack (.zip)', () => runAction('pack'), 'download')); body.append(row, el('p', 'fineprint', 'Knowledge, not source duplication: architecture, hierarchy, mind map, relationships, skills, plans, and evidence, with verified source and Genius inference labeled.')); }
  return body;
}
export function render() {
  const view = $('#extract-view'); const sha = api.state.result.repository.sha;
  if (built && forCommit === sha) { note(); return; }
  const head = el('header', 'xp-head'); head.append(el('h2', '', 'Export Project'), el('p', 'subtle', 'Clone the source, export project files and diagrams, project skills, development prompts and plans, and AI-ready knowledge.'));
  const list = el('div', 'xp-cards');
  for (const [id, title, description, iconName] of CARDS) { const card = el('details', 'xp-card'); card.dataset.card = id; if (id === 'files') card.open = true; const summary = el('summary'); const mark = el('span', 'xp-icon'); mark.append(icon(iconName)); const text = el('span', 'xp-title'); text.append(el('strong', '', title), el('span', '', description)); summary.append(mark, text); card.append(summary, cardBody(id)); list.append(card); }
  view.replaceChildren(head, list);
  built = true; forCommit = sha; note(); build();
}

function filters() { return { include: parsePatterns($('#extract-include').value), exclude: parsePatterns($('#extract-exclude').value), maxFileSize: Number($('#extract-size').value) }; }
function fromAnalysis(chosen) {
  const { result } = api.state; const repo = result.repository; const scope = repo.scope || ''; const relative = path => (scope ? path.slice(scope.length + 1) : path);
  const filter = compileFilter(chosen); const files = []; const skipped = { filtered: 0, tooLarge: [], binary: 0, credentials: [], budget: 0, symlinks: 0 };
  for (const file of result.files) {
    if (isCredentialPath(file.path)) { skipped.credentials.push(file.path); continue; }
    if (!filter(relative(file.path))) { skipped.filtered++; continue; }
    if (file.size > chosen.maxFileSize) { skipped.tooLarge.push({ path: file.path, size: file.size }); continue; }
    if (isBinaryPath(file.path)) { skipped.binary++; continue; }
    files.push({ path: file.path, size: file.size, lines: file.content ? file.content.split('\n').length : 0, content: file.content });
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { repository: repo.fullName, commit: repo.sha, scope, source: 'analysis', listed: result.coverage.listedFiles, files, skipped, stats: statistics(files), filters: chosen };
}
async function fromArchive(chosen) {
  const { result } = api.state; const repo = result.repository;
  controller?.abort(); controller = new AbortController(); $('#extract-cancel').hidden = false; $('#extract-run').disabled = true;
  try {
    const response = await fetch('/api/extract', { method: 'POST', headers: api.headers(), signal: controller.signal, body: JSON.stringify({ repository: repo.fullName, commit: repo.sha, scope: repo.scope || '', ...chosen, githubToken: api.credentials().githubToken || '' }) });
    return await readEvents(response, event => status(`${event.stage}${event.detail ? `: ${event.detail}` : ''}`));
  } finally { controller = null; $('#extract-cancel').hidden = true; $('#extract-run').disabled = false; }
}
/** Read the NDJSON stream; HTML gateway pages and malformed lines become clear errors. */
async function readEvents(response, onProgress) {
  const type = (response.headers.get('Content-Type') || '').split(';')[0].trim();
  if (!response.ok) { if (type === 'application/json') { const body = await response.json().catch(() => ({})); throw new Error(typeof body.error === 'string' ? body.error : `The extract could not start (HTTP ${response.status}).`); } await response.body?.cancel(); throw new Error(`The hosting service returned a page instead of extract data (HTTP ${response.status}).`); }
  if (type !== 'application/x-ndjson') { await response.body?.cancel(); throw new Error(`The server returned ${type || 'an unknown format'} instead of extract data.`); }
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = ''; let result = null; let bytes = 0;
  const receive = line => { if (!line.trim()) return; if (line.trimStart().startsWith('<')) throw new Error('The hosting service interrupted the extract with an HTML page.'); const event = JSON.parse(line); if (event.type === 'error') throw new Error(event.message || 'The extract failed.'); if (event.type === 'progress') onProgress(event); if (event.type === 'result') result = event.result; };
  while (true) { const { value, done } = await reader.read(); bytes += value?.byteLength || 0; if (bytes > 64e6) throw new Error('The extract response exceeded 64 MB. Narrow it with Include or a smaller file limit.'); pending += decoder.decode(value, { stream: !done }); let end; while ((end = pending.indexOf('\n')) !== -1) { receive(pending.slice(0, end)); pending = pending.slice(end + 1); } if (done) break; }
  if (pending.trim()) receive(pending); if (!result) throw new Error('The connection ended before the extract finished.'); return result;
}
function status(text, error = false) { const box = $('#extract-status'); box.textContent = text; box.classList.toggle('error', error); box.hidden = !text; }

async function build() {
  const chosen = filters(); status(sourceChoice() === 'archive' ? 'Starting…' : '');
  try { current = sourceChoice() === 'archive' ? await fromArchive(chosen) : fromAnalysis(chosen); status(''); output(); }
  catch (error) { status(error.name === 'AbortError' ? 'Extract cancelled.' : error.message, error.name !== 'AbortError'); }
}

function importantFiles() {
  const { result } = api.state; const present = new Set(current.files.map(file => file.path)); const list = []; const seen = new Set();
  const add = (path, why) => { if (present.has(path) && !seen.has(path)) { seen.add(path); list.push({ path, why }); } };
  result.readingOrder?.forEach(item => add(item.path, item.why)); result.entrypoints.forEach(item => add(item.path, 'Entry point.'));
  const inbound = new Map(); result.dependencies.forEach(edge => inbound.set(edge.to, (inbound.get(edge.to) || 0) + 1)); [...inbound].sort((a, b) => b[1] - a[1]).forEach(([path, count]) => add(path, `Imported by ${count} files.`));
  current.files.filter(file => /(^|\/)(readme|package\.json|platformio\.ini|pyproject\.toml|cargo\.toml|go\.mod|dockerfile)/i.test(file.path)).forEach(file => add(file.path, 'Project description or manifest.'));
  return list.slice(0, 15);
}

function card(title, meta, copyText, body, wide = false) {
  const section = el('section', `extract-card${wide ? ' wide' : ''}`); const head = el('header');
  const copy = el('button', 'glass-pill', 'Copy'); copy.type = 'button'; copy.addEventListener('click', () => api.copy(copyText(), `${title} copied.`));
  head.append(el('h3', '', title), el('span', 'extract-meta', meta), copy); section.append(head, body); return section;
}
function output() {
  const out = $('#extract-output'); out.replaceChildren(); const important = importantFiles(); const parts = sections(current, important); const full = allText(parts); const tokens = estimateTokens(full);
  const bar = el('div', 'extract-actions');
  const action = (label, handler, primary = false) => { const button = el('button', primary ? 'primary-button' : 'quiet-button', label); button.type = 'button'; button.addEventListener('click', handler); bar.append(button); };
  const base = `${current.repository.split('/')[1]}-${current.commit.slice(0, 7)}-extract`;
  action('Copy all', () => api.copy(full, 'Whole extract copied.'), true); action('Download .txt', () => api.download(`${base}.txt`, full, 'text/plain;charset=utf-8')); action('Download .md', () => api.download(`${base}.md`, asMarkdown(current, parts), 'text/markdown;charset=utf-8'));
  bar.append(el('span', 'extract-meta', `${current.stats.files} files · ${formatBytes(current.stats.bytes)} · about ${tokens.toLocaleString('en')} tokens in the full extract · ${current.source === 'archive' ? 'entire repository' : 'analyzed files'}`));
  const summary = el('pre', 'extract-pre'); summary.textContent = parts.summary;
  const stats = el('div', 'extract-stats'); const total = current.stats.bytes || 1;
  current.stats.languages.slice(0, 10).forEach((item, index) => { const row = el('div', 'lang-row'); const track = el('div', 'lang-track'); const fill = el('i'); fill.style.width = `${Math.max(1.5, (item.bytes / total) * 100)}%`; fill.style.background = PALETTE[index % PALETTE.length]; track.append(fill); row.append(el('span', 'lang-name', item.name), track, el('span', 'lang-meta', `${item.files} · ${formatBytes(item.bytes)}`)); stats.append(row); });
  const largest = el('ol', 'extract-list'); current.stats.largest.slice(0, 5).forEach(item => largest.append(el('li', '', `${item.path} — ${formatBytes(item.size)}`)));
  const skipped = current.skipped; const omitted = el('ul', 'extract-list muted'); [[skipped.filtered, 'filtered out'], [skipped.tooLarge.length, `over ${formatBytes(current.filters.maxFileSize)}`], [skipped.binary, 'binary'], [skipped.credentials.length, 'possible credentials, never read'], [skipped.budget, 'over the content budget'], [skipped.symlinks, 'symbolic links']].filter(([count]) => count).forEach(([count, label]) => omitted.append(el('li', '', `${count.toLocaleString('en')} ${label}`)));
  stats.append(el('p', 'extract-sub', 'Largest files'), largest, ...(omitted.children.length ? [el('p', 'extract-sub', 'Not included'), omitted] : []));
  const tree = el('pre', 'extract-pre tall'); tree.textContent = parts.structure;
  const list = el('ol', 'extract-important'); important.forEach(item => { const row = el('li'); const button = el('button', 'genius-file', item.path); button.type = 'button'; button.addEventListener('click', () => { const file = current.files.find(entry => entry.path === item.path); api.openDoc({ title: item.path, basis: `From the extract at ${current.commit.slice(0, 7)}`, text: file.content, filename: item.path.split('/').pop() + '.txt' }); }); row.append(button, el('span', 'why', item.why)); list.append(row); });
  if (!important.length) list.append(el('li', 'fineprint', 'No important files are in this selection.'));
  const contents = el('pre', 'extract-pre contents'); contents.textContent = parts.contents.length > PREVIEW ? `${parts.contents.slice(0, PREVIEW)}\n\n… Showing the first ${PREVIEW.toLocaleString('en')} characters of ${parts.contents.length.toLocaleString('en')}. Copy and Download include every file.` : parts.contents;
  const grid = el('div', 'extract-grid');
  grid.append(card('Summary', current.source === 'archive' ? 'Entire repository' : 'Analyzed files', () => parts.summary, summary), card('Statistics', `${current.stats.languages.length} languages`, () => parts.statistics, stats), card('Directory structure', `${current.files.length} files`, () => parts.structure, tree), card('Important files', `${important.length} files`, () => parts.important, list), card('File contents', `${formatBytes(current.stats.bytes)}`, () => parts.contents, contents, true));
  out.append(bar, grid);
}
