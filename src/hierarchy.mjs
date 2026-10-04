// Project: Git Architecture Diagram | Component: Software hierarchy, repository mind map, development skills | Author: Amine Saoud ibn al-Bashir.
// Description: Deterministic project knowledge built only from what the analyzer listed and read.
// Every node carries the repository paths it stands for, so any view can select the same thing in another view.
import path from 'node:path';
import { labelText } from './graph.mjs';
import { mindmapColor } from '../public/diagram-colors.js';

// Layers in reading order. A component lands in the first layer whose kind matches.
const LAYERS = [
  { id: 'entry', label: 'Entry points and configuration', kinds: ['entry', 'config'], badge: 'ENTRY POINT' },
  { id: 'frontend', label: 'Frontend', kinds: ['ui'], badge: 'FRONTEND' },
  { id: 'backend', label: 'Backend and services', kinds: ['service'], badge: 'BACKEND' },
  { id: 'core', label: 'Core logic', kinds: ['source'], badge: 'CORE' },
  { id: 'storage', label: 'Storage and data', kinds: ['data'], badge: 'STORAGE' },
  { id: 'hardware', label: 'Hardware, drivers, and interfaces', kinds: ['hardware'], badge: 'HARDWARE' },
  { id: 'examples', label: 'Examples and sub-projects', kinds: ['examples'], badge: 'EXAMPLES' },
  { id: 'tests', label: 'Tests', kinds: ['tests'], badge: 'TEST' },
  { id: 'build', label: 'Build, CI, and automation', kinds: ['automation'], badge: 'BUILD' },
  { id: 'docs', label: 'Documentation', kinds: ['docs'], badge: 'DOCS' },
  { id: 'assets', label: 'Assets and binaries', kinds: ['assets'], badge: 'ASSETS' },
];
const EMBEDDED_NAMES = { src: 'Application layer (src)', lib: 'Libraries (lib)', include: 'Interfaces and headers (include)', test: 'Tests (test)', hal: 'Hardware abstraction (HAL)', drivers: 'Drivers', bsp: 'Board support (BSP)' };
const MANIFEST = /(^|\/)(package\.json|platformio\.ini|pyproject\.toml|Cargo\.toml|go\.mod|CMakeLists\.txt|setup\.py|pom\.xml|build\.gradle(\.kts)?|library\.(json|properties)|requirements\.txt)$/i;

