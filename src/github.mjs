// Project: Git Architecture Diagram | Component: GitHub reader | Author: Amine Saoud ibn al-Bashir.
// Features: immutable snapshots, bounded text ingestion, private-token isolation, and explicit coverage.
import { Buffer } from 'node:buffer'; // Make Git blob verification portable to the hosted Node-compatible runtime.
import { createHash } from 'node:crypto'; // Verify Git blob identities before analyzing their contents.
export class AppError extends Error { constructor(status, message) { super(message); this.status = status; } } // Carry safe HTTP error messages.
export const VERSION = '0.3.0'; // Identify the report generator and its contracts.
const SEGMENT = /^[a-zA-Z0-9_.-]+$/; // Restrict repository identifiers to GitHub-compatible path segments.
const SKIP = /(^|\/)(node_modules|vendor|dist|build|\.git|\.pio|coverage|__pycache__)(\/|$)/i; // Avoid generated and vendored content.
const SECRET = /(^|\/)(\.env(?:\..*)?|.*(?:credential|secret|password|private[_-]?key).*|id_rsa|id_ed25519)$|\.(pem|p12|pfx|key)$/i; // Exclude likely credential files from ingestion.
const TEXT = /\.(m?[jc]?[jt]sx?|py|pyi|c|cc|cpp|cxx|h|hpp|rs|go|java|kt|cs|rb|php|swift|vue|svelte|md|mdx|rst|txt|json|toml|ini|ya?ml|sh|html|css|sql|proto|graphql)$/i; // Recognize useful textual files.
export const safeTextPath = path => !SKIP.test(path) && !SECRET.test(path) && (TEXT.test(path) || /(^|\/)(Dockerfile|Makefile|CMakeLists.txt|LICENSE)$/i.test(path)); // Select inspectable source and documentation.
export const encodePath = value => value.split('/').map(encodeURIComponent).join('/'); // Encode repository paths without losing their hierarchy.
export function parseRepository(input) { // Accept a GitHub URL or owner/repository shorthand.
  const value = String(input ?? '').trim(); // Normalize user input without executing it.
  if (!value || value.length > 1600) throw new AppError(400, 'Enter a GitHub repository URL or owner/repository.'); // Reject missing or excessive input.
  let parts; // Hold validated URL path segments.
  if (/^(?:https?:\/\/|github\.com\/)/i.test(value)) { // Parse complete and schemeless GitHub URLs.
    let url; try { url = new URL(value.startsWith('github.com/') ? `https://${value}` : value); } catch { throw new AppError(400, 'The repository URL is invalid.'); } // Return a readable validation error.
    if (url.hostname !== 'github.com' || url.username || url.password || url.port || url.protocol !== 'https:') throw new AppError(400, 'Use an HTTPS URL on github.com.'); // Prevent arbitrary outbound URL targets.
    try { parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent); } catch { throw new AppError(400, 'The repository URL contains invalid encoding.'); } // Decode path segments once.
  } else parts = value.split('/').filter(Boolean); // Accept the short owner/repository form.
  const [owner, rawRepo, type, ...tail] = parts; // Extract a possible GitHub tree or blob route.
  const repo = rawRepo?.replace(/\.git$/, ''); // Accept clone-style repository names.
  if (![owner, repo].every(part => part && SEGMENT.test(part) && !['.', '..'].includes(part)) || owner.length > 100 || repo.length > 150) throw new AppError(400, 'Use a valid owner/repository pair.'); // Validate both identifiers.
  if (type && !['tree', 'blob'].includes(type)) throw new AppError(400, 'Use the repository, tree, or file URL rather than an issue or pull request.'); // Keep analysis scope unambiguous.
  if (tail.some(part => !part || ['.', '..'].includes(part) || part.includes('\\'))) throw new AppError(400, 'Invalid repository path.'); // Reject path traversal syntax.
  return { owner, repo, tail, type, fullName: `${owner}/${repo}` }; // Return a normalized repository target.
} // End repository parsing.
export function normalizeScope(value = '') { // Normalize the optional repository-relative scope.
  const scope = String(value).trim().replace(/^\/+|\/+$/g, ''); // Remove leading and trailing separators.
  if (scope.length > 1000 || scope.includes('\\') || scope.split('/').some(part => ['.', '..'].includes(part)) || /[\x00-\x1f]/.test(scope)) throw new AppError(400, 'Scope must be a repository-relative file or folder.'); // Reject unsafe or malformed scopes.
  return scope; // Preserve spaces and legitimate filename characters.
} // End scope normalization.
export async function boundedJson(response, limit = 12_000_000) { // Bound network responses before parsing them.
  const chunks = []; let bytes = 0; // Track bytes and retained response chunks.
  for await (const chunk of response.body) { bytes += chunk.length; if (bytes > limit) throw new AppError(413, 'The upstream response exceeded the read limit.'); chunks.push(Buffer.from(chunk)); } // Enforce the bound while streaming.
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AppError(502, 'The upstream service returned invalid JSON.'); } // Reject malformed provider data.
} // End bounded JSON parsing.
export class GitHubReader { // Keep credentials and network controls local to one analysis.
  constructor({ token = '', signal, fetchImpl = fetch, maxRequests = Infinity } = {}) { this.token = token; this.signal = signal; this.fetchImpl = (...args) => fetchImpl(...args); this.maxRequests = maxRequests; this.requests = 0; } // Call native fetch as a standalone function; binding it to this reader breaks the Workers runtime.
  async get(route) { // Read a fixed-host GitHub REST resource.
    if (++this.requests > this.maxRequests) throw new AppError(429, 'The hosted GitHub request budget was reached. Narrow the folder scope and analyze again.'); // Preserve a partial report before exceeding hosting request limits.
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': `GitArchitectureDiagram/${VERSION}` }; // Identify the API contract and application.
    if (this.token) headers.Authorization = `Bearer ${this.token}`; // Send the optional token only to GitHub.
    const signal = this.signal ? AbortSignal.any([this.signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000); // Apply both whole-run and individual request deadlines.
    let response; try { response = await this.fetchImpl(`https://api.github.com${route}`, { headers, signal, redirect: 'manual' }); } catch (error) { if (signal.aborted) throw new AppError(408, 'GitHub reading timed out or was cancelled.'); throw new AppError(502, 'Cannot reach GitHub. Check connectivity and try again.'); } // Workers requires manual redirect handling; never forward credentials to another destination.
    if (response.status >= 300 && response.status < 400) throw new AppError(502, 'GitHub redirected this request. Use the repository\'s current GitHub URL.'); // Reject redirects explicitly instead of using the unsupported Workers redirect-error mode.
    if (!response.ok) { // Translate GitHub failures without exposing tokens or raw response bodies.
      if (response.status === 404) throw new AppError(404, 'Repository, reference, or file not found; private repositories need a read token.'); // Explain missing and inaccessible resources.
      if (response.status === 403 || response.status === 429) throw new AppError(429, 'GitHub denied this request or its rate limit was reached. Add a read token or retry later.'); // Surface rate limits and access restrictions.
      if (response.status === 401) throw new AppError(401, 'GitHub rejected the read token.'); // Handle expired or invalid credentials.
      if (response.status === 409) throw new AppError(409, 'This repository has no commit to analyze yet.'); // Handle newly created empty repositories.
      if (response.status === 422 && route.includes('/commits/')) throw new AppError(422, 'GitHub could not resolve this repository reference.'); // Distinguish an invalid ref candidate from a failed repository request.
      throw new AppError(502, `GitHub returned HTTP ${response.status}.`); // Return a bounded general upstream error.
    } // End GitHub error handling.
    return boundedJson(response); // Parse the bounded successful response.
  } // End API reading.
  async snapshot(target, { ref = '', scope = '', suppliedToken = false } = {}) { // Resolve a repository target to one immutable commit.
    const route = `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}`; // Build the validated API repository prefix.
    const metadata = await this.get(route); // Read visibility and the default branch.
    if (metadata.private && !suppliedToken) throw new AppError(403, 'Private repositories require your own request-specific GitHub read token.'); // Never publish private repositories through a server-wide token.
    let revision = String(ref).trim() || metadata.default_branch; let selectedScope = normalizeScope(scope); let commit; // Initialize explicit or default scope selection.
    if (!ref && target.tail.length) { // Resolve branch names containing slashes using the longest valid prefix.
      for (let count = Math.min(target.tail.length, 12); count >= 1; count--) { // Bound reference-disambiguation requests.
        try { revision = target.tail.slice(0, count).join('/'); commit = await this.get(`${route}/commits/${encodeURIComponent(revision)}`); selectedScope ||= normalizeScope(target.tail.slice(count).join('/')); break; } catch (error) { if (![404, 422].includes(error.status)) throw error; } // GitHub can return either 404 or 422 for a branch-plus-folder candidate; preserve other failures.
      } // End longest-prefix resolution.
      if (!commit) throw new AppError(404, 'Cannot resolve this tree URL. Enter an explicit branch and folder.'); // Explain unsupported or missing references.
    } else { // Resolve a plain repository or an explicitly chosen branch.
      if (target.tail.length && !selectedScope) { const prefix = String(ref).split('/'); if (prefix.every((part, index) => target.tail[index] === part)) selectedScope = normalizeScope(target.tail.slice(prefix.length).join('/')); } // Preserve a supplied URL folder when it matches the explicit reference.
      commit = await this.get(`${route}/commits/${encodeURIComponent(revision)}`); // Resolve exactly one commit before reading its tree.
    } // End revision selection.
    const listing = await this.get(`${route}/git/trees/${commit.commit.tree.sha}?recursive=1`); // Fetch the immutable repository tree.
    const all = listing.tree.filter(entry => ['blob', 'tree', 'commit'].includes(entry.type)).map(entry => ({ path: entry.path, type: entry.type, size: entry.size ?? 0, sha: entry.sha, mode: entry.mode })); // Keep compact factual metadata.
    const scoped = all.filter(entry => !selectedScope || entry.path === selectedScope || entry.path.startsWith(`${selectedScope}/`)); // Restrict analysis and browsing to the requested scope.
    if (selectedScope && !scoped.length) throw new AppError(404, 'The selected file or folder does not exist in this commit.'); // Reject empty or mistyped scopes.
    const entries = scoped.slice(0, 12000); // Bound retained tree size for large repositories.
    return { route, owner: target.owner, repo: target.repo, fullName: metadata.full_name, description: metadata.description || '', private: metadata.private, branch: revision, sha: commit.sha, scope: selectedScope, entries, treeTruncated: Boolean(listing.truncated) || scoped.length > entries.length, listedEntries: scoped.length, htmlUrl: `https://github.com/${metadata.full_name}`, committedAt: commit.commit.committer?.date ?? null }; // Report truncation explicitly.
  } // End immutable snapshot construction.
  async blob(snapshot, entry) { // Fetch and verify one small textual Git blob.
    const data = await this.get(`${snapshot.route}/git/blobs/${entry.sha}`); // Avoid branch drift by using the immutable blob SHA.
    if (data.encoding !== 'base64') throw new AppError(422, 'Unsupported GitHub blob encoding.'); // Require a predictable byte representation.
    const bytes = Buffer.from(data.content, 'base64'); // Decode the exact stored bytes.
    if (bytes.length > 96000 || bytes.includes(0)) throw new AppError(413, 'Binary or oversized file excluded from text analysis.'); // Avoid binary payloads and large text reads.
    const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'); // Recreate the Git object identity.
    if (sha !== entry.sha) throw new AppError(502, 'GitHub blob integrity verification failed.'); // Refuse inconsistent evidence.
    return { path: entry.path, sha, content: bytes.toString('utf8'), size: bytes.length }; // Return evidence without any credential fields.
  } // End verified blob reading.
} // End the GitHub reader.
export function selectFiles(snapshot, maxFiles = 32) { // Select a bounded, distributed sample of code and documentation.
  const candidates = snapshot.entries.filter(entry => entry.type === 'blob' && entry.mode !== '120000' && entry.size <= 96000 && safeTextPath(entry.path)); // Skip symlinks, secrets, binaries, and large files.
  const score = path => (/readme\.md$/i.test(path) ? 65 : 0) + (/(^|\/)(main|index|app|server)\./i.test(path) ? 55 : 0) + (/(package\.json|platformio\.ini|pyproject\.toml|Cargo\.toml|go\.mod)$/i.test(path) ? 60 : 0) + (/architecture|implementation|wiring|connection-diagram|system-diagram/i.test(path) ? 35 : 0) + (/\.(cpp|h|py|js|ts|tsx|go|rs)$/i.test(path) ? 20 : 0) - path.split('/').length * 2; // Prioritize actual entry points and explanatory material.
  const remaining = candidates.map(entry => ({ ...entry, score: score(entry.path) })); const chosen = []; const counts = new Map(); // Track directory diversity while selecting.
  while (remaining.length && chosen.length < maxFiles) { // Fill the requested file budget.
    remaining.sort((a, b) => (b.score - (counts.get(b.path.split('/').slice(0, -1).join('/')) || 0) * 18) - (a.score - (counts.get(a.path.split('/').slice(0, -1).join('/')) || 0) * 18) || a.path.localeCompare(b.path)); // Avoid allowing one folder to consume the sample.
    const entry = remaining.shift(); const directory = entry.path.split('/').slice(0, -1).join('/'); // Identify the winning candidate's directory.
    chosen.push(entry); counts.set(directory, (counts.get(directory) || 0) + 1); // Update the selected sample and its diversity penalty.
  } // End source selection.
  return { selected: chosen, eligible: candidates.length }; // Expose the selection denominator for coverage reporting.
} // End source selection.
export async function ingest(snapshot, reader, maxFiles, progress = () => {}) { // Read files sequentially to bound request pressure and retained bytes.
  const selection = selectFiles(snapshot, maxFiles); const files = []; const skipped = []; let bytes = 0; // Initialize actual evidence and skip accounting.
  for (const entry of selection.selected) { // Process every selected candidate within the total byte budget.
    if (bytes + entry.size > 900000) { skipped.push({ path: entry.path, reason: 'Total byte budget' }); continue; } // Keep memory and downstream model input bounded.
    progress({ stage: 'Reading source', detail: entry.path, read: files.length, total: selection.selected.length }); // Stream honest file-reading progress.
    try { const file = await reader.blob(snapshot, entry); bytes += file.size; files.push(file); } catch (error) { if ([401, 403, 408, 429].includes(error.status)) { skipped.push(...selection.selected.slice(files.length + skipped.length).map(item => ({ path: item.path, reason: error.message }))); break; } skipped.push({ path: entry.path, reason: error.message }); } // Preserve partial evidence while reporting upstream limits.
  } // End bounded ingestion.
  return { files, coverage: { readFiles: files.length, eligibleFiles: selection.eligible, listedFiles: snapshot.entries.filter(entry => entry.type === 'blob').length, maxFiles, bytes, treeTruncated: snapshot.treeTruncated, skipped, unsampledFiles: Math.max(0, selection.eligible - files.length) } }; // Describe exactly what the analyzer saw.
} // End ingestion.
