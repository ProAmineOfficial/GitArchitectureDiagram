// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-ENGINEERING-001
// Project: Git Architecture Diagram | Component: Make Any Product with Genius AI: the composer (Workspace › Start) and
// the engine runs (clarify, design, regenerate, re-validate).
// Idea → questions → project, which then opens in the same workspace as a repository (public/project-workspace.js).
// Projects live only in this tab and in files the visitor exports; the server never saves them. Generation needs the
// visitor's own AI key and an operational Genius Engineering Engine; the prepared example opens only on request.
import { SOURCE_LABEL, checkProjectShape } from './engineering.js';
import { readAnalysisResponse } from './analysis-stream.js';

const EXAMPLE_URL = '/assets/engineering/example-esp32.json';
export const IDEA_TITLE = 'Start from an Idea with Genius AI | Git Architecture Diagram'; // Same title as src/seo.mjs.

/** Create an element with an optional class and text. */
function el(tag, className = '', text = '') { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; }
function tableOf(headers, rows) {
  const table = el('table', 'idea-table'); const head = table.createTHead().insertRow();
  for (const header of headers) head.append(el('th', '', header));
  const body = table.createTBody();
  for (const row of rows) { const tr = body.insertRow(); for (const value of row) { const td = tr.insertCell(); if (value instanceof Node) td.append(value); else td.textContent = value ?? ''; } }
  const wrap = el('div', 'idea-table-wrap'); wrap.append(table); return wrap;
}

// Configured is not the same as working: the server makes an authenticated readiness check and reports one state.
const RUNNABLE = new Set(['operational', 'unverified']);
export const STATUS_TEXT = {
  operational: 'Genius Engineering Engine: connected and authorized. Generation uses the AI key in API settings.',
  unverified: 'Genius Engineering Engine: configured. This engine version cannot confirm authorization yet.',
  not_configured: 'Genius Engineering Engine: not set up on this site yet. You can open the example project.',
  unreachable: 'Genius Engineering Engine: configured, but not reachable right now.',
  unauthorized: 'Genius Engineering Engine: configured, but this site\'s server is not authorized. This is a site setting, not your AI key.',
  unavailable: 'Genius Engineering Engine: configured, but temporarily unavailable.',
  unknown: 'Genius Engineering Engine: status unknown. Check your connection and reload.',
};

/**
 * Wire the composer. `onProject(project, origin)` opens a project in the workspace (origin: generated, example, imported).
 * `credentials()` returns { apiKey, model, provider } from API settings (memory only).
 */
