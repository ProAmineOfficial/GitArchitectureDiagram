// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-EVIDENCE-001
// Project: Git Architecture Diagram | Component: Repository intelligence (shared by browser and server) | Author: Amine Saoud ibn al-Bashir.
// Large repositories are never sent whole to a model. This module turns an analysis result into a hierarchy of
// deterministic, evidence-grounded summaries and then retrieves only what each Genius agent needs:
//   1. inventory    the tree, manifests, docs, entry points, imports (already in the analysis result)
//   2. classify     a role per file (entrypoint, core, api, ui, service, storage, configuration, …)
//   3. summarize    bounded per-file, per-module (folder), per-subsystem, and repository summaries
//   4. merge        file → module → subsystem → repository
//   5. retrieve     relevant excerpts and summaries for one agent, within a character budget
//   6. expand       bounded extra slices on request, with the reason recorded
// File summaries are cached by repository, path, and blob SHA (content hash), so a new commit recomputes only the
// files whose content changed; module and higher summaries are cheap and rebuilt per commit and scope.

export const INTEL_VERSION = 1;
export const ROLES = ['entrypoint', 'core', 'api', 'ui', 'service', 'storage', 'configuration', 'documentation', 'test', 'hardware', 'build', 'deployment', 'external-integration', 'asset'];

const fileCache = new Map(); // repository|path|sha → file summary
const intelCache = new Map(); // repository|commit|scope|version → intelligence
const CODE = /\.(m?[jc]?[jt]sx?|py|c|cc|cpp|h|hpp|ino|rs|go|java|kt|cs|rb|php|swift|vue|svelte|lua|dart|scala|ex|exs)$/i;

