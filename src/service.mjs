// Project: Git Architecture Diagram | Component: Analysis service | Author: Amine Saoud ibn al-Bashir.
import { randomUUID } from 'node:crypto'; // Create unguessable ephemeral analysis-session identifiers.
import { AppError, GitHubReader, parseRepository, ingest } from './github.mjs'; // Use the verified GitHub ingestion layer.
import { analyzeSnapshot, guideMarkdown, treeText } from './genius.mjs'; // Produce real structural reports and exports.
import { explainWithAI } from './ai.mjs'; // Add model interpretation only when explicitly requested.
const publicCache = new Map(); const sessions = new Map(); // Keep bounded, process-local caches without any persisted credentials.
const TTL = 10 * 60 * 1000; // Expire retained analysis contents after ten minutes.
function prune(map, limit = 12) { for (const [key, item] of map) if (item.expires < Date.now()) map.delete(key); while (map.size >= limit) map.delete(map.keys().next().value); } // Bound both lifetime and retained report count.
export function getSession(id) { const item = sessions.get(id); if (!item || item.expires < Date.now()) { sessions.delete(id); throw new AppError(404, 'This analysis session expired. Analyze the repository again.'); } return item.result; } // Retrieve ephemeral source evidence for in-session searches.
export async function runAnalysis(input, { signal, progress = () => {}, env = process.env, fetchImpl = fetch, allowEnvAI = false } = {}) { // Orchestrate the same pipeline for HTTP and CLI use.
  if (!input || typeof input !== 'object') throw new AppError(400, 'A repository analysis request is required.'); // Validate the request shape.
  const target = parseRepository(input.repository); const maxFiles = Number(input.maxFiles ?? 32); // Parse the repository and requested read budget.
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 120) throw new AppError(400, 'The file budget must be an integer between 1 and 120.'); // Reject unbounded analysis requests.
  const token = typeof input.githubToken === 'string' ? input.githubToken.trim() : ''; // Keep request-specific GitHub credentials ephemeral.
  if (token.length > 1024) throw new AppError(400, 'The GitHub token is invalid.'); // Bound credential input.
  const reader = new GitHubReader({ token: token || env.GITHUB_TOKEN || '', signal, fetchImpl }); // Allow an optional server token only under snapshot visibility checks.
  progress({ stage: 'Resolving repository', detail: target.fullName }); // Begin truthful streaming progress.
  const snapshot = await reader.snapshot(target, { ref: input.ref, scope: input.scope, suppliedToken: Boolean(token) }); // Pin all subsequent reads to one commit.
  const key = `${snapshot.fullName}|${snapshot.sha}|${snapshot.scope}|${maxFiles}`; prune(publicCache); prune(sessions); // Key shared caching by commit and analysis options.
  let result; const cached = !snapshot.private && input.refresh !== true && publicCache.get(key); // Never put private results in the shared cache.
  if (cached && cached.expires >= Date.now()) { result = structuredClone(cached.result); result.repository = snapshot; progress({ stage: 'Opening saved analysis', detail: snapshot.sha.slice(0, 10) }); } // Reuse the same commit's evidence while preserving the newly requested reference.
  else { const { files, coverage } = await ingest(snapshot, reader, maxFiles, progress); progress({ stage: 'Genius is mapping the project', detail: `${files.length} files read` }); result = analyzeSnapshot(snapshot, files, coverage); if (!snapshot.private) publicCache.set(key, { result: structuredClone(result), expires: Date.now() + TTL }); } // Build and optionally cache a factual structural report.
  if (input.ai === true) { // Spend model resources only after an explicit AI request.
    const apiKey = input.apiKey || (allowEnvAI ? env.OPENAI_API_KEY : ''); const model = input.model || env.GENIUS_MODEL; // Restrict server-key usage to authenticated or local contexts.
    if (!apiKey || !model) result.warnings.push('AI interpretation was requested but no authorized key/model was configured. This is a structural Genius report.'); // Make missing configuration visible.
    else { progress({ stage: 'Genius AI is explaining the source', detail: 'Only the disclosed source excerpts are sent to OpenAI.' }); try { result.ai = await explainWithAI(result, { apiKey, model, signal, fetchImpl }); } catch (error) { result.warnings.push(error.message); } } // Preserve the structural report if optional model work fails.
  } // End optional AI interpretation.
  result.id = randomUUID(); result.cacheHit = Boolean(cached); result.guide = guideMarkdown(result); result.tree = treeText(result.repository); // Finalize portable report outputs.
  sessions.set(result.id, { result, expires: Date.now() + TTL }); // Hold current source evidence in memory for ten minutes; never retain tokens.
  progress({ stage: 'Ready', detail: `${result.coverage.readFiles} source files · ${result.dependencies.length} located relationships` }); // Announce completion with actual counts.
  return result; // Return a usable analysis rather than a UI-only placeholder.
} // End analysis orchestration.
