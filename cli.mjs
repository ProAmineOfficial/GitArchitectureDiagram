// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-PROVENANCE-CORE-001
// Project: Git Architecture Diagram | Component: CLI | Author: Amine Saoud ibn al-Bashir.
import { mkdir, writeFile } from 'node:fs/promises'; // Write real Genius artifacts after successful analysis.
import path from 'node:path'; // Resolve a user-selected output directory.
import { runAnalysis } from './src/service.mjs'; // Reuse the same analyzer as the web interface.
const args = process.argv.slice(2); const value = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined; // Read the documented command-line options.
if (!args[0] || args.includes('--help')) { console.log('Usage: npm run analyze -- OWNER/REPO [--ref main] [--scope src] [--max-files 32] [--output .genius] [--ai]'); process.exit(args.includes('--help') ? 0 : 1); } // Explain CLI usage without guessing a target.
try { // Produce artifacts only after a real source analysis completes.
  const result = await runAnalysis({ repository: args[0], ref: value('--ref'), scope: value('--scope'), maxFiles: Number(value('--max-files') || 32), githubToken: process.env.GITHUB_TOKEN || '', ai: args.includes('--ai') }, { allowEnvAI: true, signal: AbortSignal.timeout(180000), progress: event => process.stderr.write(`${event.stage}: ${event.detail}\n`) }); // Analyze with optional local credentials and a bounded deadline.
  const directory = path.resolve(value('--output') || '.genius'); await mkdir(directory, { recursive: true }); // Create the selected output directory after analysis succeeds.
  const exports = { 'README.md': result.guide, 'tree.txt': result.tree, 'architecture.mmd': result.diagrams.architecture, 'mindmap.mmd': result.diagrams.mindmap, 'evidence.json': JSON.stringify({ generator: result.generator, repository: result.repository.fullName, commit: result.repository.sha, scope: result.repository.scope, generatedAt: result.generatedAt, inputs: result.files.map(({ path, sha, size }) => ({ path, sha, size })), dependencies: result.dependencies, unresolved: result.unresolved, coverage: result.coverage, documented: result.documented, ai: result.ai, warnings: result.warnings }, null, 2) }; // Include input identities, source evidence, and explicit coverage in every artifact set.
  result.documented.forEach((item, index) => { exports[`documented/diagram-${index + 1}.mmd`] = `%% Source: ${item.path.replace(/[\r\n]/g, ' ')}:${item.line}\n${item.source}`; }); // Preserve actual author-written diagrams alongside the generated architecture.
  for (const [name, content] of Object.entries(exports)) { await mkdir(path.dirname(path.join(directory, name)), { recursive: true }); await writeFile(path.join(directory, name), content + '\n'); } // Save the complete guide bundle, including nested documented diagrams.
  console.log(`Generated ${Object.keys(exports).length} Genius artifacts in ${directory}`); // Report the actual successful output location.
} catch (error) { console.error(error.message); process.exitCode = 1; } // Return an actionable failure status without a raw credential-bearing stack.
