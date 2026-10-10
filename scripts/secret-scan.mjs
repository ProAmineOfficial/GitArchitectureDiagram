// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-PROVENANCE-CORE-001
// Project: Git Architecture Diagram | Component: Secret scan for the tracked tree and, optionally, the Git history.
// Usage: npm run scan:secrets            # tracked files (run before every push; CI runs it too)
//        npm run scan:secrets -- --history  # also every added line in every commit
// Reports file, line, and credential type only. A real value is never printed. Exits 1 when anything is found.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { findSecrets } from '../public/secret-scan.js';

const FORBIDDEN_FILE = /(^|\/)(\.env(\..+)?|id_rsa|id_ed25519|credentials\.json|secrets\.json)$|\.(pem|key|p12|pfx)$/i; // Secret-bearing files must never be tracked.
const ALLOWED_FILE = /(^|\/)\.env\.example$/; // The public template with empty placeholders.
const SKIP = /^(package-lock\.json|public\/assets\/|public\/fonts\/)|\.(png|webp|jpe?g|ico|woff2?)$/; // Binary assets and the lockfile's integrity hashes.
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const allowed = line => /secret-scan:\s*allow/.test(line); // An explicit, reviewable marker for documented fixtures.

export function scanTree() {
  const findings = [];
  for (const file of git(['ls-files', '-z']).split('\0').filter(Boolean)) {
    if (FORBIDDEN_FILE.test(file) && !ALLOWED_FILE.test(file)) findings.push({ file, line: 0, type: 'secret-bearing file is tracked' });
    if (SKIP.test(file)) continue;
    let text; try { text = readFileSync(file, 'utf8'); } catch { continue; }
    const lines = text.split('\n');
    for (const hit of findSecrets(text, { ignoreSynthetic: true })) if (!allowed(lines[hit.line - 1] || '')) findings.push({ file, line: hit.line, type: hit.type });
  }
  return findings;
}

export function scanHistory() {
  const findings = []; let commit = ''; let file = '';
  for (const line of git(['log', '--all', '-p', '--no-color', '--unified=0', '--format=COMMIT %h']).split('\n')) {
    if (line.startsWith('COMMIT ')) { commit = line.slice(7); continue; }
    if (line.startsWith('+++ b/')) { file = line.slice(6); if (FORBIDDEN_FILE.test(file) && !ALLOWED_FILE.test(file)) findings.push({ commit, file, type: 'secret-bearing file was committed' }); continue; }
    if (!line.startsWith('+') || line.startsWith('+++') || SKIP.test(file) || allowed(line)) continue;
    for (const hit of findSecrets(line.slice(1), { ignoreSynthetic: true })) findings.push({ commit, file, type: hit.type });
  }
  return findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { // Run as a command on any OS (Windows paths are not file:// URLs).
  const tree = scanTree(); const history = process.argv.includes('--history') ? scanHistory() : [];
  for (const item of tree) console.log(`tree    ${item.file}${item.line ? `:${item.line}` : ''}  ${item.type}`);
  for (const item of history) console.log(`history ${item.commit} ${item.file}  ${item.type}`);
  console.log(tree.length + history.length ? `Secret scan: ${tree.length + history.length} finding(s). Do not push; rotate any real credential first.` : `Secret scan: clean (${process.argv.includes('--history') ? 'tracked files and history' : 'tracked files'}).`);
  process.exitCode = tree.length + history.length ? 1 : 0;
}
