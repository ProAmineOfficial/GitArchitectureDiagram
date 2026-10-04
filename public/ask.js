// Project: Git Architecture Diagram | Component: Ask Genius | Author: Amine Saoud ibn al-Bashir.
// Keyword search runs locally over files already read. An AI answer is sent only on an explicit click,
// with the excerpt count, size, provider, and output limit stated beforehand.
import { PROVIDERS } from './providers.js';
import { pinnedSourceURL } from './source-navigation.js';

const LIMITS = { excerpts: 12, excerptCharacters: 4000, totalCharacters: 32000, outputTokens: 3000, context: 18 }; // Must match src/ask.mjs.
const STOP = new Set(['the', 'and', 'for', 'how', 'what', 'where', 'which', 'why', 'does', 'this', 'that', 'with', 'from', 'are', 'was', 'into', 'when', 'who', 'can', 'use', 'used', 'using', 'set', 'there', 'their', 'about', 'repository', 'project', 'code', 'file', 'files']);
const $ = selector => document.querySelector(selector);
function el(tag, className, text) { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; }

/** Terms worth matching: identifiers and words of three or more characters, minus question filler. */
export function queryTerms(question) { return [...new Set((String(question).toLowerCase().match(/[\p{L}\p{N}_]{3,}/gu) || []).filter(word => !STOP.has(word)))].slice(0, 12); }

/** Rank lines in the files already read. */
export function rankLines(result, question) {
  const terms = queryTerms(question); const hits = [];
  if (!terms.length) return hits;
  for (const file of result.files) {
    const pathText = file.path.toLowerCase(); const pathScore = terms.filter(term => pathText.includes(term)).length * 0.5;
    file.content.split('\n').forEach((line, index) => { const text = line.toLowerCase(); const score = terms.filter(term => text.includes(term)).length; if (score) hits.push({ path: file.path, line: index + 1, text: line.trim().slice(0, 300), score: score + pathScore }); });
  }
  return hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path) || a.line - b.line);
}

/** Choose bounded excerpts around the best matches; fall back to the reading order. */
export function selectExcerpts(result, question) {
  const hits = rankLines(result, question); const windows = new Map();
  for (const hit of hits.slice(0, 60)) {
    const ranges = windows.get(hit.path) || []; const start = Math.max(1, hit.line - LIMITS.context); const end = hit.line + LIMITS.context;
    const overlap = ranges.find(range => start <= range.end + 2 && end >= range.start - 2);
    if (overlap) { overlap.start = Math.min(overlap.start, start); overlap.end = Math.max(overlap.end, end); } else if (ranges.length < 2) ranges.push({ start, end });
    windows.set(hit.path, ranges);
  }
  if (!windows.size) for (const item of (result.readingOrder || []).slice(0, 4)) windows.set(item.path, [{ start: 1, end: 70 }]);
  const excerpts = []; let total = 0;
  for (const [path, ranges] of windows) for (const range of ranges) {
    if (excerpts.length >= LIMITS.excerpts) break;
    const lines = result.files.find(file => file.path === path)?.content.split('\n') || [];
    let text = lines.slice(range.start - 1, Math.min(lines.length, range.end)).join('\n').slice(0, LIMITS.excerptCharacters);
    if (!text.trim() || total + text.length > LIMITS.totalCharacters) continue;
    total += text.length; excerpts.push({ path, startLine: range.start, text });
  }
  return { excerpts, characters: total, matched: hits.length };
}

