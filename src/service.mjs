// Project: Git Architecture Diagram | Component: Analysis service | Author: Amine Saoud ibn al-Bashir.
import { randomUUID } from 'node:crypto'; // Create unguessable ephemeral analysis-session identifiers.
import { AppError, GitHubReader, parseRepository, ingest, VERSION, safeTextPath, normalizeScope } from './github.mjs'; // Use the verified GitHub ingestion layer.
import { analyzeSnapshot, buildDiagrams, guideMarkdown, treeText } from './genius.mjs'; // Produce real structural reports and exports.
import { explainWithAI } from './ai.mjs'; // Add model interpretation only when explicitly requested.
import { compileAIGraph } from './graph.mjs'; // Compile validated interpretation graphs with safe source mappings.
import { PROVIDERS } from './providers.mjs'; // Keep provider credentials isolated by their configured identity.
const publicCache = new Map(); const sessions = new Map(); // Keep bounded, process-local caches without any persisted credentials.
const TTL = 10 * 60 * 1000; // Expire retained analysis contents after ten minutes.
function prune(map, limit = 12) { for (const [key, item] of map) if (item.expires < Date.now()) map.delete(key); while (map.size >= limit) map.delete(map.keys().next().value); } // Bound both lifetime and retained report count.
export function getSession(id) { const item = sessions.get(id); if (!item || item.expires < Date.now()) { sessions.delete(id); throw new AppError(404, 'This analysis session expired. Analyze the repository again.'); } return item.result; } // Retrieve ephemeral source evidence for in-session searches.
export async function runAnalysis(input, { signal, progress = () => {}, env = process.env, fetchImpl = fetch, allowEnvAI = false, cachePublic = true, retainSession = true, maxGitHubRequests = Infinity } = {}) { // Orchestrate the same pipeline for HTTP and CLI use.
  if (!input || typeof input !== 'object') throw new AppError(400, 'A repository analysis request is required.'); // Validate the request shape.
  const target = parseRepository(input.repository); const maxFiles = Number(input.maxFiles ?? 32); // Parse the repository and requested read budget.
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 120) throw new AppError(400, 'The file budget must be an integer between 1 and 120.'); // Reject unbounded analysis requests.
  const token = typeof input.githubToken === 'string' ? input.githubToken.trim() : ''; // Keep request-specific GitHub credentials ephemeral.
  if (token.length > 1024) throw new AppError(400, 'The GitHub token is invalid.'); // Bound credential input.
  const reader = new GitHubReader({ token: token || env.GITHUB_TOKEN || '', signal, fetchImpl, maxRequests: maxGitHubRequests }); // Allow an optional server token only under snapshot visibility checks.
  progress({ stage: 'Resolving repository', detail: target.fullName }); // Begin truthful streaming progress.
  const snapshot = await reader.snapshot(target, { ref: input.ref, scope: input.scope, suppliedToken: Boolean(token) }); // Pin all subsequent reads to one commit.
  const key = `${VERSION}|${snapshot.fullName}|${snapshot.sha}|${snapshot.scope}|${maxFiles}`; prune(publicCache); prune(sessions); // Invalidate structural caches when the analyzer changes.
  let result; const shareable = cachePublic && !snapshot.private && !token && !env.GITHUB_TOKEN; const cached = shareable && input.refresh !== true && publicCache.get(key); // Keep private and credential-specific responses outside shared caches.
  if (cached && cached.expires >= Date.now()) { result = structuredClone(cached.result); result.repository = snapshot; progress({ stage: 'Opening saved analysis', detail: snapshot.sha.slice(0, 10) }); } // Reuse the same commit's evidence while preserving the newly requested reference.
  else { const { files, coverage } = await ingest(snapshot, reader, maxFiles, progress); signal?.throwIfAborted(); progress({ stage: 'Genius is mapping the project', detail: `${files.length} files read` }); result = analyzeSnapshot(snapshot, files, coverage); if (shareable) publicCache.set(key, { result: structuredClone(result), expires: Date.now() + TTL }); } // Cache only public structural evidence; never cache paid model output or credentials.
  if (input.ai === true) { // Spend model resources only after an explicit AI request.
    const provider = input.provider || env.GENIUS_PROVIDER || 'openai'; if (!Object.hasOwn(PROVIDERS, provider)) throw new AppError(400, 'Unknown AI provider.'); const sameProvider = provider === (env.GENIUS_PROVIDER || 'openai'); const apiKey = input.apiKey || (allowEnvAI && sameProvider ? env[PROVIDERS[provider].keyEnv] : ''); const model = input.model || (sameProvider ? env.GENIUS_MODEL : ''); // Restrict server-key usage to authenticated or local contexts.
    if (!apiKey || !model) result.warnings.push('AI interpretation was requested but no authorized key/model was configured. This is a structural Genius report.'); // Make missing configuration visible.
    else { progress({ stage: 'Genius AI is explaining the source', detail: `Selected source excerpts are sent to ${PROVIDERS[provider].name}.` }); try { result.ai = await explainWithAI(result, { apiKey, model, provider, signal, fetchImpl }); } catch (error) { signal?.throwIfAborted(); result.warnings.push(error.message); } } // Preserve recoverable model errors without swallowing cancellation.
  } // End optional AI interpretation.
  if (result.ai) result.ai.diagrams = result.ai.graph ? compileAIGraph(result.ai.graph) : buildDiagrams(result.repository, result.ai.components.map(item => ({ path: item.path })), result.ai.relationships.map(item => ({ from: item.from, to: item.to, kind: 'ai' }))); // Compile a separately labeled interpretation using validated repository paths.
  signal?.throwIfAborted(); result.id = randomUUID(); result.cacheHit = Boolean(cached); result.guide = guideMarkdown(result); result.tree = treeText(result.repository); // Stop canceled requests before returning a successful report.
  if (retainSession) sessions.set(result.id, { result, expires: Date.now() + TTL }); // Hold current source evidence in memory for ten minutes; never retain tokens.
  progress({ stage: 'Ready', detail: `${result.coverage.readFiles} source files · ${result.dependencies.length} located relationships` }); // Announce completion with actual counts.
  return result; // Return a usable analysis rather than a UI-only placeholder.
} // End analysis orchestration.

