// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-EXPORT-PACK-001
// Project: Git Architecture Diagram | Component: Project extract core (shared by server and browser) | Author: Amine Saoud ibn al-Bashir.
// Pure functions: include/exclude filters, credential and binary guards, language statistics, the directory tree,
// and the text of each section. The same rules apply whether files come from the analysis or the full archive.

export const DEFAULT_EXCLUDE = ['node_modules/', '.git/', 'dist/', 'build/', 'vendor/', '*.min.js', '*.map', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
export const SIZE_CHOICES = [10, 50, 100, 250, 500, 1000].map(kb => kb * 1000); // Bytes; 50 KB is the default.
export const estimateTokens = text => Math.ceil(String(text).length / 4); // A rule of thumb; real tokenizers differ.

const CREDENTIAL = /(^|\/)(\.env(\.[\w.-]+)?|\.npmrc|\.pypirc|\.netrc|\.git-credentials|credentials(\.json)?|secrets?\.(json|ya?ml|toml)|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|[^/]*\.(pem|key|p12|pfx|jks|keystore|asc|gpg))$/i;
const BINARY = /\.(png|jpe?g|gif|webp|bmp|ico|icns|tiff?|psd|pdf|zip|gz|tgz|bz2|xz|7z|rar|jar|war|bin|hex|elf|exe|dll|so|dylib|a|o|obj|lib|sys|cat|class|pyc|wasm|woff2?|ttf|otf|eot|mp3|mp4|m4a|wav|ogg|webm|mov|avi|stl|step|stp|f3d|glb|gltf|blend|fbx|db|sqlite3?|dat|parquet|onnx|pt|ckpt|safetensors|intlib|schlib|pcblib|schdoc|pcbdoc|kicad_pcb|gbr|drl|xlsx?|docx?|pptx?)$/i;
export const isCredentialPath = path => CREDENTIAL.test(path);
export const isBinaryPath = path => BINARY.test(path);

const LANGUAGES = [[/\.(ts|tsx|mts|cts)$/i, 'TypeScript'], [/\.(js|jsx|mjs|cjs)$/i, 'JavaScript'], [/\.py$/i, 'Python'], [/\.go$/i, 'Go'], [/\.rs$/i, 'Rust'], [/\.(c|h)$/i, 'C'], [/\.(cpp|cc|cxx|hpp|hh|ino)$/i, 'C++'], [/\.(java)$/i, 'Java'], [/\.(kt|kts)$/i, 'Kotlin'], [/\.cs$/i, 'C#'], [/\.swift$/i, 'Swift'], [/\.rb$/i, 'Ruby'], [/\.php$/i, 'PHP'], [/\.(sh|bash|zsh)$/i, 'Shell'], [/\.(ps1|bat|cmd)$/i, 'Windows script'], [/\.(html?|vue|svelte)$/i, 'HTML / templates'], [/\.(css|scss|sass|less)$/i, 'CSS'], [/\.(md|mdx|rst|txt)$/i, 'Documentation'], [/\.(mmd|mermaid)$/i, 'Mermaid'], [/\.(json|jsonc)$/i, 'JSON'], [/\.(ya?ml)$/i, 'YAML'], [/\.(toml|ini|cfg|conf|properties|inf)$/i, 'Configuration'], [/\.sql$/i, 'SQL'], [/\.(proto|graphql|gql)$/i, 'Schemas'], [/(^|\/)(Dockerfile|Makefile|CMakeLists\.txt|Procfile)$/i, 'Build files']];
export function languageOf(path) { for (const [test, name] of LANGUAGES) if (test.test(path)) return name; return 'Other text'; }

/** Convert one pattern to a matcher. "*.md" matches any file name; "src/" a folder; "docs/**\/*.md" a path from the root. */
export function patternMatcher(raw) {
  const pattern = String(raw).trim().replace(/^\.\//, ''); if (!pattern) return null;
  const folder = pattern.endsWith('/'); const body = folder ? pattern.slice(0, -1) : pattern;
  const anchored = body.startsWith('/') || body.includes('/'); const clean = body.replace(/^\/+/, '');
  const source = clean.split('**').map(part => part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')).join('.*');
  const regex = folder ? new RegExp(anchored ? `^${source}(/|$)` : `(^|/)${source}(/|$)`) : new RegExp(anchored ? `^${source}$` : `(^|/)${source}$`);
  return path => regex.test(path);
}
/** Split a comma- or line-separated pattern list. */
export const parsePatterns = text => String(text || '').split(/[\n,]+/).map(item => item.trim()).filter(Boolean).slice(0, 40);
/** Build a filter: include list (empty means everything), then exclude list. Paths are relative to the scope. */
export function compileFilter({ include = [], exclude = [] } = {}) {
  const inc = include.map(patternMatcher).filter(Boolean); const exc = exclude.map(patternMatcher).filter(Boolean);
  return path => (!inc.length || inc.some(test => test(path))) && !exc.some(test => test(path));
}

/** Language statistics, largest files, and totals for the included files. */
export function statistics(files) {
  const languages = new Map(); let bytes = 0; let lines = 0;
  for (const file of files) { const name = languageOf(file.path); if (!languages.has(name)) languages.set(name, { name, files: 0, bytes: 0, lines: 0 }); const item = languages.get(name); item.files++; item.bytes += file.size; item.lines += file.lines; bytes += file.size; lines += file.lines; }
  return { files: files.length, bytes, lines, languages: [...languages.values()].sort((a, b) => b.bytes - a.bytes), largest: [...files].sort((a, b) => b.size - a.size).slice(0, 10).map(file => ({ path: file.path, size: file.size })) };
}

/** A directory tree of the given paths, in the classic ├── style. */
export function directoryTree(rootLabel, paths) {
  const root = new Map();
  for (const path of paths) { let node = root; for (const part of path.split('/')) { if (!node.has(part)) node.set(part, new Map()); node = node.get(part); } }
  const lines = [`${rootLabel}/`];
  const walk = (node, prefix) => { const entries = [...node].sort(([a, x], [b, y]) => Number(y.size > 0) - Number(x.size > 0) || a.localeCompare(b)); entries.forEach(([name, child], index) => { const last = index === entries.length - 1; lines.push(`${prefix}${last ? '└── ' : '├── '}${name}${child.size ? '/' : ''}`); if (child.size) walk(child, prefix + (last ? '    ' : '│   ')); }); };
  walk(root, '');
  return lines.join('\n');
}

export const formatBytes = bytes => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : bytes >= 1e3 ? `${(bytes / 1e3).toFixed(1)} KB` : `${bytes} B`);
const SEPARATOR = '='.repeat(48);
/** The text of each section, for Copy, Copy all, and Download. */
export function sections(extract, important = []) {
  const stats = extract.stats; const skipped = extract.skipped;
  const summary = [`Repository: ${extract.repository}`, `Commit: ${extract.commit}`, ...(extract.scope ? [`Folder: ${extract.scope}`] : []), `Source: ${extract.source === 'archive' ? 'entire repository archive at this commit' : 'files read by the analysis'}`, `Files included: ${stats.files} of ${extract.listed} listed`, `Size: ${formatBytes(stats.bytes)}, ${stats.lines.toLocaleString('en')} lines`, `Estimated tokens (file contents): ${estimateTokens(extract.files.map(file => file.content).join('\n')).toLocaleString('en')}`, `Include: ${extract.filters.include.join(', ') || 'everything'}`, `Exclude: ${extract.filters.exclude.join(', ') || 'nothing'}`, `Largest file included: ${formatBytes(extract.filters.maxFileSize)}`].join('\n');
  const statistics = ['Languages (by size):', ...stats.languages.map(item => `  ${item.name}: ${item.files} files, ${formatBytes(item.bytes)}, ${item.lines.toLocaleString('en')} lines`), '', 'Largest files:', ...stats.largest.map(item => `  ${item.path} (${formatBytes(item.size)})`), '', 'Not included:', `  Filtered out: ${skipped.filtered}`, `  Over the size limit: ${skipped.tooLarge.length}`, `  Binary: ${skipped.binary}`, `  Possible credentials (never read): ${skipped.credentials.length}`, `  Over the total content budget: ${skipped.budget}`, `  Symbolic links: ${skipped.symlinks}`].join('\n');
  const structure = `Directory structure:\n${directoryTree(extract.repository.split('/')[1] + (extract.scope ? `/${extract.scope}` : ''), extract.files.map(file => file.path))}`;
  const importantText = important.length ? important.map(item => `${item.path} — ${item.why}`).join('\n') : 'No important files were identified for this selection.';
  const contents = extract.files.map(file => `${SEPARATOR}\nFILE: ${file.path}\n${SEPARATOR}\n${file.content}\n`).join('\n');
  return { summary, statistics, structure, important: importantText, contents };
}
export function allText(parts) { return [`SUMMARY\n${parts.summary}`, `STATISTICS\n${parts.statistics}`, parts.structure, `IMPORTANT FILES\n${parts.important}`, `FILES CONTENT\n${parts.contents}`].join('\n\n'); }
export function asMarkdown(extract, parts) {
  const fence = content => '`'.repeat(Math.max(3, ...(content.match(/`+/g) || ['']).map(run => run.length + 1)));
  return [`# Project extract: ${extract.repository}`, '', '```text', parts.summary, '```', '', '## Statistics', '', '```text', parts.statistics, '```', '', '## Directory structure', '', '```text', parts.structure, '```', '', '## Important files', '', parts.important.split('\n').map(line => `- ${line}`).join('\n'), '', '## Files', '', ...extract.files.flatMap(file => [`### ${file.path}`, '', `${fence(file.content)}${(file.path.split('.').pop() || '').toLowerCase()}`, file.content, fence(file.content), ''])].join('\n');
}
