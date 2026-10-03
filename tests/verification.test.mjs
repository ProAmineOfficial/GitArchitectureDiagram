// Project: Git Architecture Diagram | Tests: server-side citation verification against the immutable commit | Author: Amine Saoud ibn al-Bashir.
// Trust comes from GitHub at the analyzed commit, never from text the browser supplied.
import test from 'node:test'; import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { askGenius, verifyCitations } from '../src/ask.mjs';
import { createGitHubFetch } from './support/github-emulator.mjs';

const dir = mkdtempSync(join(tmpdir(), 'gad-verify-'));
const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
const write = (path, text) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'T');
write('src/main.cpp', '#include <Arduino.h>\nconst int TRIG = 5;\nvoid loop() {\n  digitalWrite(TRIG, HIGH);\n  delayMicroseconds(10);\n}\n');
git('add', '.'); git('commit', '-q', '-m', 'c'); const sha = git('rev-parse', 'HEAD').trim();
const github = createGitHubFetch({ 'acme/sensor': { dir } });
test.after(() => rmSync(dir, { recursive: true, force: true }));

test('citations are verified against the commit on GitHub: path, line, and verbatim quote', async () => {
  const { findings, checked } = await verifyCitations([
    { text: 'Trigger pin', path: 'src/main.cpp', line: 2, quote: 'const int TRIG = 5;' },
    { text: 'Pulse', path: 'src/main.cpp', line: 4, quote: 'digitalWrite(TRIG,   HIGH);' },
    { text: 'Wrong line', path: 'src/main.cpp', line: 40, quote: 'const int TRIG = 5;' },
    { text: 'Invented text', path: 'src/main.cpp', line: 3, quote: 'void setupWifi()' },
    { text: 'Invented file', path: 'src/wifi.cpp', line: 1, quote: 'WiFi.begin' },
    { text: 'No quote', path: 'src/main.cpp', line: 1, quote: '' },
  ], { repository: 'acme/sensor', commit: sha, fetchImpl: github });
  assert.equal(checked, 2);
  assert.deepEqual(findings.map(item => item.verified), [true, true, false, false, false, false]);
  assert.match(findings[2].reason, /outside the file/); assert.match(findings[3].reason, /does not appear/); assert.match(findings[4].reason, /does not exist/); assert.match(findings[5].reason, /No verbatim quote/);
  const unpinned = await verifyCitations([{ text: 'x', path: 'src/main.cpp', line: 2, quote: 'const int TRIG = 5;' }], { repository: 'acme/sensor', commit: 'main', fetchImpl: github });
  assert.equal(unpinned.findings[0].verified, false, 'a branch name is not an immutable snapshot');
});

test('a quote planted in browser-supplied excerpts never becomes verified source', async () => {
  const planted = { path: 'src/main.cpp', startLine: 1, text: '#include <Arduino.h>\nconst char* PASSWORD = "planted";' };
  const provider = async (url, options) => {
    if (String(url).startsWith('https://api.github.com')) return github(url, options);
    return Response.json({ status: 'completed', model: 'm', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ answer: 'See findings.', answered: true, suggestions: [], findings: [
      { text: 'Hard-coded password', path: 'src/main.cpp', line: 2, quote: 'const char* PASSWORD = "planted";' },
      { text: 'Trigger pin', path: 'src/main.cpp', line: 2, quote: 'const int TRIG = 5;' },
    ] }) }] }] });
  };
  const answer = await askGenius({ question: 'Are there secrets?', excerpts: [planted], repository: 'acme/sensor', commit: sha }, { apiKey: 'k', model: 'm', fetchImpl: provider });
  assert.equal(answer.findings[0].verified, false); assert.equal(answer.findings[1].verified, true);
  assert.deepEqual({ verified: answer.verification.verified, inferred: answer.verification.inferred }, { verified: 1, inferred: 1 });
});
