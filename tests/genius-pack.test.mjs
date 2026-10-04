// Project: Git Architecture Diagram | Export Project 2.0: the .gitarchitecture Genius Development Pack, prompt, and skills.
import test from 'node:test'; import assert from 'node:assert/strict';
import { runAnalysis } from '../src/service.mjs'; import { githubFixture } from './fixtures.mjs';
import { runDeepGenius } from '../public/genius-core.js';
import { geniusDevelopmentPack, engineeringPrompt, skillsMarkdown, recommendedSkills } from '../public/knowledge.js';

const PACK_FILES = ['OVERVIEW.md', 'ARCHITECTURE.md', 'SYSTEM_MAP.mmd', 'SOFTWARE_HIERARCHY.md', 'SOFTWARE_HIERARCHY.mmd', 'REPOSITORY_MIND_MAP.mmd', 'CRITICAL_FILES.md', 'READING_ORDER.md', 'AUDIT_FINDINGS.md', 'VALIDATED_SOLUTIONS.md', 'DEVELOPMENT_SKILLS.md', 'DEVELOPMENT_PROMPT.md', 'APP_BLUEPRINT.md', 'IMPLEMENTATION_ROADMAP.md', 'AI_READY_CONTEXT.md', 'RECONSTRUCTION_GUIDE.md', 'PROJECT_KNOWLEDGE.json', 'EVIDENCE.json', 'manifest.json'];
const PROMPT_SECTIONS = ['Project identity', 'Project purpose', 'Architecture', 'Important files', 'Entry points', 'Core modules', 'Dependencies', 'Build system', 'Tests', 'Existing conventions', 'Constraints', 'Known verified problems', 'Validated improvement plan', 'Implementation order', 'Required skills', 'Important diagrams', 'Evidence references', 'Do not break'];

const analysis = name => runAnalysis({ repository: `acme/${name}`, maxFiles: 10, githubToken: '' }, { fetchImpl: githubFixture({ name }).fetchImpl, cachePublic: false, retainSession: false });
const model = async ({ stage, payload }) => ({ output: {
  audit: { summary: 's', findings: [{ id: 'A1', severity: 'medium', title: 'Helper result is ignored', description: 'main calls helper() without using it.', files: ['src/main.js'], evidence: [{ path: 'src/main.js', line: 3, quote: 'helper();', basis: 'observed' }], confidence: 'high', whyItMatters: 'Silent failures.', validation: 'Add a test.', category: 'reliability' }], evidenceRequests: [], limitations: [] },
  solve: { summary: 's', solutions: [{ id: 'S1', findingIds: [payload.findings?.[0]?.id || 'F1'], kind: 'fix', required: true, title: 'Check the helper result', description: 'Assign and assert it.', files: ['src/main.js'], newFiles: ['test/main.test.js'], steps: ['Assign the result'], tests: ['test/main.test.js'], migrationRisk: 'low', order: 1, compatibility: 'None.', evidence: [], confidence: 'high', response: '' }], limitations: [] },
  validate: { summary: 's', verdicts: (payload.solutions || []).map(item => ({ solutionId: item.id, verdict: 'APPROVED', reason: 'Minimal.', risk: 'low', missingValidation: '', findingIds: item.findingIds, evidence: [] })) },
  compare: { summary: 's', comparisons: [], limitations: [] },
  document: { overview: 'A demo where main calls a helper.', onboarding: 'Start at src/main.js.', flows: [{ title: 'Startup', steps: ['main imports helper'], files: ['src/main.js'] }], tour: [], architectureNotes: [], implementationNotes: [], limitations: [] },
  devpack: { essentialFiles: [{ path: 'src/main.js', why: 'Entry.' }], readingOrder: [], recommendedSkills: [{ skill: 'Node test runner', reason: 'There are no tests.', relatedModules: ['src'], confidence: 'high' }], purpose: 'Show local imports.', constraints: ['Keep ES modules'], conventions: ['ESM'], doNotBreak: ['The helper export name'], blueprint: ['One module per concern'], roadmap: [{ phase: 'Tests', tasks: ['Add node:test'] }], testStrategy: ['node:test'], configuration: [{ path: 'package.json', why: 'Module type.' }], dependencies: [], reconstruction: ['Recreate main and helper'], limitations: [] },
  synthesize: { overview: 'Genius overview.', systemFlow: [], nextActions: [], limitations: [] },
}[stage], usage: null });

