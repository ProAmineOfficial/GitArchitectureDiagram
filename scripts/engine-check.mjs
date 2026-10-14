// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-ENGINEERING-001
// Project: Git Architecture Diagram | Component: Operator check for the Genius Engineering Engine connection.
// Usage: npm run engine:check   (reads GENIUS_ENGINE_URL and GENIUS_ENGINE_TOKEN from the environment or a local .env)
// Prints whether the engine is configured, reachable, and authorized, with the token's key id (a one-way fingerprint
// that matches the engine's start-up line when both sides hold the same token). It never prints the token.
import { describeEngineConfig, inspectEngineConfig, engineReadiness, createReadinessCache } from '../src/engineering.mjs';

const HELP = {
  operational: 'Connected and authorized. Generation can run.',
  unverified: 'Configured and reachable, but the engine is older than 0.1.1 and cannot confirm authorization. Deploy the current engine.',
  unauthorized: 'The engine refused this token. Compare this key id with the key id in the engine\'s start-up log; if they differ, set the same token on both services (Railway: deploy the change; Hostinger: restart).',
  unreachable: 'No answer from GENIUS_ENGINE_URL. Check the URL, the engine deployment, HOST=0.0.0.0 on Railway, and whether the service is sleeping.',
  unavailable: 'The engine answered with an error. Check the engine\'s logs.',
};

console.log(describeEngineConfig(process.env));
if (!inspectEngineConfig(process.env).ok) process.exit(2);
const result = await engineReadiness({ env: process.env, cache: createReadinessCache(), force: true, log: line => console.log(line) });
console.log(`state: ${result.state}${result.version ? ` (engine ${result.version})` : ''}`);
console.log(HELP[result.state] || '');
process.exit(result.state === 'operational' ? 0 : 1);