export function setupAsk({ getResult, credentials, headers, aiConfigured, onInspect }) {
  let controller = null;
  const results = () => $('#search-results');
  const link = (result, path, line) => { const anchor = el('a', 'cite', `${path}:${line}`); anchor.href = pinnedSourceURL(result.repository, { path, line, type: 'blob' }); anchor.target = '_blank'; anchor.rel = 'noreferrer'; anchor.addEventListener('click', event => { if (event.metaKey || event.ctrlKey) return; event.preventDefault(); onInspect(path, line); }); return anchor; };
  function refresh() {
    const provider = PROVIDERS[credentials().provider]; const ai = aiConfigured();
    $('#ask-ai').hidden = !ai; $('#ask-ai').textContent = `Ask ${provider.name}`;
    const result = getResult();
    $('#ask-disclosure').textContent = ai ? `Search sources is free and local. Ask ${provider.name} sends your question and up to ${LIMITS.excerpts} excerpts (at most ${LIMITS.totalCharacters.toLocaleString('en')} characters) from the files read, allows up to ${LIMITS.outputTokens.toLocaleString('en')} output tokens, and bills your key.` : `Searches the ${result ? result.files.length : ''} files read, word for word. Add an API key and model in API settings to ask a model instead.`;
  }
  function showSearch() {
    const result = getResult(); if (!result) return; const question = $('#question').value; const hits = rankLines(result, question).slice(0, 10);
    const panel = results(); panel.replaceChildren(el('p', 'mode-note', `Keyword search, no AI. ${hits.length ? `Best ${hits.length} matching lines in the files read.` : 'No matching lines in the files read.'}`));
    if (!hits.length) panel.append(el('p', 'subtle', 'Try an identifier from the code, or analyze a narrower folder so more of it is read.'));
    for (const hit of hits) { const row = el('div', 'search-result'); row.append(link(result, hit.path, hit.line), el('code', '', hit.text)); panel.append(row); }
  }
  async function askAI() {
    const result = getResult(); if (!result || !$('#question').reportValidity()) return;
    const { excerpts, characters, matched } = selectExcerpts(result, $('#question').value);
    const panel = results(); const { provider, apiKey, model } = credentials(); const name = PROVIDERS[provider].name;
    if (!excerpts.length) { panel.replaceChildren(el('p', 'subtle', 'No readable excerpts to send. Analyze with a larger file budget first.')); return; }
    controller?.abort(); controller = new AbortController();
    $('#ask-cancel').hidden = false; $('#ask-ai').disabled = true;
    panel.replaceChildren(el('p', 'mode-note pending', `Waiting for ${name} (${model}). Sent ${excerpts.length} excerpts, ${characters.toLocaleString('en')} characters${matched ? '' : ', from the reading order because no line matched'}.`));
    try {
      const response = await fetch('/api/ask', { method: 'POST', headers: headers(), signal: controller.signal, body: JSON.stringify({ ai: true, question: $('#question').value, excerpts, repository: result.repository.fullName, commit: result.repository.sha, provider, apiKey, model }) });
      const type = (response.headers.get('Content-Type') || '').toLowerCase();
      if (!type.includes('application/json')) throw new Error(`The server returned ${type.split(';')[0] || 'an unknown format'} instead of an answer (HTTP ${response.status}). Reload and try again.`);
      const data = await response.json(); if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : `The request failed (HTTP ${response.status}).`);
      panel.replaceChildren(el('p', 'mode-note', `${data.providerName} · ${data.model}. An answer from ${data.sent.excerpts} excerpts; check the cited lines.`));
      panel.append(el('p', data.answered ? 'answer' : 'answer unanswered', data.answer));
      const verified = data.findings.filter(item => item.verified); const inferred = data.findings.filter(item => !item.verified);
      if (verified.length) { panel.append(el('h4', 'verified-title', 'Verified source')); const list = el('ul', 'findings verified'); verified.forEach(item => { const row = el('li'); row.append(el('span', '', item.text + ' '), link(result, item.path, item.line), el('code', 'quote', item.quote)); list.append(row); }); panel.append(list); }
      if (inferred.length) { panel.append(el('h4', 'inferred-title', 'Genius inference (not verified)')); const list = el('ul', 'findings inferred'); inferred.forEach(item => { const row = el('li'); row.append(el('span', '', item.text + ' '), link(result, item.path, item.line), el('span', 'why', item.reason || '')); list.append(row); }); panel.append(list); }
      if (data.suggestions.length) { panel.append(el('h4', '', 'Suggestions (opinion, not evidence)')); const list = el('ul', 'suggestions'); data.suggestions.forEach(item => list.append(el('li', '', item))); panel.append(list); }
      const usage = data.usage ? ` Tokens: ${data.usage.input_tokens ?? data.usage.prompt_tokens ?? data.usage.promptTokenCount ?? '?'} in, ${data.usage.output_tokens ?? data.usage.completion_tokens ?? data.usage.candidatesTokenCount ?? '?'} out.` : '';
      panel.append(el('p', 'fineprint', `Citations were checked on the server against the file on GitHub at commit ${result.repository.sha.slice(0, 7)}: ${data.verification?.verified ?? 0} verified, ${data.verification?.inferred ?? 0} not verified.${usage}`));
    } catch (error) {
      panel.replaceChildren(el('p', 'error-note', error.name === 'AbortError' ? 'Question cancelled. Nothing further will be billed for it by this site; the provider may still count tokens already processed.' : error.message));
    } finally { controller = null; $('#ask-cancel').hidden = true; $('#ask-ai').disabled = false; }
  }
  $('#ask-form').addEventListener('submit', event => { event.preventDefault(); showSearch(); });
  $('#ask-ai').addEventListener('click', askAI);
  $('#ask-cancel').addEventListener('click', () => controller?.abort());
  return { refresh };
}