test('the Genius Development Pack contains every .gitarchitecture file, with Deep Genius results and no credentials', async () => {
  const result = await analysis('pack-deep'); result.deep = await runDeepGenius({ result, callAgent: model, provider: 'deepseek', model: 'deepseek-flash' });
  const files = geniusDevelopmentPack(result, { origin: 'https://gitarchitecturediagram.com', path: '/acme/pack-deep' });
  assert.deepEqual(Object.keys(files).sort(), [...PACK_FILES].sort());
  assert.match(files['AUDIT_FINDINGS.md'], /F1 · Helper result is ignored/); assert.match(files['AUDIT_FINDINGS.md'], /verified at this commit \(`src\/main\.js:3`\)/);
  assert.match(files['VALIDATED_SOLUTIONS.md'], /S1 · Check the helper result/); assert.match(files['VALIDATED_SOLUTIONS.md'], /## Unresolved proposals/);
  assert.match(files['DEVELOPMENT_SKILLS.md'], /## Observed development skills/); assert.match(files['DEVELOPMENT_SKILLS.md'], /Node test runner.*Related modules: `src`\. Confidence: high\. Source: Deep Genius/);
  assert.match(files['OVERVIEW.md'], /git checkout a{40}/); assert.match(files['READING_ORDER.md'], /1\. `/);
  const manifest = JSON.parse(files['manifest.json']); assert.equal(manifest.deepGenius.ran, true); assert.equal(manifest.deepGenius.approvedSolutions, result.deep.solutions.filter(item => item.status === 'APPROVED').length); assert.ok(manifest.deepGenius.approvedSolutions >= 1); assert.equal(manifest.files.length, PACK_FILES.length); assert.ok(manifest.files.every(item => item.path.startsWith('.gitarchitecture/')));
  const evidence = JSON.parse(files['EVIDENCE.json']); assert.equal(evidence.genius.findings[0].evidence[0].status, 'verified'); assert.equal(evidence.genius.findings[0].evidence[0].commit, 'a'.repeat(40));
  assert.equal(Object.keys(JSON.parse(files['PROJECT_KNOWLEDGE.json']).sections).length, 20);
  const everything = Object.values(files).join('\n'); assert.ok(!/sk-[A-Za-z0-9]{8}|ghp_|github_pat_|apiKey/.test(everything));
});

test('the development prompt has every section another AI coding environment needs', async () => {
  const result = await analysis('pack-prompt'); result.deep = await runDeepGenius({ result, callAgent: model });
  const prompt = engineeringPrompt(result);
  for (const section of PROMPT_SECTIONS) assert.match(prompt, new RegExp(`^## ${section}$`, 'm'), section);
  assert.match(prompt, /F1 \[medium\] Helper result is ignored — evidence `src\/main\.js:3`/); assert.match(prompt, /S1 Check the helper result \(fix, required/); assert.match(prompt, /The helper export name \(Genius inference\)/);
  assert.ok(!/Claude Code only|OpenAI only/.test(prompt), 'not provider-specific');
});

test('without Deep Genius the pack is still complete and says what is missing; skills keep observed and recommended apart', async () => {
  const result = await analysis('pack-plain'); const files = geniusDevelopmentPack(result);
  assert.deepEqual(Object.keys(files).sort(), [...PACK_FILES].sort()); assert.match(files['AUDIT_FINDINGS.md'], /Deep Genius was not run/); assert.equal(JSON.parse(files['manifest.json']).deepGenius.ran, false);
  assert.match(files['SYSTEM_MAP.mmd'], /^%% No AI system map/);
  const skills = recommendedSkills(result); assert.ok(skills.length >= 1); assert.ok(skills.every(item => item.reason && Array.isArray(item.relatedModules) && ['high', 'medium', 'low'].includes(item.confidence)));
  const text = skillsMarkdown(result); assert.ok(text.indexOf('## Observed development skills') < text.indexOf('## Recommended development skills')); assert.match(text, /evidence: `/);
});
