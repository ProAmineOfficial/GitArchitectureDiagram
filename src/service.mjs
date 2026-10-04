// Project: Git Architecture Diagram | Component: Analysis service | Author: Amine Saoud ibn al-Bashir.
import { randomUUID } from 'node:crypto'; // Create unguessable ephemeral analysis-session identifiers.
import { AppError, GitHubReader, parseRepository, ingest, VERSION } from './github.mjs'; // Use the verified GitHub ingestion layer.
import { analyzeSnapshot, buildDiagrams, guideMarkdown, treeText, discoverReferences } from './genius.mjs';
import { buildGeniusHierarchy } from './hierarchy.mjs'; // Produce real structural reports and exports.
import { explainWithAI } from './ai.mjs'; // Add model interpretation only when explicitly requested.
import { PROVIDERS } from './providers.mjs'; // Keep provider credentials isolated by their configured identity.
import { errorInfo } from './provider-errors.mjs'; // Display-safe provider failure details for the interface.
const publicCache = new Map(); const sessions = new Map(); // Keep bounded, process-local caches without any persisted credentials.
const TTL = 10 * 60 * 1000; // Expire retained analysis contents after ten minutes.
function prune(map, limit = 12) { for (const [key, item] of map) if (item.expires < Date.now()) map.delete(key); while (map.size >= limit) map.delete(map.keys().next().value); } // Bound both lifetime and retained report count.
const aiCache = new Map(); const budget = { day: '', used: 0 }; // Saved public system maps and today's model-call count (per process or isolate).
export function publicAIStatus(env = process.env) { // Describe the operator's opt-in public AI mode without exposing any key.
  const provider = env.GENIUS_PROVIDER || 'openai'; const limit = Math.max(0, Number(env.GENIUS_PUBLIC_DAILY_LIMIT ?? 25) || 0); const today = new Date().toISOString().slice(0, 10); if (budget.day !== today) { budget.day = today; budget.used = 0; } // Reset the counter each UTC day.
  const enabled = env.GENIUS_PUBLIC_AI === '1' && Boolean(PROVIDERS[provider] && env[PROVIDERS[provider].keyEnv] && env.GENIUS_MODEL) && limit > 0; // Require an explicit opt-in, a key, and a model.
  return { enabled, remainingToday: enabled ? Math.max(0, limit - budget.used) : 0, dailyLimit: enabled ? limit : 0, provider: enabled ? PROVIDERS[provider].name : null, model: enabled ? env.GENIUS_MODEL : null };
} // End public AI status.
function takePublicBudget(env) { const status = publicAIStatus(env); if (!status.remainingToday) return false; budget.used++; return true; } // Count only real model calls, never saved maps.
export function getSession(id) { const item = sessions.get(id); if (!item || item.expires < Date.now()) { sessions.delete(id); throw new AppError(404, 'This analysis session expired. Analyze the repository again.'); } return item.result; } // Retrieve ephemeral source evidence for in-session searches.
export async function runAnalysis(input, { signal, progress = () => {}, env = process.env, fetchImpl = fetch, allowEnvAI = false, cachePublic = true, retainSession = true, maxGitHubRequests = Infinity, aiStore = null } = {}) { // Orchestrate the same pipeline for HTTP and CLI use.
  if (!input || typeof input !== 'object') throw new AppError(400, 'A repository analysis request is required.'); // Validate the request shape.
  const target = parseRepository(input.repository); const maxFiles = Number(input.maxFiles ?? 32); // Parse the repository and requested read budget.
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 120) throw new AppError(400, 'The file budget must be an integer between 1 and 120.'); // Reject unbounded analysis requests.
  const token = typeof input.githubToken === 'string' ? input.githubToken.trim() : ''; // Keep request-specific GitHub credentials ephemeral.
  if (token.length > 1024) throw new AppError(400, 'The GitHub token is invalid.'); // Bound credential input.
  const reader = new GitHubReader({ token: token || env.GITHUB_TOKEN || '', signal, fetchImpl, maxRequests: maxGitHubRequests }); // Allow an optional server token only under snapshot visibility checks.
  progress({ stage: 'Resolving repository', detail: target.fullName }); // Begin truthful streaming progress.
  const snapshot = await reader.snapshot(target, { ref: input.ref, scope: input.scope, suppliedToken: Boolean(token) }); // Pin all subsequent reads to one commit.
  const key = `${snapshot.fullName}|${snapshot.sha}|${snapshot.scope}|${maxFiles}|${VERSION}`; prune(publicCache); prune(sessions); // Key shared caching by commit and analysis options.
  let result; const cached = cachePublic && !snapshot.private && input.refresh !== true && publicCache.get(key); // Never put private results in the shared cache.
  if (cached && cached.expires >= Date.now()) { result = structuredClone(cached.result); result.repository = snapshot; progress({ stage: 'Opening saved analysis', detail: snapshot.sha.slice(0, 10) }); } // Reuse the same commit's evidence while preserving the newly requested reference.
  else { const { files, coverage } = await ingest(snapshot, reader, maxFiles, progress, { discover: discoverReferences }); progress({ stage: 'Genius is mapping the project', detail: `${files.length} files read` }); result = analyzeSnapshot(snapshot, files, coverage); if (cachePublic && !snapshot.private) publicCache.set(key, { result: structuredClone(result), expires: Date.now() + TTL }); } // Build and optionally cache a factual structural report.
  if (input.ai === true) { // Spend model resources only after an explicit AI request.
    const provider = input.provider || env.GENIUS_PROVIDER || 'openai'; if (!Object.hasOwn(PROVIDERS, provider)) throw new AppError(400, 'Unknown AI provider.'); const sameProvider = provider === (env.GENIUS_PROVIDER || 'openai'); // Validate the provider before choosing a key.
    const publicMode = !input.apiKey && !allowEnvAI && sameProvider && !snapshot.private && publicAIStatus(env).enabled; // The site's own key, for public repositories, when the operator opted in.
    const apiKey = input.apiKey || ((allowEnvAI || publicMode) && sameProvider ? env[PROVIDERS[provider].keyEnv] : ''); const model = input.model || (sameProvider ? env.GENIUS_MODEL : ''); // Restrict server-key usage to authenticated, local, or opted-in public contexts.
    const cacheKey = `${snapshot.fullName}|${snapshot.sha}|${snapshot.scope}|${maxFiles}|${provider}|${model}|${VERSION}`; // One saved system map per commit, scope, budget, and model.
    const saved = publicMode && input.refresh !== true ? (aiCache.get(cacheKey)?.ai || await aiStore?.get(cacheKey).catch(() => null)) : null; // Reuse saved public maps without another model call.
    if (!apiKey || !model) result.warnings.push('AI interpretation was requested but no authorized key/model was configured. This is a structural Genius report.'); // Make missing configuration visible.
    else if (saved) { result.ai = structuredClone(saved); result.ai.saved = true; progress({ stage: 'Opening the saved system map', detail: snapshot.sha.slice(0, 10) }); } // Saved maps cost nothing.
    else if (publicMode && !takePublicBudget(env)) result.warnings.push('Today\'s free system maps on this site are used up. Add your own provider key in API settings, or try again tomorrow.'); // Bound the operator's spending.
    else { progress({ stage: 'Genius AI is mapping the system', detail: `Selected source excerpts are sent to ${PROVIDERS[provider].name}.` }); try { result.ai = await explainWithAI(result, { apiKey, model, provider, signal, fetchImpl, onRetry: event => progress({ stage: 'Provider is busy', detail: event.message }) }); if (publicMode) { result.ai.public = true; aiCache.set(cacheKey, { ai: structuredClone(result.ai) }); while (aiCache.size > 200) aiCache.delete(aiCache.keys().next().value); await aiStore?.put(cacheKey, result.ai).catch(() => {}); } } catch (error) { result.warnings.push(error.message); result.aiError = { ...errorInfo(error), provider, providerName: PROVIDERS[provider].name, model }; } } // Preserve the structural report if optional model work fails.
  } // End optional AI interpretation.
  if (result.ai?.graph && result.hierarchy) result.hierarchy.genius = buildGeniusHierarchy(result.ai.graph, result.repository); // Genius hierarchy, labeled as interpretation.
  if (result.ai) { const files = buildDiagrams(result.repository, result.ai.components.map(item => ({ path: item.path })), result.ai.relationships.map(item => ({ from: item.from, to: item.to, kind: 'ai' }))); result.ai.diagrams = result.ai.graph ? { ...files, architecture: result.ai.graph.mermaid, nodePaths: result.ai.graph.nodePaths, legend: result.ai.graph.legend, edgeLegend: result.ai.graph.edgeLegend, displayedFiles: result.ai.graph.nodes.length, omittedNodes: 0 } : files; } // Prefer the validated component graph; fall back to the file-level interpretation.
  result.id = randomUUID(); result.cacheHit = Boolean(cached); result.guide = guideMarkdown(result); result.tree = treeText(result.repository); // Finalize portable report outputs.
  if (retainSession) sessions.set(result.id, { result, expires: Date.now() + TTL }); // Hold current source evidence in memory for ten minutes; never retain tokens.
  progress({ stage: 'Ready', detail: `${result.coverage.readFiles} source files · ${result.dependencies.length} located relationships` }); // Announce completion with actual counts.
  return result; // Return a usable analysis rather than a UI-only placeholder.
} // End analysis orchestration.
