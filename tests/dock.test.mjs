// Project: Git Architecture Diagram | Tests: dock magnification curve and project packs | Author: Amine Saoud ibn al-Bashir.
import test from 'node:test'; import assert from 'node:assert/strict';
import { dockScale, dockLift, DOCK } from '../public/dock.js';
import * as knowledge from '../public/knowledge.js';

const PITCH = 67; // Center-to-center distance of dock items at desktop size.
const near = (actual, expected, tolerance = 0.02) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual.toFixed(3)} ≈ ${expected}`);

test('magnification follows the dock arch: pointer, neighbors, next neighbors, rest', () => {
  near(dockScale(0), 1.48); near(dockScale(PITCH), 1.22); near(dockScale(2 * PITCH), 1.07); near(dockScale(3 * PITCH), 1.0, 0.012); assert.equal(dockScale(DOCK.radius + 1), 1);
  assert.equal(dockScale(-PITCH), dockScale(PITCH), 'symmetric left and right');
  for (let distance = 0; distance < DOCK.radius; distance += 5) assert.ok(dockScale(distance) >= dockScale(distance + 5), 'continuous and decreasing');
});

test('icons rise in proportion to their scale', () => {
  near(dockLift(1.48), -14, 0.3); near(dockLift(1.22), -6.4, 0.3); near(dockLift(1.07), -2, 0.3); assert.equal(dockLift(1), -0);
});

test('developer and knowledge packs label verified source and Genius inference', () => {
  const result = { repository: { fullName: 'acme/shop', repo: 'shop', sha: 'a'.repeat(40), scope: '' }, generator: { version: '0.9.0' }, coverage: { readFiles: 2, listedFiles: 3 }, summary: 'A shop.', structure: 'Two folders.', diagrams: { overview: 'flowchart TD\n a-->b', conceptMindmap: 'mindmap\n root((shop))', conceptMindmapPaths: { c0: { concept: 'Architecture' } }, components: [{ name: 'src', kind: 'source', files: 2, read: 2 }] }, hierarchy: { source: { root: { label: 'acme/shop', badges: [], children: [{ label: 'Core logic', badges: ['CORE'], children: [] }] } } }, files: [{ path: 'src/a.js', reason: 'Ranked by path' }], readingOrder: [{ path: 'src/a.js', why: 'Entry.' }], entrypoints: [{ path: 'src/a.js', basis: 'filename', note: 'Entry.' }], dependencies: [{ from: 'src/a.js', to: 'src/b.js', line: 1, kind: 'import' }], externalModules: ['express'], externalUsage: { express: ['src/a.js'] }, skills: { observed: [{ category: 'Backend', name: 'Express', evidence: ['package.json'] }], recommended: [{ category: 'Security', name: 'Secrets', why: 'Always.' }], priorities: ['Backend'] }, warnings: [], documented: [], tree: 'shop/', guide: '# Guide', ai: null };
  const dev = knowledge.developerPack(result, { origin: 'https://x.test', path: '/acme/shop' });
  assert.deepEqual(Object.keys(dev).sort(), ['README.md', 'architecture.md', 'development-prompt.md', 'development-skills.md', 'evidence.json', 'implementation-roadmap.md', 'repository-mind-map.md', 'repository-tree.txt', 'software-hierarchy.md', 'system-map.md']);
  assert.match(dev['README.md'], /git clone https:\/\/github\.com\/acme\/shop\.git/); assert.match(dev['system-map.md'], /No AI system map/);
  const pack = knowledge.knowledgePack(result); const doc = pack['project-knowledge.md'];
  assert.match(doc, /## Architecture \[verified source\]/); assert.match(doc, /## System map \[Genius inference\]/); assert.match(doc, /Express \(Backend\) \[verified source: package\.json\]/); assert.match(doc, /Secrets \(Security\) \[recommendation\]/);
  assert.doesNotMatch(JSON.stringify(pack), /BEGIN|token|password/i);
});
