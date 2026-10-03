// Project: Git Architecture Diagram | Component: Structural overview | Author: Amine Saoud ibn al-Bashir.
// Description: Deterministic, evidence-backed repository understanding without an AI model:
// which files to read next, how the scope divides into components, and where a newcomer should start.
import path from 'node:path'; // POSIX path arithmetic on repository-relative paths.
import { validateGraph, compileGraph } from './graph.mjs'; // Share one validated graph path with AI output.

const CODE = /\.(m?[jc]?[jt]sx?|py|c|cc|cpp|h|hpp|ino|rs|go|java|kt|cs|rb|php|swift|vue|svelte)$/i;
const BINARY = /\.(png|jpe?g|gif|webp|bmp|ico|svg|pdf|zip|gz|7z|rar|bin|hex|elf|sys|cat|dll|exe|so|a|o|lib|dat|woff2?|ttf|otf|mp3|mp4|wav|stl|step|stp|gbr|drl|kicad_\w+|sch|brd|psd|xlsx?|docx?|pptx?|intlib|schlib|pcblib|schdoc|pcbdoc|step|f3d|dwg|dxf)$/i;
const MANIFEST = /(^|\/)(package\.json|platformio\.ini|pyproject\.toml|Cargo\.toml|go\.mod|CMakeLists\.txt|setup\.py|pom\.xml|build\.gradle(\.kts)?|library\.(json|properties))$/i;
const RESOLVE = ['', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '/index.js', '/index.mjs', '/index.ts'];