/** Classify one path into a repository role. Name- and location-based; content only refines hardware and API hints. */
export function classifyPath(path, { entrypoints = new Set(), content = '' } = {}) {
  const lower = path.toLowerCase(); const name = lower.split('/').pop();
  if (entrypoints.has(path)) return 'entrypoint';
  if (/(^|\/)(tests?|__tests__|spec|e2e)\/|\.(test|spec)\.[a-z]+$/.test(lower)) return 'test';
  if (/\.(md|mdx|rst|txt|adoc)$/.test(lower) || /(^|\/)(docs?|documentation)\//.test(lower) || /^(license|notice|changelog|contributing|security)(\.|$)/.test(name)) return 'documentation';
  if (/(^|\/)(dockerfile|docker-compose[^/]*|compose\.ya?ml|procfile|vercel\.json|netlify\.toml|fly\.toml|app\.yaml|wrangler\.(toml|json))$/.test(lower) || /(^|\/)(\.github\/workflows|k8s|kubernetes|helm|deploy|deployment|\.circleci)\//.test(lower)) return 'deployment';
  if (/(^|\/)(package\.json|makefile|cmakelists\.txt|platformio\.ini|cargo\.toml|go\.mod|pyproject\.toml|setup\.py|build\.gradle(\.kts)?|pom\.xml|tsconfig[^/]*\.json|vite\.config\.[a-z]+|webpack\.config\.[a-z]+|rollup\.config\.[a-z]+|esbuild[^/]*)$/.test(lower) || /(^|\/)scripts\/build/.test(lower)) return 'build';
  if (/\.(png|jpe?g|gif|webp|svg|ico|bmp|woff2?|ttf|otf|mp3|wav|mp4|bin|hex|pdf)$/.test(lower)) return 'asset';
  if (/(^|\/)(\.env\.example|\.env\.sample)$/.test(lower) || /(^|\/)(config|configs|settings|conf)\//.test(lower) || /(config|settings)\.[a-z]+$/.test(name) || /\.(ini|toml|ya?ml|cfg|conf)$/.test(lower)) return 'configuration';
  if (/\.ino$|(^|\/)(firmware|hardware|boards?|drivers?|sensors?|hal|bsp)\//.test(lower) || /(gpio|pinout|sensor|motor|servo|actuator)/.test(name) || /\.(sch|kicad_pcb|kicad_sch|intlib|schlib|pcblib)$/.test(lower) || /#include\s*[<"](Arduino|Wire|SPI|driver\/gpio|esp_)/.test(content)) return 'hardware';
  if (/(^|\/)(routes?|api|controllers?|handlers?|endpoints?|graphql|resolvers?)\//.test(lower) || /(router|routes|controller|handler|endpoint)s?\.[a-z]+$/.test(name) || /openapi|swagger/.test(name)) return 'api';
  if (/(^|\/)(db|database|models?|schema|schemas|migrations?|store|stores|repositor(y|ies)|persistence|prisma)\//.test(lower) || /\.(sql|prisma)$/.test(lower)) return 'storage';
  if (/(^|\/)(clients?|integrations?|adapters?|providers?|sdk|webhooks?|connectors?)\//.test(lower) || /(client|adapter|provider|webhook)s?\.[a-z]+$/.test(name)) return 'external-integration';
  if (/(^|\/)(services?|workers?|jobs?|queues?|tasks?|daemons?)\//.test(lower) || /(service|worker|job)s?\.[a-z]+$/.test(name)) return 'service';
  if (/\.(css|scss|sass|less|html|jsx|tsx|vue|svelte)$/.test(lower) || /(^|\/)(ui|components?|views?|pages?|screens?|public|static|frontend|web|client|templates?|layouts?)\//.test(lower)) return 'ui';
  if (/(^|\/)(main|index|app|server|cli)\.[a-z]+$/.test(lower) && !lower.slice(0, -name.length).replace(/\/$/, '').includes('/')) return 'entrypoint';
  return CODE.test(lower) ? 'core' : 'configuration';
}

const SYMBOL_PATTERNS = [
  [/^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/, 'export'],
  [/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/, 'function'],
  [/^\s*class\s+([A-Za-z_][\w]*)/, 'class'],
  [/^\s*(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(/, 'function'],
  [/^\s*(?:pub\s+)?fn\s+([A-Za-z_][\w]*)/, 'function'],
  [/^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_][\w]*)/, 'function'],
  [/^\s*(?:static\s+|inline\s+|virtual\s+)*(?:void|int|bool|float|double|char|auto|esp_err_t|uint\d+_t|[A-Z][\w:<>]*)\s+\*?([A-Za-z_][\w:]*)\s*\([^;]*$/, 'function'],
];
const SIGNALS = {
  errorHandling: /\b(catch|throw|raise|except|panic!?|Result<|ESP_ERROR_CHECK|try\s*\{|on\s*\(\s*['"]error)/,
  todo: /\b(TODO|FIXME|HACK|XXX)\b/,
  envReads: /process\.env\b|os\.environ|getenv\(|import\.meta\.env|env\[/,
  risky: /\beval\s*\(|new Function\s*\(|child_process|\bexec(Sync)?\s*\(|innerHTML\s*=|dangerouslySetInnerHTML|\bpickle\.loads|yaml\.load\(|shell\s*=\s*True|strcpy\(|sprintf\(|gets\(/,
  secrets: /(api[_-]?key|secret|password|passwd|token|private[_-]?key)\s*[:=]/i,
  network: /\bfetch\(|axios|http\.request|requests\.(get|post)|WiFi\.|HTTPClient|WebSocket|grpc/i,
};

/** A bounded, deterministic summary of one file that was read. */
export function summarizeFile(file, { role, imports = [], importedBy = [], externals = [] }) {
  const lines = String(file.content ?? '').split('\n'); const symbols = []; const headings = []; const keyLines = []; const signals = Object.fromEntries(Object.keys(SIGNALS).map(key => [key, 0]));
  const markdown = /\.(md|mdx)$/i.test(file.path);
  lines.forEach((text, index) => {
    const line = index + 1;
    if (markdown) { const heading = text.match(/^(#{1,3})\s+(.{2,100})$/); if (heading && headings.length < 10) headings.push({ text: heading[2].trim(), line }); return; }
    if (symbols.length < 16) for (const [pattern, kind] of SYMBOL_PATTERNS) { const match = text.match(pattern); if (match && !/^(if|for|while|switch|return|else)$/.test(match[1]) && !symbols.some(item => item.name === match[1])) { symbols.push({ name: match[1], kind, line }); break; } }
    for (const [key, pattern] of Object.entries(SIGNALS)) if (pattern.test(text)) { signals[key]++; if (keyLines.length < 10 && key !== 'network') keyLines.push({ line, signal: key, text: text.trim().slice(0, 160) }); }
  });
  const purpose = markdown ? (headings[0]?.text || '') : (lines.slice(0, 12).map(text => text.match(/^\s*(?:\/\/|#|\/\*+|\*|--|;)\s?(.{12,160})$/)?.[1]).find(Boolean) || '');
  const parts = [`${role} file, ${lines.length} lines`];
  if (purpose) parts.push(`header: "${purpose.replace(/\*\/\s*$/, '').trim()}"`);
  if (symbols.length) parts.push(`defines ${symbols.slice(0, 6).map(item => item.name).join(', ')}${symbols.length > 6 ? '…' : ''}`);
  if (headings.length) parts.push(`sections ${headings.slice(0, 5).map(item => item.text).join('; ')}`);
  if (imports.length) parts.push(`imports ${imports.length} local file${imports.length > 1 ? 's' : ''}`);
  if (importedBy.length) parts.push(`imported by ${importedBy.length}`);
  if (externals.length) parts.push(`uses ${externals.slice(0, 4).join(', ')}`);
  return { path: file.path, sha: file.sha || '', role, lines: lines.length, bytes: file.size || String(file.content ?? '').length, purpose, symbols, headings, keyLines, signals, imports, importedBy, externals, summary: parts.join('; ') + '.' };
}

const parentOf = path => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

/** Build the repository intelligence hierarchy for an analysis result (cached per repository, commit, and scope). */
export function buildIntel(result) {
  const repo = result.repository; const key = `${repo.fullName}|${repo.sha}|${repo.scope || ''}|${INTEL_VERSION}`;
  if (intelCache.has(key)) return intelCache.get(key);
  const entrypoints = new Set((result.entrypoints || []).map(item => item.path));
  const deps = result.dependencies || []; const externalBy = new Map();
  for (const [name, users] of Object.entries(result.externalUsage || {})) for (const user of users) { if (!externalBy.has(user)) externalBy.set(user, []); externalBy.get(user).push(name); }
  const blobs = (repo.entries || []).filter(entry => entry.type === 'blob');
  const read = new Map((result.files || []).map(file => [file.path, file]));
  const roles = new Map(blobs.map(entry => [entry.path, classifyPath(entry.path, { entrypoints, content: read.get(entry.path)?.content?.slice(0, 4000) || '' })]));
  const files = new Map(); let reused = 0;
  for (const file of read.values()) { // Stage 3: per-file summaries, reused when the blob SHA is unchanged.
    const cacheKey = `${repo.fullName}|${file.path}|${file.sha || ''}|${roles.get(file.path)}`;
    const imports = deps.filter(edge => edge.from === file.path).map(edge => edge.to); const importedBy = deps.filter(edge => edge.to === file.path).map(edge => edge.from);
    let summary = file.sha ? fileCache.get(cacheKey) : null;
    if (summary && summary.imports.join() === imports.join() && summary.importedBy.join() === importedBy.join()) reused++;
    else { summary = summarizeFile(file, { role: roles.get(file.path) || 'core', imports, importedBy, externals: externalBy.get(file.path) || [] }); if (file.sha) fileCache.set(cacheKey, summary); }
    files.set(file.path, summary);
  }
  while (fileCache.size > 4000) fileCache.delete(fileCache.keys().next().value);
  const modules = new Map(); // Stage 4a: folder-level modules.
  for (const entry of blobs) { const folder = parentOf(entry.path); if (!modules.has(folder)) modules.set(folder, { path: folder, files: 0, read: 0, roles: {}, keyFiles: [], symbols: [], importsFrom: new Set(), importedBy: new Set() }); const module = modules.get(folder); module.files++; const role = roles.get(entry.path); module.roles[role] = (module.roles[role] || 0) + 1; if (files.has(entry.path)) module.read++; }
  for (const edge of deps) { const from = parentOf(edge.from); const to = parentOf(edge.to); if (from !== to && modules.has(from) && modules.has(to)) { modules.get(from).importsFrom.add(to); modules.get(to).importedBy.add(from); } }
  for (const module of modules.values()) {
    const inside = [...files.values()].filter(summary => parentOf(summary.path) === module.path);
    module.keyFiles = inside.sort((a, b) => b.importedBy.length - a.importedBy.length || (b.role === 'entrypoint') - (a.role === 'entrypoint') || b.lines - a.lines).slice(0, 4).map(summary => summary.path);
    module.symbols = inside.flatMap(summary => summary.symbols.slice(0, 3).map(item => item.name)).slice(0, 8);
    module.dominantRole = Object.entries(module.roles).sort((a, b) => b[1] - a[1])[0]?.[0] || 'core';
    module.importsFrom = [...module.importsFrom]; module.importedBy = [...module.importedBy];
    module.summary = `${module.path || '(root)'}: ${module.files} file${module.files === 1 ? '' : 's'} (${module.read} read), mostly ${module.dominantRole}${module.symbols.length ? `; defines ${module.symbols.slice(0, 5).join(', ')}` : ''}${module.importsFrom.length ? `; imports from ${module.importsFrom.slice(0, 3).map(path => path || '(root)').join(', ')}` : ''}${module.importedBy.length ? `; used by ${module.importedBy.length} other folder${module.importedBy.length > 1 ? 's' : ''}` : ''}.`;
  }
  const scope = repo.scope ? repo.scope + '/' : ''; // Stage 4b: subsystems are the top-level folders of the scope.
  const subsystemOf = path => { const rest = path.startsWith(scope) ? path.slice(scope.length) : path; return rest.includes('/') ? rest.split('/')[0] : '.'; };
  const subsystems = new Map();
  for (const entry of blobs) { const id = subsystemOf(entry.path); if (!subsystems.has(id)) subsystems.set(id, { id, label: id === '.' ? 'Top-level files' : id, folder: id === '.' ? repo.scope || '' : scope + id, files: 0, read: 0, roles: {}, dependsOn: new Set(), modules: new Set() }); const item = subsystems.get(id); item.files++; if (files.has(entry.path)) item.read++; const role = roles.get(entry.path); item.roles[role] = (item.roles[role] || 0) + 1; item.modules.add(parentOf(entry.path)); }
  for (const edge of deps) { const from = subsystemOf(edge.from); const to = subsystemOf(edge.to); if (from !== to && subsystems.has(from)) subsystems.get(from).dependsOn.add(to); }
  for (const item of subsystems.values()) { item.dependsOn = [...item.dependsOn]; item.modules = [...item.modules].length; item.dominantRole = Object.entries(item.roles).sort((a, b) => b[1] - a[1])[0]?.[0] || 'core'; item.summary = `${item.label}: ${item.files} files (${item.read} read), ${item.modules} folder${item.modules === 1 ? '' : 's'}, mostly ${item.dominantRole}${item.dependsOn.length ? `; depends on ${item.dependsOn.slice(0, 4).join(', ')}` : ''}.`; }
  const roleCounts = {}; for (const role of roles.values()) roleCounts[role] = (roleCounts[role] || 0) + 1;
  const ordered = [...subsystems.values()].sort((a, b) => b.read - a.read || b.files - a.files);
  const repository = { fullName: repo.fullName, commit: repo.sha, scope: repo.scope || '', filesListed: blobs.length, filesRead: files.size, roles: roleCounts, entrypoints: [...entrypoints], externals: (result.externalModules || []).slice(0, 20), layers: (result.hierarchy?.source?.root?.children || []).map(layer => layer.label), summary: `${repo.fullName} at ${repo.sha.slice(0, 12)}${repo.scope ? ` (folder ${repo.scope})` : ''}: ${blobs.length} files listed, ${files.size} read. Subsystems: ${ordered.slice(0, 8).map(item => item.label).join(', ')}. Roles: ${Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([role, count]) => `${role} ${count}`).join(', ')}.` };
  const intel = { key, version: INTEL_VERSION, repository, roles, files, modules: [...modules.values()].sort((a, b) => b.read - a.read || b.files - a.files), subsystems: ordered, cache: { fileSummariesReused: reused, fileSummariesBuilt: files.size - reused } };
  intelCache.set(key, intel); while (intelCache.size > 12) intelCache.delete(intelCache.keys().next().value);
  return intel;
}

const numbered = (lines, start) => lines.map((text, index) => `${start + index}: ${text}`).join('\n');

/** One bounded, line-numbered excerpt of a read file around the most relevant line. */
export function excerptOf(file, { center = 1, lines = 80 } = {}) {
  const all = String(file.content ?? '').split('\n'); const half = Math.floor(lines / 2);
  const start = Math.max(1, Math.min(center - half, all.length - lines + 1)); const slice = all.slice(start - 1, start - 1 + lines);
  return { path: file.path, startLine: start, endLine: start + slice.length - 1, source: numbered(slice, start) };
}

/**
 * Stage 5: retrieve evidence for one agent. Files are scored by role, keywords, signals, and centrality; each chosen
 * file contributes one excerpt centered on its strongest keyword hit. Module and subsystem summaries come along.
 */
export function retrieve(intel, result, { roles = [], keywords = [], signals = [], paths = [], budgetChars = 36000, maxExcerpts = 14, lines = 80, reasonPrefix = '' } = {}) {
  const read = new Map((result.files || []).map(file => [file.path, file])); const words = keywords.map(word => word.toLowerCase());
  const scored = [...intel.files.values()].map(summary => {
    const file = read.get(summary.path); const text = String(file?.content ?? '').toLowerCase(); const why = []; let score = 0;
    if (paths.includes(summary.path)) { score += 100; why.push('requested'); }
    if (roles.includes(summary.role)) { score += 12; why.push(`role ${summary.role}`); }
    let hits = 0; for (const word of words) { const count = text.split(word).length - 1; if (count) { hits += Math.min(count, 6); } }
    if (hits) { score += Math.min(hits, 18) * 1.5; why.push(`${hits} keyword hit${hits > 1 ? 's' : ''}`); }
    for (const signal of signals) if (summary.signals[signal]) { score += Math.min(summary.signals[signal], 5) * 2; why.push(`${signal} ×${summary.signals[signal]}`); }
    if (summary.importedBy.length) { score += Math.min(summary.importedBy.length, 8); why.push(`imported by ${summary.importedBy.length}`); }
    if (summary.role === 'entrypoint') score += 6;
    return { summary, file, score, why };
  }).filter(item => item.file && item.score > 0).sort((a, b) => b.score - a.score || a.summary.path.localeCompare(b.summary.path));
  const excerpts = []; let used = 0;
  for (const item of scored) {
    if (excerpts.length >= maxExcerpts || used >= budgetChars) break;
    const all = String(item.file.content).split('\n'); let center = 1;
    if (words.length || signals.length) { const index = all.findIndex(text => words.some(word => text.toLowerCase().includes(word)) || signals.some(signal => SIGNALS[signal]?.test(text))); if (index >= 0) center = index + 1; }
    let excerpt = excerptOf(item.file, { center, lines });
    if (used + excerpt.source.length > budgetChars) { const room = budgetChars - used; if (room < 600) break; excerpt = { ...excerpt, source: excerpt.source.slice(0, room), partial: true }; }
    used += excerpt.source.length; excerpts.push({ ...excerpt, role: item.summary.role, reason: `${reasonPrefix}${item.why.join(', ') || 'context'}` });
  }
  const chosen = new Set(excerpts.map(item => item.path)); const folders = new Set([...chosen].map(parentOf));
  return {
    repository: intel.repository,
    subsystems: intel.subsystems.slice(0, 12).map(item => item.summary),
    modules: intel.modules.filter(module => folders.has(module.path)).concat(intel.modules.filter(module => !folders.has(module.path)).slice(0, 6)).slice(0, 16).map(module => module.summary),
    files: excerpts.map(item => intel.files.get(item.path)?.summary).filter(Boolean),
    relationships: (result.dependencies || []).filter(edge => chosen.has(edge.from) || chosen.has(edge.to)).slice(0, 40).map(edge => `${edge.from}:${edge.line} ${edge.kind === 'include' ? 'includes' : 'imports'} ${edge.to}`),
    excerpts, characters: used,
  };
}

/**
 * Stage 6: lazily load extra evidence an agent asked for. Only files already read and verified in this analysis can
 * be loaded; every request is logged with its reason and outcome.
 */
export function expandEvidence(intel, result, requests, { budgetChars = 12000, maxFiles = 3, already = new Set(), requestedBy = '' } = {}) {
  const read = new Map((result.files || []).map(file => [file.path, file])); const listed = new Set((result.repository.entries || []).filter(entry => entry.type === 'blob').map(entry => entry.path));
  const excerpts = []; const log = []; let used = 0;
  for (const request of (Array.isArray(requests) ? requests : []).slice(0, 6)) {
    const path = String(request?.path ?? '').replace(/^\/+/, ''); const reason = String(request?.reason ?? '').slice(0, 200) || 'More evidence requested.';
    if (!listed.has(path)) { log.push({ path, reason, requestedBy, status: 'rejected', note: 'Not a file in this commit.' }); continue; }
    if (!read.has(path)) { log.push({ path, reason, requestedBy, status: 'not-read', note: 'Exists, but was outside the analysis file budget; increase Files to read to include it.' }); continue; }
    if (already.has(path)) { log.push({ path, reason, requestedBy, status: 'already-loaded', note: '' }); continue; }
    if (excerpts.length >= maxFiles || used >= budgetChars) { log.push({ path, reason, requestedBy, status: 'skipped', note: 'The expansion budget for this stage was used.' }); continue; }
    const excerpt = excerptOf(read.get(path), { center: Number.isInteger(request.line) ? request.line : 1, lines: 90 });
    const source = excerpt.source.slice(0, budgetChars - used); used += source.length; already.add(path);
    excerpts.push({ ...excerpt, source, role: intel.files.get(path)?.role || 'core', reason: `Requested by ${requestedBy || 'an agent'}: ${reason}` });
    log.push({ path, reason, requestedBy, status: 'loaded', note: `Lines ${excerpt.startLine}–${excerpt.endLine}` });
  }
  return { excerpts, log, characters: used };
}

/** Test hook: clear the caches. */
export function clearIntelCache() { fileCache.clear(); intelCache.clear(); }
export function intelCacheSize() { return { files: fileCache.size, repositories: intelCache.size }; }