export function setupIdeaComposer({ credentials, aiConfigured, toast, openSettings, onProject }) {
  const $ = selector => document.querySelector(selector);
  if (!$('#workspace-start')) return null;
  const state = { draft: null, engine: 'unknown', busy: false, controller: null };

  /** The composer's status line: progress text, or an error with actions such as Retry. Never clears the idea text. */
  const composerLine = (text, error = false, actions = []) => {
    const line = $('#idea-progress'); line.hidden = !text; line.replaceChildren(); line.classList.toggle('error', error);
    if (!text) return;
    line.append(el('span', 'idea-progress-text', text));
    for (const [label, action] of actions) { const button = el('button', 'quiet-button idea-progress-action', label); button.type = 'button'; button.addEventListener('click', action); line.append(button); }
  };
  const setBusy = busy => { state.busy = busy; for (const id of ['#idea-run', '#idea-design', '#idea-skip', '#idea-example']) if ($(id)) $(id).disabled = busy; };

  async function refreshStatus() {
    try { const response = await fetch('/api/engineering/status'); const body = response.ok ? await response.json() : {}; state.engine = typeof body.state === 'string' && STATUS_TEXT[body.state] ? body.state : body.connected ? 'operational' : 'unknown'; } catch { state.engine = 'unknown'; }
    const line = $('#idea-engine'); line.textContent = STATUS_TEXT[state.engine]; line.dataset.state = state.engine;
    line.classList.toggle('connected', state.engine === 'operational');
    return state.engine;
  }

  /**
   * Run one engineering stage on the server (which calls the private engine and the provider with this tab's key).
   * `report(text, error, actions)` shows progress where the action started: the composer or the file inspector.
   */
  async function runStage(body, label, retry, report = composerLine) {
    const { apiKey, model, provider } = credentials();
    if (!RUNNABLE.has(await refreshStatus())) { report(STATUS_TEXT[state.engine], true, retry && state.engine !== 'not_configured' ? [['Retry', retry]] : []); return null; } // The key is not sent while the engine cannot run.
    if (!aiConfigured()) { report('Add your AI provider key and model in API settings first.', true); openSettings(); return null; }
    state.controller?.abort(); state.controller = new AbortController(); setBusy(true); report(label);
    try {
      const response = await fetch('/api/engineering/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, provider, model, apiKey }), signal: state.controller.signal });
      const result = await readAnalysisResponse(response, event => report(`${event.stage}${event.detail ? ` · ${event.detail}` : ''}`), value => Boolean(value?.project));
      report('');
      return result;
    } catch (error) { if (error.name !== 'AbortError') report(error.message || 'The engineering run failed.', true, retry ? [['Retry', retry]] : []); return null; }
    finally { setBusy(false); }
  }

  // ——— Idea → questions → design ———
  // A run never shows any project until it succeeds: a failure keeps the idea text and offers Retry.
  async function startIdea() {
    const idea = $('#idea-text').value.trim();
    if (idea.length < 12) { composerLine('Describe your idea in at least a sentence.', true); return; }
    state.draft = null; $('#idea-questions').hidden = true;
    const result = await runStage({ stage: 'clarify', idea }, 'Genius AI is reading your idea…', startIdea);
    if (result) { state.draft = result.project; showQuestions(); }
  }
  $('#idea-form').addEventListener('submit', event => { event.preventDefault(); startIdea(); });
  function showQuestions() {
    const box = $('#idea-question-list'); box.replaceChildren();
    const questions = state.draft.questions || [];
    for (const question of questions) {
      const row = el('label', 'idea-question'); row.append(el('span', 'idea-question-text', question.question));
      if (question.why) row.append(el('small', '', question.why));
      const input = el('input'); input.dataset.question = question.id; input.placeholder = question.default ? `Default: ${question.default}` : 'Your answer'; input.maxLength = 600; row.append(input);
      box.append(row);
    }
    if (!questions.length) box.append(el('p', 'idea-muted', 'No open questions: the idea is specific enough to design.'));
    $('#idea-questions').hidden = false;
    $('#idea-requirements-preview').replaceChildren(tableOf(['ID', 'Requirement', 'Priority', 'Source'], (state.draft.requirements || []).map(item => [item.id, item.text, item.priority, SOURCE_LABEL[item.source] || item.source])));
    $('#idea-questions').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  async function design(useDefaults) {
    if (!state.draft) return;
    const answers = {};
    if (!useDefaults) for (const input of document.querySelectorAll('#idea-question-list input')) if (input.value.trim()) answers[input.dataset.question] = input.value.trim();
    const result = await runStage({ stage: 'design', project: state.draft, answers }, 'Genius AI is designing the architecture…', () => design(useDefaults));
    if (result) { state.draft = null; $('#idea-questions').hidden = true; onProject(result.project, 'generated'); }
  }
  $('#idea-design').addEventListener('click', () => design(false));
  $('#idea-skip').addEventListener('click', () => design(true));

  // ——— The example and project files ———
  async function openExample() {
    setBusy(true); composerLine('Opening the example project…');
    try { const response = await fetch(EXAMPLE_URL); if (!response.ok) throw new Error(); const project = await response.json(); composerLine(''); onProject(project, 'example'); }
    catch { composerLine('The example project could not be loaded.', true); }
    finally { setBusy(false); }
  }
  $('#idea-example').addEventListener('click', openExample);
  async function importFile(file) {
    if (!file) return;
    if (file.size > 2_500_000) { composerLine('That file is larger than 2.5 MB.', true); return; }
    let project; try { project = JSON.parse(await file.text()); } catch { composerLine('That file is not valid JSON.', true); return; }
    const problems = checkProjectShape(project);
    if (problems.length) { composerLine(`This is not a usable project file: ${problems[0]}`, true); return; }
    composerLine(''); onProject(project, 'imported'); toast('Project imported. It stays in this tab until you export it again.');
  }
  for (const id of ['#idea-import', '#workspace-open-file']) $(id)?.addEventListener('click', () => $('#idea-file').click());
  $('#idea-file').addEventListener('change', () => { const file = $('#idea-file').files[0]; $('#idea-file').value = ''; importFile(file); });

  return {
    async show() { document.title = IDEA_TITLE; await refreshStatus(); },
    refreshStatus,
    openExample,
    /** Rewrite one file with Genius AI. `onDone(project)` runs on success, also after a Retry; failures are reported. */
    async regenerate({ project, artifactId, instruction, report, onDone }) {
      const attempt = async () => { const result = await runStage({ stage: 'regenerate', project, artifactId, instruction }, 'Genius AI is rewriting the file…', attempt, report); if (result?.project) onDone(result.project); };
      await attempt();
    },
    /** Re-run the engine's code checks (no model call, no key). `onDone(project)` runs on success. */
    async revalidate({ project, report, onDone }) {
      const attempt = async () => {
        if (!RUNNABLE.has(await refreshStatus())) { report(`${STATUS_TEXT[state.engine]} Your edits are kept in this tab and in exported files.`, true); return; }
        report('Re-validating with the Genius Engineering Engine…');
        try {
          const response = await fetch('/api/engineering/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project }) });
          const body = await response.json().catch(() => ({}));
          if (!response.ok || !body.project) throw new Error(typeof body.error === 'string' ? body.error : `Validation failed (HTTP ${response.status}).`);
          report(''); onDone(body.project);
        } catch (error) { report(error.message, true, [['Retry', attempt]]); }
      };
      await attempt();
    },
  };
}