/** Resolve a manifest-relative path to a real repository file. */
function resolveIn(paths, base, target) {
  const joined = path.posix.normalize(path.posix.join(base, String(target).replace(/^\.\//, '')));
  if (joined.startsWith('..')) return null;
  for (const extension of RESOLVE) if (paths.has(joined + extension)) return joined + extension;
  return null;
}

/** Collect string leaves of package.json "exports", which may be nested condition objects. */
function exportTargets(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object') Object.values(value).slice(0, 40).forEach(item => exportTargets(item, out));
  return out;
}

/**
 * Suggest which unread files deserve priority after reading one file.
 * Only verified content is used: resolved local imports and entry points declared by manifests.
 * @param {(file: object, entries: object[]) => {edges: object[]}} extract dependency extractor for code files
 */
export function makeDiscover(extract) {
  return function discover(file, snapshot) {
    const paths = new Set(snapshot.entries.filter(entry => entry.type === 'blob').map(entry => entry.path));
    const directory = path.posix.dirname(file.path) === '.' ? '' : path.posix.dirname(file.path);
    const hints = [];
    const add = (target, weight, reason) => { if (target && paths.has(target) && target !== file.path) hints.push({ path: target, weight, reason }); };
    if (CODE.test(file.path)) for (const edge of extract([file], snapshot.entries).edges) add(edge.to, 90, `Imported by ${file.path}:${edge.line}`);
    const name = path.posix.basename(file.path);
    if (name === 'package.json') {
      let manifest; try { manifest = JSON.parse(file.content); } catch { manifest = null; }
      if (manifest && typeof manifest === 'object') {
        for (const field of ['main', 'module', 'browser']) if (typeof manifest[field] === 'string') add(resolveIn(paths, directory, manifest[field]), 130, `Declared as "${field}" in ${file.path}`);
        exportTargets(manifest.exports).slice(0, 8).forEach(target => add(resolveIn(paths, directory, target), 120, `Declared in "exports" of ${file.path}`));
        const bin = typeof manifest.bin === 'string' ? [manifest.bin] : Object.values(manifest.bin || {});
        bin.slice(0, 4).forEach(target => add(resolveIn(paths, directory, target), 125, `Declared as a command in ${file.path}`));
        if (!manifest.main && !manifest.exports) add(resolveIn(paths, directory, 'index'), 100, `Default package entry for ${file.path}`);
      }
    }
    if (name === 'platformio.ini') [...paths].filter(item => item.startsWith(`${directory ? directory + '/' : ''}src/`) && /\.(c|cpp|ino)$/i.test(item)).slice(0, 4).forEach(item => add(item, 110, `Built by ${file.path}`));
    if (name === 'Cargo.toml') ['src/main.rs', 'src/lib.rs'].forEach(item => add(path.posix.join(directory, item), 110, `Built by ${file.path}`));
    if (name === 'go.mod') [...paths].filter(item => (directory ? item.startsWith(directory + '/') : true) && /(^|\/)(main\.go|cmd\/[^/]+\/main\.go)$/.test(item)).slice(0, 3).forEach(item => add(item, 105, `Built by ${file.path}`));
    if (name === 'pyproject.toml') for (const match of file.content.matchAll(/^\s*[\w.-]+\s*=\s*["']([\w.]+):[\w.]+["']/gm)) { const module = match[1].replaceAll('.', '/'); add(resolvePython(paths, directory, module), 115, `Declared as a script in ${file.path}`); }
    if (name === 'CMakeLists.txt') for (const match of file.content.matchAll(/add_(?:executable|library)\s*\(\s*[\w-]+\s+([^)]*)\)/g)) match[1].split(/\s+/).filter(item => CODE.test(item)).slice(0, 4).forEach(item => add(path.posix.join(directory, item), 105, `Built by ${file.path}`));
    return hints;
  };
}
function resolvePython(paths, directory, module) { for (const base of [module, `src/${module}`]) for (const suffix of ['.py', '/__init__.py', '/__main__.py']) { const candidate = path.posix.join(directory, base + suffix); if (paths.has(candidate)) return candidate; } return null; }

/** Classify a component folder by its name first, then by what it contains. */
function componentKind(name, members, container) {
  const lower = name.toLowerCase();
  if (/^(tests?|__tests__|spec|specs|e2e|testing)$/.test(lower)) return 'tests';
  if (/^(\.github|\.gitlab|\.circleci|\.githooks|\.husky|scripts?|tools?|ci|\.devcontainer)$/.test(lower)) return 'automation';
  if (container || /^(examples?|samples?|demos?|applications?|apps|projects?|packages|open_source_projects)(_|$)/.test(lower)) return 'examples';
  if (/^(docs?|documentation|wiki|articles?|guides?|manual)$/.test(lower)) return 'docs';
  if (/^(assets?|images?|img|media|static|resources?|fonts?|icons?)$/.test(lower)) return 'assets';
  if (/^(config|conf|configs|settings|\.vscode|\.config)$/.test(lower)) return 'config';
  if (/^(hardware|pcb|kicad|schematics?|firmware|drivers?|boards?|bsp|hal)$/.test(lower) || /\b(drivers?|footprints?|pcb|kicad|altium|schematics?|pinout|gerbers?)\b/.test(lower)) return 'hardware';
  if (/^(ui|web|frontend|public|client|components|views|pages|www)$/.test(lower)) return 'ui';
  if (/^(server|api|backend|services?|routes?)$/.test(lower)) return 'service';
  if (/^(data|db|database|migrations|models|schemas?)$/.test(lower)) return 'data';
  const count = test => members.filter(member => test.test(member)).length;
  if (members.length && count(/\.(md|mdx|rst|txt)$/i) / members.length >= 0.7) return 'docs';
  if (members.length && count(BINARY) / members.length >= 0.5) return 'assets';
  return 'source';
}

/** Name the external module a bare import or include refers to. */
const STANDARD = new Set(['assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'crypto', 'dns', 'events', 'fs', 'fs/promises', 'http', 'http2', 'https', 'net', 'os', 'path', 'perf_hooks', 'process', 'querystring', 'readline', 'stream', 'string_decoder', 'timers', 'tls', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib', 'os', 'sys', 're', 'json', 'typing', 'collections', 'itertools', 'functools', 'pathlib', 'subprocess', 'logging', 'datetime', 'time', 'math', 'random', 'dataclasses', 'abc', 'enum', 'io', 'argparse', 'unittest', 'algorithm', 'array', 'vector', 'string', 'map', 'set', 'memory', 'utility', 'functional', 'cmath', 'cstdint', 'cstdio', 'cstdlib', 'cstring', 'iostream', 'sstream', 'fstream', 'chrono', 'thread', 'mutex', 'atomic', 'optional', 'tuple', 'limits', 'numeric', 'stdio.h', 'stdlib.h', 'string.h', 'stdint.h', 'stdbool.h', 'stddef.h', 'math.h', 'stdarg.h', 'limits.h', 'time.h', 'ctype.h', 'assert.h', 'errno.h']); // Language standard libraries add noise, not architecture.
function externalName(reference) {
  const specifier = reference.specifier;
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/')) return null;
  if (specifier.startsWith('node:') || STANDARD.has(specifier) || STANDARD.has(specifier.split('/')[0]) && reference.kind !== 'include') return null; // Skip standard-library modules.
  if (reference.kind === 'include') return specifier;
  if (reference.kind === 'python') return specifier.split('.')[0];
  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
}

/** External modules actually imported, most used first, with the files that import them. */
export function externalModules(external) {
  const modules = new Map();
  for (const reference of external) { const name = externalName(reference); if (!name) continue; if (!modules.has(name)) modules.set(name, { name, total: 0, paths: [] }); const item = modules.get(name); item.total++; if (!item.paths.includes(reference.from) && item.paths.length < 12) item.paths.push(reference.from); }
  return [...modules.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/**
 * Build the component-level overview for the analyzed scope.
 * Components come from the file tree; relationships only from located imports/includes.
 */
export function buildOverview(snapshot, files, edges, external = [], { maxComponents = 14 } = {}) {
  const scope = snapshot.scope || '';
  const relative = file => (scope ? file.slice(scope.length + 1) : file);
  const blobs = snapshot.entries.filter(entry => entry.type === 'blob' || entry.type === 'commit');
  const readSet = new Set(files.map(file => file.path));
  const buckets = new Map();
  for (const entry of blobs) {
    const rel = relative(entry.path); const top = rel.includes('/') ? rel.split('/')[0] : '.';
    if (!buckets.has(top)) buckets.set(top, []);
    buckets.get(top).push(entry.path);
  }
  const manifests = blobs.filter(entry => MANIFEST.test(entry.path)).map(entry => path.posix.dirname(entry.path));
  const components = [...buckets].map(([name, members]) => {
    const folder = name === '.' ? scope : [scope, name].filter(Boolean).join('/');
    const projects = name === '.' ? 0 : new Set(manifests.filter(dir => dir !== folder && dir.startsWith(folder + '/')).map(dir => dir.slice(folder.length + 1).split('/')[0])).size;
    const container = projects >= 2;
    const kind = name === '.' ? (members.some(member => /(^|\/)(main|app|server|cli|index)\.[a-z]+$/i.test(member) && !member.slice(scope.length).includes('/', 1)) ? 'entry' : 'config') : componentKind(name, members, container);
    const read = members.filter(member => readSet.has(member)).length;
    const detail = [`${members.length} file${members.length === 1 ? '' : 's'}`, read ? `${read} read` : 'not read', container ? `${projects} projects` : ''].filter(Boolean).join(' · ');
    const label = name === '.' ? 'Top-level files' : name; // Files directly inside the analyzed folder.
    return { name, folder, members, read, kind, container, projects, label, detail };
  });
  components.sort((a, b) => (a.name === '.' ? -1 : b.name === '.' ? 1 : 0) || b.read - a.read || b.members.length - a.members.length || a.name.localeCompare(b.name));
  const shown = components.slice(0, maxComponents); const hidden = components.slice(maxComponents);
  const componentOf = file => shown.find(component => (component.name === '.' ? !relative(file).includes('/') : relative(file).startsWith(component.name + '/')));
  const idOf = component => `c_${shown.indexOf(component)}`;
  const nodes = shown.map(component => ({ id: idOf(component), label: component.label, detail: component.detail, kind: component.kind, path: component.name === '.' ? '.' : component.folder, basis: 'observed' }));
  if (hidden.length) nodes.push({ id: 'c_more', label: `${hidden.length} more folders`, detail: `${hidden.reduce((sum, item) => sum + item.members.length, 0)} files · see the tree`, kind: 'source', path: '.', basis: 'observed' });
  const pairs = new Map();
  for (const edge of edges) {
    const from = componentOf(edge.from); const to = componentOf(edge.to);
    if (!from || !to || from === to) continue;
    const key = `${idOf(from)}>${idOf(to)}`;
    if (!pairs.has(key)) pairs.set(key, { from: idOf(from), to: idOf(to), label: edge.kind === 'include' ? 'includes' : 'imports', basis: 'observed', count: 0, evidencePath: edge.from, evidenceLine: edge.line });
    pairs.get(key).count++;
  }
  const externals = new Map();
  for (const reference of external) {
    const name = externalName(reference); const from = componentOf(reference.from);
    if (!name || !from) continue;
    if (!externals.has(name)) externals.set(name, { total: 0, from: new Map() });
    const item = externals.get(name); item.total++;
    if (!item.from.has(idOf(from))) item.from.set(idOf(from), { count: 0, path: reference.from, line: reference.line });
    item.from.get(idOf(from)).count++;
  }
  const topExternal = [...externals].sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0])).slice(0, 5);
  const groups = [];
  if (topExternal.length) groups.push({ id: 'external', label: externals.size > topExternal.length ? `External, imported · ${externals.size - topExternal.length} more` : 'External, imported' });
  topExternal.forEach(([name, item], index) => {
    nodes.push({ id: `x_${index}`, label: name, detail: `used ${item.total}×`, kind: 'external', group: 'external', basis: 'observed' });
    for (const [from, usage] of item.from) pairs.set(`${from}>x_${index}`, { from, to: `x_${index}`, label: 'uses', basis: 'observed', count: usage.count, evidencePath: usage.path, evidenceLine: usage.line });
  });
  const paths = new Set(blobs.map(entry => entry.path));
  const folders = new Set(snapshot.entries.filter(entry => entry.type === 'tree').map(entry => entry.path));
  const scopeNodes = nodes.map(node => (node.path === '.' ? { ...node, path: scope || '.' } : node)); // The scope root maps to its folder, or to the repository root.
  if (!scope) folders.add('.');
  const { graph } = validateGraph({ direction: 'TD', groups, nodes: scopeNodes, edges: [...pairs.values()] }, { paths, folders });
  graph.nodes.forEach(node => { if (node.path === '.') node.path = ''; }); // The repository root is the empty path for source links.
  const compiled = compileGraph(graph, { title: 'Component overview. Folders come from the file tree, and arrows come only from located imports or includes.' });
  return { ...compiled, components: shown.map(component => ({ name: component.name, folder: component.folder, kind: component.kind, files: component.members.length, read: component.read, projects: component.projects })), hiddenComponents: hidden.length, externalCount: externals.size };
}

/**
 * Suggest a reading order using only evidence the analyzer holds.
 * @returns {{path: string, why: string}[]}
 */
export function readingOrder(result) {
  const scope = result.repository.scope || ''; const order = []; const seen = new Set();
  const push = (file, why) => { if (file && !seen.has(file) && result.files.some(item => item.path === file)) { seen.add(file); order.push({ path: file, why }); } };
  const atRoot = file => !(scope ? file.slice(scope.length + 1) : file).includes('/');
  result.files.filter(file => /(^|\/)readme(\.[a-z]+)?$/i.test(file.path) && atRoot(file.path)).forEach(file => push(file.path, 'Explains what this scope is for, in the authors’ words.'));
  result.files.filter(file => MANIFEST.test(file.path) && atRoot(file.path)).forEach(file => push(file.path, 'Declares how the project is built and what it depends on.'));
  result.files.filter(file => /^(Declared|Built)/.test(file.reason || '')).slice(0, 3).forEach(file => push(file.path, `${file.reason}.`));
  result.entrypoints.slice(0, 2).forEach(item => push(item.path, 'Entry point candidate by filename.'));
  const inbound = new Map(); result.dependencies.forEach(edge => inbound.set(edge.to, (inbound.get(edge.to) || 0) + 1));
  [...inbound].sort((a, b) => b[1] - a[1]).slice(0, 4).forEach(([file, count]) => push(file, `Imported by ${count} of the files read — a shared building block.`));
  const diagrams = new Map(); result.documented.forEach(item => diagrams.set(item.path, (diagrams.get(item.path) || 0) + 1));
  [...diagrams].slice(0, 3).forEach(([file, count]) => push(file, `Contains ${count} authored Mermaid diagram${count > 1 ? 's' : ''}.`));
  return order.slice(0, 10);
}