/** Classify the project so layer names read naturally (an ESP32 project has no "backend"). */
export function projectType(result) {
  const paths = result.repository.entries.map(entry => entry.path);
  const embedded = paths.some(item => /(^|\/)platformio\.ini$|\.ino$/i.test(item)) || result.externalModules?.some(name => /^(Arduino\.h|esp_|freertos|driver\/)/i.test(name));
  if (embedded) return 'embedded';
  if (result.diagrams.components?.some(item => ['ui', 'service'].includes(item.kind)) || paths.some(item => /(^|\/)(next|vite|nuxt|svelte)\.config\.|(^|\/)(pages|app|components)\//.test(item))) return 'application';
  return 'library';
}

/**
 * Build the source-derived software hierarchy.
 * @returns {{type: string, root: object}} nested nodes: {id, label, detail, kind, badges, paths, basis, children}
 */
export function buildHierarchy(result) {
  let serial = 0; const node = fields => ({ id: `h${serial++}`, badges: [], paths: [], children: [], basis: 'source', ...fields });
  const scope = result.repository.scope || '';
  const type = projectType(result);
  const read = new Set(result.files.map(file => file.path));
  const inbound = new Map(); result.dependencies.forEach(edge => inbound.set(edge.to, (inbound.get(edge.to) || 0) + 1));
  const entries = new Set(result.entrypoints.map(item => item.path));
  const declared = new Set(result.files.filter(file => /^(Declared|Built)/.test(file.reason || '')).map(file => file.path));
  const blobs = result.repository.entries.filter(entry => entry.type === 'blob');
  const fileBadges = file => [entries.has(file) ? 'ENTRY POINT' : '', declared.has(file) ? 'PUBLIC API' : '', (inbound.get(file) || 0) >= 2 ? 'CORE' : '', MANIFEST.test(file) ? 'CONFIG' : '', /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\./i.test(file) ? 'TEST' : '', /(^|\/)(dist|build|generated|gen)\//i.test(file) ? 'GENERATED' : ''].filter(Boolean);
  const fileNode = file => node({ label: path.posix.basename(file), detail: (inbound.get(file) ? `imported by ${inbound.get(file)} file${inbound.get(file) > 1 ? 's' : ''}` : '') || (read.has(file) ? 'read' : 'listed, not read'), kind: 'file', badges: fileBadges(file), paths: [file] });
  const rank = (a, b) => Number(entries.has(b)) - Number(entries.has(a)) || (inbound.get(b) || 0) - (inbound.get(a) || 0) || Number(read.has(b)) - Number(read.has(a)) || a.localeCompare(b);
  const filesUnder = folder => blobs.filter(entry => (folder ? entry.path.startsWith(folder + '/') : !entry.path.slice(scope ? scope.length + 1 : 0).includes('/'))).map(entry => entry.path);
  const componentNode = component => {
    const folder = component.name === '.' ? scope : component.folder;
    const label = type === 'embedded' && EMBEDDED_NAMES[component.name] ? EMBEDDED_NAMES[component.name] : component.name === '.' ? 'Top-level files' : component.name;
    const all = component.name === '.' ? filesUnder('') : filesUnder(folder);
    const item = node({ label, detail: `${component.files} file${component.files === 1 ? '' : 's'}, ${component.read} read${component.projects ? `, ${component.projects} projects` : ''}`, kind: component.kind, paths: [folder || '.'] });
    const layer = LAYERS.find(entry => entry.kinds.includes(component.kind)); if (layer) item.badges.push(layer.badge);
    if (all.some(file => entries.has(file))) item.badges.push('CRITICAL');
    if (/(^|\/)(dist|build|generated|gen|vendor)$/i.test(folder)) item.badges.push('GENERATED');
    const sub = new Map(); // Group by the next folder level so monorepos stay navigable.
    for (const file of all) { const rest = file.slice(folder ? folder.length + 1 : 0); const head = component.name !== '.' && rest.includes('/') ? rest.split('/')[0] : ''; if (!sub.has(head)) sub.set(head, []); sub.get(head).push(file); }
    const loose = (sub.get('') || []).sort(rank);
    loose.slice(0, 8).forEach(file => item.children.push(fileNode(file)));
    if (loose.length > 8) item.children.push(node({ label: `${loose.length - 8} more files`, kind: 'more', paths: [folder || '.'] }));
    [...sub].filter(([head]) => head).sort((a, b) => b[1].filter(file => read.has(file)).length - a[1].filter(file => read.has(file)).length || b[1].length - a[1].length).slice(0, 10).forEach(([head, members]) => {
      const subfolder = [folder, head].filter(Boolean).join('/'); const group = node({ label: head, detail: `${members.length} files, ${members.filter(file => read.has(file)).length} read`, kind: 'folder', paths: [subfolder] });
      const ranked = members.sort(rank); ranked.slice(0, 6).forEach(file => group.children.push(fileNode(file)));
      if (ranked.length > 6) group.children.push(node({ label: `${ranked.length - 6} more files`, kind: 'more', paths: [subfolder] }));
      item.children.push(group);
    });
    return item;
  };
  const root = node({ label: result.repository.fullName + (scope ? ` / ${scope}` : ''), detail: { embedded: 'Embedded / firmware project', application: 'Application', library: 'Library or toolkit' }[type], kind: 'root', paths: [scope || '.'] });
  const components = result.diagrams.components || [];
  for (const layer of LAYERS) {
    const members = components.filter(item => layer.kinds.includes(item.kind));
    if (!members.length) continue;
    const label = type === 'embedded' && layer.id === 'core' ? 'Application and firmware logic' : layer.label;
    const group = node({ label, kind: `layer-${layer.id}`, badges: [layer.badge], paths: members.map(item => (item.name === '.' ? scope || '.' : item.folder)) });
    members.forEach(item => group.children.push(componentNode(item)));
    group.detail = `${members.length} component${members.length > 1 ? 's' : ''}`;
    root.children.push(group);
  }
  const externals = result.externalModules || [];
  if (externals.length) { const group = node({ label: 'Integrations and dependencies', kind: 'layer-external', badges: ['EXTERNAL'], detail: `${externals.length} imported module${externals.length > 1 ? 's' : ''}` }); externals.slice(0, 12).forEach(name => group.children.push(node({ label: name, kind: 'external', badges: ['EXTERNAL'], detail: 'imported, not in this repository' }))); root.children.push(group); }
  return { type, root, nodeCount: serial };
}

/** Turn a validated AI graph into a hierarchy labeled as Genius interpretation. */
export function buildGeniusHierarchy(graph, repository) {
  if (!graph?.nodes?.length) return null;
  let serial = 0; const node = fields => ({ id: `g${serial++}`, badges: [], paths: [], children: [], basis: 'genius', ...fields });
  const badge = { actor: 'ACTOR', external: 'EXTERNAL', entry: 'ENTRY POINT', ui: 'FRONTEND', service: 'BACKEND', data: 'STORAGE', hardware: 'HARDWARE', config: 'CONFIG', tests: 'TEST', docs: 'DOCS', concept: 'UNMAPPED' };
  const leaf = item => node({ label: item.label, detail: item.detail, kind: item.kind, badges: [badge[item.kind] || 'COMPONENT'], paths: item.path ? [item.path] : [] });
  const root = node({ label: repository.fullName, detail: 'Genius interpretation, validated against the commit', kind: 'root' });
  const actors = graph.nodes.filter(item => item.kind === 'actor');
  if (actors.length) { const group = node({ label: 'Who uses it', kind: 'layer-actor', badges: ['ACTOR'] }); actors.forEach(item => group.children.push(leaf(item))); root.children.push(group); }
  for (const group of graph.groups) { const members = graph.nodes.filter(item => item.group === group.id && item.kind !== 'actor'); if (!members.length) continue; const branch = node({ label: group.label, kind: 'layer-group', paths: members.map(item => item.path).filter(Boolean) }); members.forEach(item => branch.children.push(leaf(item))); root.children.push(branch); }
  const loose = graph.nodes.filter(item => !item.group && item.kind !== 'actor');
  if (loose.length) { const branch = node({ label: 'Other components and systems', kind: 'layer-group' }); loose.forEach(item => branch.children.push(leaf(item))); root.children.push(branch); }
  return { type: 'genius', root, nodeCount: serial };
}

/** Feature bullets the authors wrote under a Features-like heading in the README. */
export function documentedFeatures(result) {
  const readme = result.files.find(file => /(^|\/)readme(\.md)?$/i.test(file.path) && !path.posix.dirname(file.path).slice((result.repository.scope || '').length).includes('/'));
  if (!readme) return [];
  const lines = readme.content.split('\n'); const features = [];
  let inside = false;
  lines.forEach((line, index) => {
    if (/^#{1,4}\s/.test(line)) { inside = /features|capabilities|what (it|this) (does|can)|highlights/i.test(line); return; }
    const bullet = inside && line.match(/^\s*[-*]\s+(?:\*\*)?([^*:.\n]{3,60})/);
    if (bullet && features.length < 8) features.push({ label: bullet[1].replace(/[`[\]]/g, '').trim(), path: readme.path, line: index + 1 });
  });
  return features;
}

/** A concept mind map: architecture, features, entry points, infrastructure, dependencies, docs, tests. */
export function buildConceptMindmap(result, hierarchy) {
  const lines = ['mindmap', `  root(("${labelText(result.repository.repo, 40)}"))`, '  :::gad-root'];
  const paths = { root: { path: result.repository.scope || '', type: 'tree', paths: [result.repository.scope || '.'], concept: result.repository.repo } };
  const legend = []; let branch = 0; let serial = 0;
  const blobs = result.repository.entries.filter(entry => entry.type === 'blob').map(entry => entry.path);
  const add = (title, children) => {
    if (!children.length) return; const id = `c${serial++}`; const all = children.flatMap(child => child.paths);
    lines.push(`    ${id}["${labelText(title, 40)}"]`, `    :::gad-${id}`); paths[id] = { path: all[0] || '', type: all.length === 1 && blobs.includes(all[0]) ? 'blob' : 'tree', paths: all, concept: title };
    children.slice(0, 7).forEach(child => { const childId = `c${serial++}`; lines.push(`      ${childId}["${labelText(child.label, 44)}"]`, `      :::gad-${childId}`); if (child.paths.length) paths[childId] = { path: child.paths[0], type: child.paths.length === 1 && blobs.includes(child.paths[0]) ? 'blob' : 'tree', paths: child.paths, concept: child.label, line: child.line }; });
    if (children.length > 7) lines.push(`      c${serial++}["${children.length - 7} more"]`);
    legend.push({ label: title, count: children.length, stroke: mindmapColor(branch++) });
  };
  add('Architecture', hierarchy.root.children.filter(layer => !layer.kind.endsWith('external')).map(layer => ({ label: layer.label, paths: layer.paths })));
  add('README features', documentedFeatures(result).map(item => ({ label: item.label, paths: [item.path], line: item.line })));
  add('Entry points', result.entrypoints.slice(0, 6).map(item => ({ label: path.posix.basename(item.path), paths: [item.path] })));
  const infra = [[/(^|\/)\.github\/workflows\//, 'CI workflows'], [/(^|\/)(Dockerfile|docker-compose\.ya?ml|compose\.ya?ml)$/, 'Containers'], [/(^|\/)(wrangler\.(json|toml)|vercel\.json|netlify\.toml|fly\.toml|Procfile|railway\.json)$/, 'Deployment'], [/(^|\/)(platformio\.ini|Makefile|CMakeLists\.txt|package\.json|pyproject\.toml|Cargo\.toml|go\.mod)$/, 'Build system'], [/(^|\/)\.(githooks|husky)\//, 'Git hooks']].map(([test, label]) => ({ label, paths: blobs.filter(item => test.test(item)).slice(0, 20) })).filter(item => item.paths.length);
  add('Infrastructure', infra);
  add('Imported dependencies', (result.externalModules || []).slice(0, 8).map(name => ({ label: name, paths: result.externalUsage?.[name] || [] })));
  const docs = blobs.filter(item => /\.(md|mdx|rst)$/i.test(item) && !/(^|\/)(node_modules|vendor)\//.test(item));
  add('Documentation', [...docs.filter(item => /readme/i.test(item)).slice(0, 2), ...docs.filter(item => /(^|\/)docs?\//i.test(item)).slice(0, 5)].map(item => ({ label: path.posix.basename(item), paths: [item] })));
  add('Tests', (result.diagrams.components || []).filter(item => item.kind === 'tests').map(item => ({ label: item.name, paths: [item.folder] })));
  return { mermaid: lines.join('\n'), paths, legend };
}

// ——— Development skills: observed from manifests, imports, and files; recommendations kept separate ———
const PACKAGE_SKILLS = { react: ['Frontend', 'React'], 'react-dom': ['Frontend', 'React'], next: ['Frontend', 'Next.js'], vue: ['Frontend', 'Vue'], svelte: ['Frontend', 'Svelte'], '@angular/core': ['Frontend', 'Angular'], tailwindcss: ['Frontend', 'Tailwind CSS'], vite: ['Build', 'Vite'], webpack: ['Build', 'webpack'], typescript: ['Languages', 'TypeScript'], express: ['Backend', 'Express (Node.js HTTP)'], fastify: ['Backend', 'Fastify'], koa: ['Backend', 'Koa'], hono: ['Backend', 'Hono'], '@nestjs/core': ['Backend', 'NestJS'], graphql: ['API', 'GraphQL'], 'socket.io': ['API', 'WebSockets (Socket.IO)'], prisma: ['Database', 'Prisma ORM'], '@prisma/client': ['Database', 'Prisma ORM'], pg: ['Database', 'PostgreSQL'], mysql2: ['Database', 'MySQL'], mongoose: ['Database', 'MongoDB (Mongoose)'], redis: ['Database', 'Redis'], ioredis: ['Database', 'Redis'], jest: ['Testing', 'Jest'], vitest: ['Testing', 'Vitest'], mocha: ['Testing', 'Mocha'], playwright: ['Testing', 'Playwright browser testing'], '@playwright/test': ['Testing', 'Playwright browser testing'], cypress: ['Testing', 'Cypress'], mermaid: ['Frontend', 'Mermaid diagrams'], dompurify: ['Security', 'HTML sanitization (DOMPurify)'], openai: ['AI / ML', 'OpenAI API'], '@anthropic-ai/sdk': ['AI / ML', 'Claude API'], electron: ['Frontend', 'Electron desktop apps'], esbuild: ['Build', 'esbuild'], wrangler: ['DevOps', 'Cloudflare Workers'], django: ['Backend', 'Django'], flask: ['Backend', 'Flask'], fastapi: ['Backend', 'FastAPI'], numpy: ['AI / ML', 'NumPy'], pandas: ['AI / ML', 'pandas'], torch: ['AI / ML', 'PyTorch'], tensorflow: ['AI / ML', 'TensorFlow'], pytest: ['Testing', 'pytest'] };
const IMPORT_SKILLS = [[/^Arduino\.h$/, 'Embedded', 'Arduino framework'], [/^WiFi\.h$|^esp_wifi/, 'Embedded', 'Wi-Fi networking on microcontrollers'], [/^Wire\.h$/, 'Embedded', 'I²C bus'], [/^SPI\.h$/, 'Embedded', 'SPI bus'], [/^BLE|^NimBLE/, 'Embedded', 'Bluetooth Low Energy'], [/^freertos|FreeRTOS/i, 'Embedded', 'FreeRTOS tasks and timing'], [/^esp_|^driver\//, 'Embedded', 'ESP-IDF APIs'], [/^(Servo|ESP32Servo)\.h$/, 'Hardware', 'Servo control (PWM)'], [/^react$/, 'Frontend', 'React'], [/^express$/, 'Backend', 'Express (Node.js HTTP)'], [/^mermaid$/, 'Frontend', 'Mermaid diagrams']];
const FILE_SKILLS = [[/\.(ts|tsx)$/, 'Languages', 'TypeScript'], [/\.(js|mjs|cjs|jsx)$/, 'Languages', 'JavaScript'], [/\.py$/, 'Languages', 'Python'], [/\.(c|h)$/, 'Languages', 'C'], [/\.(cpp|hpp|cc|ino)$/, 'Languages', 'C++'], [/\.go$/, 'Languages', 'Go'], [/\.rs$/, 'Languages', 'Rust'], [/\.(java|kt)$/, 'Languages', 'Java / Kotlin'], [/\.cs$/, 'Languages', 'C#'], [/\.css$/, 'Frontend', 'CSS layout and theming'], [/\.html$/, 'Frontend', 'HTML and accessibility'], [/\.sql$/, 'Database', 'SQL'], [/(^|\/)Dockerfile$/, 'DevOps', 'Docker containers'], [/(^|\/)\.github\/workflows\//, 'DevOps', 'GitHub Actions CI'], [/(^|\/)(wrangler\.(json|toml))$/, 'DevOps', 'Cloudflare Workers'], [/(^|\/)vercel\.json$/, 'DevOps', 'Vercel deployment'], [/(^|\/)platformio\.ini$/, 'Embedded', 'PlatformIO build system'], [/(^|\/)CMakeLists\.txt$/, 'Build', 'CMake'], [/(^|\/)Makefile$/, 'Build', 'Make'], [/\.inf$/, 'Hardware', 'Windows driver packages (INF)'], [/\.(kicad_\w+|IntLib|SchDoc|PcbDoc)$/i, 'Hardware', 'PCB design files'], [/\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)tests?\//, 'Testing', 'Automated tests'], [/\.mmd$/, 'Documentation', 'Mermaid diagrams']];
const RECOMMEND = { Frontend: [['Accessibility (WCAG) and keyboard support', 'A user interface is present.'], ['Responsive layout', 'A user interface is present.']], Backend: [['HTTP API design and input validation', 'Server code is present.'], ['Authentication and secrets handling', 'Server code usually handles credentials.']], API: [['API versioning and error contracts', 'An API layer is present.']], Database: [['Schema design and migrations', 'A database client is present.']], Embedded: [['Reading datasheets and pinouts', 'Firmware drives real hardware.'], ['Logic levels and electrical safety (3.3 V / 5 V)', 'Microcontroller I/O is used.'], ['Serial-monitor debugging', 'Embedded projects are debugged over UART.']], Hardware: [['Driver signing and installation on Windows', 'Driver packages are present.']], DevOps: [['Release automation and rollback', 'Deployment or CI files are present.']], Testing: [['Writing focused regression tests', 'Tests are present.']], 'AI / ML': [['Prompt and cost limits for model calls', 'A model API is used.']] };

/** Extract development skills with evidence. Observed skills cite files; recommended skills say why. */
export function extractSkills(result) {
  const observed = new Map(); const add = (category, name, evidence) => { const key = `${category}|${name}`; if (!observed.has(key)) observed.set(key, { category, name, evidence: [] }); const item = observed.get(key); if (evidence && !item.evidence.includes(evidence) && item.evidence.length < 3) item.evidence.push(evidence); };
  for (const entry of result.repository.entries.filter(item => item.type === 'blob')) for (const [test, category, name] of FILE_SKILLS) if (test.test(entry.path)) add(category, name, entry.path);
  for (const file of result.files) {
    if (/(^|\/)package\.json$/.test(file.path)) { let manifest; try { manifest = JSON.parse(file.content); } catch { manifest = null; } for (const name of Object.keys({ ...(manifest?.dependencies || {}), ...(manifest?.devDependencies || {}) })) if (PACKAGE_SKILLS[name]) add(...PACKAGE_SKILLS[name], file.path); }
    if (/(^|\/)(requirements\.txt|pyproject\.toml)$/.test(file.path)) for (const name of Object.keys(PACKAGE_SKILLS)) if (new RegExp(`(^|[\\s"'])${name.replace(/[.*+?^${}()|[\]\\/@]/g, '\\$&')}([\\s"'=<>~!]|$)`, 'mi').test(file.content)) add(...PACKAGE_SKILLS[name], file.path);
    if (/(^|\/)platformio\.ini$/.test(file.path)) { const framework = file.content.match(/^\s*framework\s*=\s*(\S+)/m)?.[1]; const platform = file.content.match(/^\s*platform\s*=\s*(\S+)/m)?.[1]; if (framework) add('Embedded', framework === 'espidf' ? 'ESP-IDF framework' : `${framework[0].toUpperCase()}${framework.slice(1)} framework`, file.path); if (/espressif32/.test(platform || '')) add('Hardware', 'ESP32 microcontrollers', file.path); }
  }
  for (const [name, usedIn] of Object.entries(result.externalUsage || {})) for (const [test, category, skill] of IMPORT_SKILLS) if (test.test(name)) add(category, skill, usedIn[0]);
  if (result.documented.length) add('Documentation', 'Mermaid diagrams', result.documented[0].path);
  const list = [...observed.values()].sort((a, b) => a.category.localeCompare(b.category) || b.evidence.length - a.evidence.length || a.name.localeCompare(b.name));
  const categories = [...new Set(list.map(item => item.category))];
  const modulesFor = category => [...new Set(list.filter(item => item.category === category).flatMap(item => item.evidence).map(path => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : path)))].slice(0, 3); // Folders (or root files) where the category was observed.
  const recommended = categories.flatMap(category => (RECOMMEND[category] || []).map(([name, why]) => ({ category, name, why, relatedModules: modulesFor(category), confidence: 'medium' })));
  recommended.push({ category: 'Security', name: 'Keeping credentials out of source control', why: 'Applies to every project.', relatedModules: [], confidence: 'high' });
  const weight = category => list.filter(item => item.category === category).reduce((sum, item) => sum + item.evidence.length, 0);
  return { observed: list, recommended, priorities: categories.sort((a, b) => weight(b) - weight(a)).slice(0, 6) };
}
