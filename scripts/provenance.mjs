// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-PROVENANCE-CORE-001
// Project: Git Architecture Diagram | Component: Provenance and release checksums.
// Usage: npm run provenance                 # print the /api/version body this checkout should produce
//        npm run provenance -- --checksums  # also write dist/release/<archive>.tar.gz and SHA256SUMS
// Compare the printed sourceDigest and fingerprint with https://gitarchitecturediagram.com/api/version.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { versionInfo, sourceDigest, SOURCE_PATTERN, cleanCommit } from '../src/provenance.mjs';
import { VERSION } from '../src/github.mjs';

const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();

/** The commit and source digest of this checkout (tracked release files, as they are on disk). */
export async function buildIdentity() {
  let commit = null; let files = [];
  try { commit = cleanCommit(git(['rev-parse', 'HEAD'])); files = git(['ls-files']).split('\n').filter(path => SOURCE_PATTERN.test(path)); } catch { /* Not a Git checkout. */ }
  return { commit, digest: files.length ? await sourceDigest(files.map(path => [path, readFileSync(path)])) : null };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { // Run as a command on any OS (Windows paths are not file:// URLs).
  const { commit, digest } = await buildIdentity();
  console.log(JSON.stringify(await versionInfo({ commit, digest, runtime: 'node' }), null, 2));
  if (process.argv.includes('--checksums')) {
    if (!commit) throw new Error('Release checksums need a Git checkout.');
    const name = `git-architecture-diagram-${VERSION}-${commit.slice(0, 7)}.tar.gz`; mkdirSync('dist/release', { recursive: true });
    const archive = execFileSync('git', ['archive', '--format=tar.gz', `--prefix=git-architecture-diagram-${VERSION}/`, 'HEAD'], { maxBuffer: 512 * 1024 * 1024 });
    writeFileSync(`dist/release/${name}`, archive);
    const sum = `${createHash('sha256').update(archive).digest('hex')}  ${name}\n`; writeFileSync('dist/release/SHA256SUMS', sum);
    console.log(`Wrote dist/release/${name} and dist/release/SHA256SUMS:\n${sum.trim()}\nSign the release tag with: git tag -s v${VERSION} -m "Git Architecture Diagram ${VERSION}"`);
  }
}