export async function readSource(input, { env = process.env, signal, fetchImpl = fetch } = {}) { // Retrieve one requested source file without purchasing an AI call.
  if (!input || typeof input !== 'object' || !/^[a-f0-9]{40}$/i.test(input.commit || '')) throw new AppError(400, 'Source browsing needs an analyzed commit.'); // Require an immutable evidence revision.
  const path = normalizeScope(input.path); if (!path || !safeTextPath(path)) throw new AppError(422, 'This path is binary, generated, or excluded from safe text browsing. Open its GitHub source instead.'); // Keep source browsing inside the same text policy as analysis.
  const token = typeof input.githubToken === 'string' ? input.githubToken.trim() : ''; if (token.length > 1024) throw new AppError(400, 'Invalid GitHub token.'); // Bound ephemeral caller credentials.
  const reader = new GitHubReader({ token: token || env.GITHUB_TOKEN || '', signal, fetchImpl, maxRequests: 5 }); const snapshot = await reader.snapshot(parseRepository(input.repository), { ref: input.commit, scope: path, suppliedToken: Boolean(token) }); // Verify repository access and the file's membership on every read.
  const entry = snapshot.entries.find(item => item.path === path && item.type === 'blob' && item.mode !== '120000'); if (!entry || entry.size > 96000) throw new AppError(413, 'This file cannot be previewed within the 96 KB text limit.'); // Exclude symlinks and oversized text before retrieving bytes.
  return { file: await reader.blob(snapshot, entry), commit: snapshot.sha }; // Return verified source without changing the original analysis coverage.
} // End independent source browsing.
