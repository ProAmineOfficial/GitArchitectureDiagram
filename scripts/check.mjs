// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-PROVENANCE-CORE-001
// Project: Git Architecture Diagram | Component: Syntax checks | Author: Amine Saoud ibn al-Bashir.
import { readdir } from 'node:fs/promises'; // Enumerate project source without walking dependencies.
import { execFileSync } from 'node:child_process'; // Invoke Node's parser directly without shell interpolation.
const files = ['server.mjs', 'cli.mjs', 'worker.mjs', 'scripts/build.mjs', 'scripts/secret-scan.mjs', 'scripts/provenance.mjs', 'scripts/social-glyphs.mjs', ...(await readdir('src')).filter(name => name.endsWith('.mjs')).map(name => `src/${name}`), ...(await readdir('public')).filter(name => name.endsWith('.js')).map(name => `public/${name}`)]; // Collect the shipped executable source modules.
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' }); // Fail on syntax errors in either frontend or backend source.
console.log(`Syntax checked ${files.length} modules.`); // Report only checks that actually ran.
