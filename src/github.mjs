// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-PROVENANCE-CORE-001
// Project: Git Architecture Diagram | Component: GitHub reader | Author: Amine Saoud ibn al-Bashir.
// Features: immutable snapshots, bounded text ingestion, private-token isolation, and explicit coverage.
import { Buffer } from 'node:buffer'; // Make Git blob verification portable to the hosted Node-compatible runtime.
import { createHash } from 'node:crypto'; // Verify Git blob identities before analyzing their contents.
export class AppError extends Error { constructor(status, message) { super(message); this.status = status; } } // Carry safe HTTP error messages.
export const VERSION = '1.1.0'; // Identify the report generator and its contracts.
const SEGMENT = /^[a-zA-Z0-9_.-]+$/; // Restrict repository identifiers to GitHub-compatible path segments.
const SKIP = /(^|\/)(node_modules|vendor|dist|build|\.git|\.pio|coverage|__pycache__)(\/|$)/i; // Avoid generated and vendored content.
const SECRET = /(^|\/)(\.env(?:\..*)?|.*(?:credential|secret|password|private[_-]?key).*|id_rsa|id_ed25519)$|\.(pem|p12|pfx|key)$/i; // Exclude likely credential files from ingestion.
const TEXT = /\.(m?[jc]?[jt]sx?|py|pyi|c|cc|cpp|cxx|h|hpp|ino|rs|go|java|kt|kts|cs|rb|php|swift|vue|svelte|md|mdx|mmd|mermaid|rst|txt|json|toml|ini|cfg|conf|properties|ya?ml|sh|bat|cmd|ps1|reg|inf|ld|s|asm|v|sv|vhdl?|cmake|gradle|html|css|sql|proto|graphql)$/i; // Recognize useful textual files.
const PROJECT_MARKER = /(^|\/)(package\.json|platformio\.ini|pyproject\.toml|setup\.py|Cargo\.toml|go\.mod|CMakeLists\.txt|pom\.xml|build\.gradle(\.kts)?|library\.(json|properties))$/i; // Files that mark the root of a buildable project.
// ——— Reading Engine 2.0 limits ———
const RAW_HOST = 'raw.githubusercontent.com'; // GitHub's raw content host; addressed by commit SHA, so content cannot change under a pinned analysis.
const RAW_TIMEOUT_MS = 15000; // Per-file deadline for raw reads; the API fallback has its own 25-second deadline.
const RAW_FAILURE_LIMIT = 3; // After three consecutive raw failures, read the rest of the run through the API.
const MAX_BLOB_BYTES = 96000; // Largest single text file analyzed (unchanged from 1.1.0).
const MAX_TREE_REQUESTS = 40; // Extra tree listings allowed when GitHub truncates a recursive tree.
const MAX_TREE_ENTRIES = 200000; // Stop recovering a truncated tree beyond this many entries (memory bound).
export const MAX_RETAINED_ENTRIES = 12000; // Entries kept for browsing, selection, and the response (unchanged display limit).
export const INGEST_CONCURRENCY = 4; // Files read at the same time; results are applied in a fixed order, so the same commit gives the same report.
/** Git's blob identity: SHA-1 over "blob <length>\0<bytes>". */
export function gitBlobSha(bytes) { return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'); }
/** Read a response body up to `limit` bytes; larger bodies are rejected without being buffered. */
export async function boundedBytes(response, limit) {
  const chunks = []; let total = 0;
  if (!response.body) return Buffer.alloc(0);
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > limit) { throw new AppError(413, 'The upstream response exceeded the read limit.'); }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
/** Normalize one GitHub tree entry, prefixing the path of the subtree it was listed from. */
function treeEntry(entry, prefix = '') {
  return { path: prefix ? `${prefix}/${entry.path}` : entry.path, type: entry.type, size: entry.size ?? 0, sha: entry.sha, mode: entry.mode };
}
const TREE_TYPES = new Set(['blob', 'tree', 'commit']); // Files, folders, and submodule pointers.
function addTreeEntry(found, entry, prefix) { if (TREE_TYPES.has(entry.type)) { const item = treeEntry(entry, prefix); found.set(item.path, item); } } // Later listings replace earlier ones for the same path.
/**
 * Keep at most `limit` entries, shallow levels first, then restore path order.
 * GitHub lists trees in path order, so cutting the list off would drop whole late folders (often src/);
 * keeping shallow entries first preserves the top-level structure of very large repositories.
 */
export function retainEntries(entries, limit) {
  if (entries.length <= limit) return entries;
  const depth = path => path.split('/').length;
  const kept = [...entries].sort((a, b) => depth(a.path) - depth(b.path) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)).slice(0, limit);
  return kept.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
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
  const text = Buffer.concat(chunks).toString('utf8'); // Decode once so HTML pages can be recognized before parsing.
  if (/^\s*</.test(text)) throw new AppError(502, `The upstream service returned an HTML page instead of JSON (HTTP ${response.status}). A proxy, captive portal, or outage page is likely in the way.`); // Name the real cause instead of a parser error.
  try { return JSON.parse(text); } catch { throw new AppError(502, 'The upstream service returned invalid JSON.'); } // Reject malformed provider data.
} // End bounded JSON parsing.
export function rateLimitInfo(headers) { // Read GitHub's documented allowance headers when present.
  const remaining = headers.get('x-ratelimit-remaining'); if (remaining === null) return null; // Some responses omit rate-limit headers.
  return { limit: Number(headers.get('x-ratelimit-limit')) || null, remaining: Number(remaining), reset: Number(headers.get('x-ratelimit-reset')) || null }; // Keep numbers only; never retain response bodies.
} // End rate-limit parsing.
export function rateLimitMessage(info, retryAfter, authenticated) { // Tell the visitor when GitHub will accept requests again.
  const seconds = Number(retryAfter) || (info?.reset ? info.reset - Math.floor(Date.now() / 1000) : 0); // Prefer GitHub's explicit retry interval.
  const when = seconds > 0 ? ` It resets in about ${Math.max(1, Math.ceil(seconds / 60))} minute${seconds > 60 ? 's' : ''}${info?.reset ? ` (${new Date(info.reset * 1000).toISOString().slice(11, 16)} UTC)` : ''}.` : ''; // Show a concrete wait time when known.
  return `GitHub's API rate limit was reached.${when} ${authenticated ? 'Your token\'s allowance is exhausted; wait for the reset.' : 'Wait for the reset. The site operator can raise this allowance with a server-side GITHUB_TOKEN.'}`; // Give the actionable fix.
} // End rate-limit messaging.
export class GitHubReader { // Keep credentials and network controls local to one analysis.
  constructor({ token = '', signal, fetchImpl = fetch, maxRequests = Infinity, raw = true, maxTreeRequests = MAX_TREE_REQUESTS } = {}) {
    this.token = token; this.signal = signal; this.maxRequests = maxRequests; this.requests = 0; // Every network call (API or raw) counts toward the hosted request budget.
    this.fetchImpl = (...args) => fetchImpl(...args); // Call native fetch as a standalone function; binding it to this reader breaks the Workers runtime.
    this.raw = raw; // Read public blobs from GitHub's raw content host, pinned to the commit, before falling back to the API.
    this.maxTreeRequests = maxTreeRequests; // Upper bound on extra tree listings when GitHub truncates a recursive tree.
    this.rawFailures = 0; // Consecutive raw failures; after RAW_FAILURE_LIMIT the reader stops trying raw reads for this run.
    this.stats = { api: 0, raw: 0, rawFallbacks: 0, treeRequests: 0 }; // Measured request counts, reported in coverage.
  }
  budget() { // Count one network call against the request budget, or stop before exceeding it.
    if (++this.requests > this.maxRequests) throw new AppError(429, 'The hosted GitHub request budget was reached. Narrow the folder scope and analyze again.'); // Preserve a partial report before exceeding hosting request limits.
  }
  async get(route) { // Read a fixed-host GitHub REST resource with one retry for transient failures.
    for (let attempt = 0; ; attempt++) { // At most two network attempts per resource.
      try { return await this.request(route); } // Most requests succeed on the first attempt.
      catch (error) { if (attempt >= 1 || !error.transient || this.signal?.aborted) throw error; await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 400)); } // Retry only gateway errors and dropped connections, never 4xx answers.
    } // End retry loop.
  } // End API reading.
  async request(route) { // Perform one bounded GitHub REST request.
    this.budget(); this.stats.api++; // Count the call before sending it.
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': `GitArchitectureDiagram/${VERSION}` }; // Identify the API contract and application.
    if (this.token) headers.Authorization = `Bearer ${this.token}`; // Send the optional token only to GitHub.
    const signal = this.signal ? AbortSignal.any([this.signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000); // Apply both whole-run and individual request deadlines.
    let response; try { response = await this.fetchImpl(`https://api.github.com${route}`, { headers, signal, redirect: 'manual' }); } catch (error) { if (this.signal?.aborted) throw new AppError(408, 'GitHub reading was cancelled.'); if (signal.aborted) throw new AppError(408, 'GitHub did not answer within 25 seconds. Try again or narrow the folder scope.'); throw Object.assign(new AppError(502, 'Cannot reach GitHub. Check connectivity and try again.'), { transient: true }); } // Workers requires manual redirect handling; never forward credentials to another destination.
    this.rateLimit = rateLimitInfo(response.headers) || this.rateLimit; // Remember the latest allowance for coverage reporting.
    if (response.status >= 300 && response.status < 400) throw new AppError(502, 'GitHub redirected this request. Use the repository\'s current GitHub URL.'); // Reject redirects explicitly instead of using the unsupported Workers redirect-error mode.
    if (!response.ok) { // Translate GitHub failures without exposing tokens or raw response bodies.
      await response.body?.cancel().catch(() => {}); // Release the unused error body.
      if (response.status === 404) throw new AppError(404, 'Repository, reference, or file not found. Check the spelling. Only public repositories can be analyzed on this site.'); // Explain missing and inaccessible resources.
      if (response.status === 429 || (response.status === 403 && (this.rateLimit?.remaining === 0 || response.headers.get('retry-after')))) throw new AppError(429, rateLimitMessage(this.rateLimit, response.headers.get('retry-after'), Boolean(this.token))); // Report when the allowance returns.
      if (response.status === 403) throw new AppError(403, 'GitHub denied access to this resource (HTTP 403). The token may lack Contents: read access, or the organization requires SSO authorization for it.'); // Separate permission failures from rate limits.
      if (response.status === 401) throw new AppError(401, 'GitHub rejected the read token. Create a new fine-grained token with Contents: read access.'); // Handle expired or invalid credentials.
      if (response.status === 409) throw new AppError(409, 'This repository has no commit to analyze yet.'); // Handle newly created empty repositories.
      if (response.status === 422 && route.includes('/commits/')) throw new AppError(422, 'GitHub could not resolve this repository reference.'); // Distinguish an invalid ref candidate from a failed repository request.
      if (response.status >= 500) throw Object.assign(new AppError(502, `GitHub is temporarily unavailable (HTTP ${response.status}). Try again shortly.`), { transient: true }); // Allow one retry for gateway failures.
      throw new AppError(502, `GitHub returned HTTP ${response.status}.`); // Return a bounded general upstream error.
    } // End GitHub error handling.
    const type = (response.headers.get('Content-Type') || '').toLowerCase(); // Inspect the media type before parsing.
    if (type && !type.includes('json')) { await response.body?.cancel().catch(() => {}); throw Object.assign(new AppError(502, `GitHub's address returned ${type.split(';')[0]} instead of JSON. A network proxy or outage page is likely in the way.`), { transient: true }); } // Never parse an HTML interstitial as data.
    return boundedJson(response); // Parse the bounded successful response.
  } // End one request.
  async resolveTreeRef(route, tail) { // Split "ref/path" from a tree or blob URL using GitHub's ref listing instead of blind probing.
    const first = tail[0]; // Every candidate ref begins with the first path segment.
    if (/^[0-9a-f]{7,40}$/i.test(first)) { try { return { ref: first, kind: 'commit', segments: 1, commit: await this.get(`${route}/commits/${encodeURIComponent(first)}`) }; } catch (error) { if (![404, 422].includes(error.status)) throw error; } } // A hexadecimal first segment is usually a commit SHA.
    const candidates = []; // Collect branch and tag names that could prefix the path.
    for (const [namespace, kind] of [['heads', 'branch'], ['tags', 'tag']]) { // Branches take precedence over tags, like GitHub's own routing.
      let refs; try { refs = await this.get(`${route}/git/matching-refs/${namespace}/${encodePath(first)}`); } catch (error) { if ([404, 409, 422].includes(error.status)) continue; throw error; } // An empty repository or missing namespace is not fatal.
      for (const item of Array.isArray(refs) ? refs : []) { const name = String(item.ref || '').replace(`refs/${namespace}/`, ''); const parts = name.split('/'); if (parts.length <= tail.length && parts.every((part, index) => tail[index] === part)) candidates.push({ ref: name, kind, segments: parts.length }); } // Keep refs that exactly prefix the URL path.
      if (candidates.some(item => item.kind === 'branch')) break; // A matching branch makes the tag lookup unnecessary.
    } // End ref listing.
    candidates.sort((a, b) => b.segments - a.segments || (a.kind === 'branch' ? -1 : 1)); // Prefer the longest matching name.
    for (const candidate of candidates.slice(0, 3)) { try { return { ...candidate, commit: await this.get(`${route}/commits/${encodeURIComponent(candidate.ref)}`) }; } catch (error) { if (![404, 422].includes(error.status)) throw error; } } // Resolve the chosen ref to one commit.
    for (let count = Math.min(tail.length, 6); count >= 1; count--) { const name = tail.slice(0, count).join('/'); if (candidates.some(item => item.ref === name)) continue; try { return { ref: name, kind: 'ref', segments: count, commit: await this.get(`${route}/commits/${encodeURIComponent(name)}`) }; } catch (error) { if (![404, 422].includes(error.status)) throw error; } } // Fall back to bounded probing for refs the listing did not return.
    throw new AppError(404, `No branch, tag, or commit named "${first}" was found. Check the URL or enter the branch under Options.`); // Explain unsupported or missing references.
  } // End tree-ref resolution.
  /**
   * Read the full tree of one commit. GitHub truncates recursive listings of very large trees; when that happens,
   * recoverTree() lists the requested scope subtree by subtree. `incomplete` stays true if anything was left out.
   */
  async readTree(route, rootSha, scope = '') {
    const first = await this.get(`${route}/git/trees/${rootSha}?recursive=1`); this.stats.treeRequests++;
    const tree = { found: new Map(), incomplete: false, recovered: false, allowance: 0 };
    for (const entry of first.tree || []) addTreeEntry(tree.found, entry, '');
    if (first.truncated) {
      tree.recovered = true;
      // Recovery budget: never spend the requests a hosted analysis needs for its files.
      tree.allowance = Number.isFinite(this.maxRequests) ? Math.min(this.maxTreeRequests, Math.floor((this.maxRequests - this.requests) / 3)) : this.maxTreeRequests;
      await this.recoverTree(route, rootSha, scope, tree);
    }
    tree.entries = [...tree.found.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return tree;
  }
  /**
   * List `scope` completely after a truncated recursive listing: walk to it one level at a time (keeping each level's
   * direct entries, which include project manifests), then list it recursively where GitHub allows and one level at a
   * time where it does not. Bounded by tree.allowance requests and MAX_TREE_ENTRIES entries.
   */
  async recoverTree(route, rootSha, scope, tree) {
    tree.listings ||= new Map(); // Identical folders share one tree SHA; list each SHA once.
    const list = async (sha, recursive) => { // One extra tree listing, or null when the allowance is spent.
      const key = `${sha}|${recursive}`;
      if (tree.listings.has(key)) return tree.listings.get(key);
      if (tree.allowance <= 0) return null;
      tree.allowance--; this.stats.treeRequests++;
      const listing = await this.get(`${route}/git/trees/${sha}${recursive ? '?recursive=1' : ''}`);
      tree.listings.set(key, listing);
      return listing;
    };
    try {
      let sha = rootSha; let prefix = '';
      for (const segment of scope ? scope.split('/') : []) {
        const level = await list(sha, false);
        if (!level) { tree.incomplete = true; return; }
        const direct = (level.tree || []).filter(entry => !entry.path.includes('/'));
        direct.forEach(entry => addTreeEntry(tree.found, entry, prefix));
        const next = direct.find(entry => entry.path === segment);
        if (!next || next.type !== 'tree') return; // A file (or a missing name) ends the walk; snapshot() decides what it means.
        sha = next.sha; prefix = prefix ? `${prefix}/${segment}` : segment;
      }
      // The root is already known to be truncated, so it starts one level at a time; other folders try a recursive listing first.
      const queue = [{ sha, prefix, truncated: sha === rootSha, ancestors: [sha] }]; // `ancestors` guards against cycles, which real Git trees cannot contain.
      while (queue.length) {
        if (tree.found.size >= MAX_TREE_ENTRIES) { tree.incomplete = true; return; }
        const folder = queue.shift();
        if (!folder.truncated) {
          const deep = await list(folder.sha, true);
          if (!deep) { tree.incomplete = true; return; }
          if (!deep.truncated) { (deep.tree || []).forEach(entry => addTreeEntry(tree.found, entry, folder.prefix)); continue; }
        }
        const level = await list(folder.sha, false);
        if (!level) { tree.incomplete = true; return; }
        for (const entry of (level.tree || []).filter(item => !item.path.includes('/'))) {
          addTreeEntry(tree.found, entry, folder.prefix);
          if (entry.type === 'tree' && !folder.ancestors.includes(entry.sha)) queue.push({ sha: entry.sha, prefix: folder.prefix ? `${folder.prefix}/${entry.path}` : entry.path, truncated: false, ancestors: [...folder.ancestors, entry.sha] });
        }
      }
    } catch (error) {
      if (error.status === 408 || this.signal?.aborted) throw error; // Cancellation still cancels.
      tree.incomplete = true; // Any other failure keeps what was listed and reports the tree as partial.
    }
  }
  async snapshot(target, { ref = '', scope = '', suppliedToken = false } = {}) { // Resolve a repository target to one immutable commit.
    const route = `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}`; // Build the validated API repository prefix.
    const metadata = await this.get(route); // Read visibility and the default branch.
    if (metadata.private && !suppliedToken) throw new AppError(403, 'This repository is private. Only public repositories can be analyzed on this site; use the command-line tool with your own GITHUB_TOKEN for private code.'); // Never publish private repositories through a server-wide token.
    let revision = String(ref).trim() || metadata.default_branch; let selectedScope = normalizeScope(scope); let commit; let refKind = ref ? 'explicit' : 'default'; // Initialize explicit or default scope selection.
    if (!ref && target.tail.length) { // Resolve tree/blob URLs whose refs may contain slashes.
      const resolved = await this.resolveTreeRef(route, target.tail); revision = resolved.ref; commit = resolved.commit; refKind = resolved.kind; selectedScope ||= normalizeScope(target.tail.slice(resolved.segments).join('/')); // Split the URL into ref and path.
    } else { // Resolve a plain repository or an explicitly chosen branch.
      if (target.tail.length && !selectedScope) { const prefix = String(ref).split('/'); if (prefix.every((part, index) => target.tail[index] === part)) selectedScope = normalizeScope(target.tail.slice(prefix.length).join('/')); } // Preserve a supplied URL folder when it matches the explicit reference.
      commit = await this.get(`${route}/commits/${encodeURIComponent(revision)}`); // Resolve exactly one commit before reading its tree.
      if (refKind === 'explicit' && commit.sha?.startsWith(revision.toLowerCase())) refKind = 'commit'; // Record that the visitor pinned a commit.
    } // End revision selection.
    const tree = await this.readTree(route, commit.commit.tree.sha, selectedScope); // Fetch the immutable repository tree, recovering subtrees when GitHub truncates it.
    let all = tree.entries; // Compact factual metadata: path, type, size, blob SHA, mode.
    let focus = ''; const focused = selectedScope && all.find(entry => entry.path === selectedScope); // A blob URL selects a file to open, not a one-file analysis.
    if (focused?.type === 'blob') { focus = selectedScope; const parts = selectedScope.split('/').slice(0, -1); selectedScope = parts.join('/'); for (let depth = parts.length; depth >= 0; depth--) { const folder = parts.slice(0, depth).join('/'); if (all.some(entry => entry.type === 'blob' && PROJECT_MARKER.test(entry.path) && entry.path.split('/').slice(0, -1).join('/') === folder)) { selectedScope = folder; break; } } } // Analyze the file inside its nearest project folder (manifest), else its own folder.
    if (tree.recovered && focus && selectedScope !== focus) { await this.recoverTree(route, commit.commit.tree.sha, selectedScope, tree); all = [...tree.found.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)); } // A file URL moved the scope to its project folder: list that folder too.
    const scoped = all.filter(entry => !selectedScope || entry.path === selectedScope || entry.path.startsWith(`${selectedScope}/`)); // Restrict analysis and browsing to the requested scope.
    if (selectedScope && !scoped.length) throw new AppError(404, `"${selectedScope}" does not exist at ${revision}. Check the folder name or choose another branch.`); // Reject empty or mistyped scopes.
    const entries = retainEntries(scoped, MAX_RETAINED_ENTRIES); // Bound retained tree size; keep shallow levels first so large repositories still show their whole top-level structure.
    return { route, owner: target.owner, repo: target.repo, fullName: metadata.full_name, description: metadata.description || '', private: metadata.private, branch: revision, refKind, defaultBranch: metadata.default_branch, sha: commit.sha, scope: selectedScope, focus, entries, treeTruncated: tree.incomplete || scoped.length > entries.length, treeRecovered: tree.recovered, listedEntries: scoped.length, htmlUrl: `https://github.com/${metadata.full_name}`, committedAt: commit.commit.committer?.date ?? null }; // Report truncation explicitly.
  } // End immutable snapshot construction.
  async blob(snapshot, entry) { // Fetch and verify one small textual Git blob.
    if (this.rawEligible(snapshot)) { // Raw reads apply only to public repositories pinned to a full commit SHA.
      const file = await this.rawBlob(snapshot, entry); // Returns null when the API should be used instead.
      if (file) return file;
      this.stats.rawFallbacks++; // The verified API read below replaces a failed or unverifiable raw read.
    }
    return this.apiBlob(snapshot, entry);
  }
  rawEligible(snapshot) { return Boolean(this.raw) && !snapshot.private && this.rawFailures < RAW_FAILURE_LIMIT && /^[0-9a-f]{40}$/.test(snapshot.sha || ''); } // Public, commit-pinned, and the circuit breaker has not tripped.
  async rawBlob(snapshot, entry) { // One raw read at the commit; verified against the Git blob SHA, never sent with credentials.
    const url = `https://${RAW_HOST}/${encodeURIComponent(snapshot.owner)}/${encodeURIComponent(snapshot.repo)}/${snapshot.sha}/${encodePath(entry.path)}`; // Commit-pinned: the content cannot drift with a branch.
    this.budget(); this.stats.raw++; // Raw reads count toward the hosted request budget too.
    const signal = this.signal ? AbortSignal.any([this.signal, AbortSignal.timeout(RAW_TIMEOUT_MS)]) : AbortSignal.timeout(RAW_TIMEOUT_MS); // Whole-run and per-request deadlines.
    let response;
    try { response = await this.fetchImpl(url, { headers: { 'User-Agent': `GitArchitectureDiagram/${VERSION}` }, signal, redirect: 'manual' }); } // No Authorization header: raw reads are for public content only.
    catch (error) { if (this.signal?.aborted) throw new AppError(408, 'GitHub reading was cancelled.'); this.rawFailures++; return null; } // A network failure falls back to the API.
    if (response.status !== 200) { await response.body?.cancel().catch(() => {}); this.rawFailures++; return null; } // Redirects, 404s, and rate limits fall back to the API.
    let bytes;
    try { bytes = await boundedBytes(response, MAX_BLOB_BYTES); }
    catch (error) { if (error.status === 413) throw new AppError(413, 'Binary or oversized file excluded from text analysis.'); this.rawFailures++; return null; } // Oversized content is excluded exactly as on the API path.
    if (bytes.includes(0)) throw new AppError(413, 'Binary or oversized file excluded from text analysis.'); // NUL bytes mean binary content.
    if (gitBlobSha(bytes) !== entry.sha) { this.rawFailures++; return null; } // Unverifiable content is never used; the API read decides.
    this.rawFailures = 0; // A verified read resets the circuit breaker.
    return { path: entry.path, sha: entry.sha, content: bytes.toString('utf8'), size: bytes.length };
  }
  async apiBlob(snapshot, entry) { // The REST blob endpoint: base64 content addressed by the immutable blob SHA.
    const data = await this.get(`${snapshot.route}/git/blobs/${entry.sha}`); // Avoid branch drift by using the immutable blob SHA.
    if (data.encoding !== 'base64') throw new AppError(422, 'Unsupported GitHub blob encoding.'); // Require a predictable byte representation.
    const bytes = Buffer.from(data.content, 'base64'); // Decode the exact stored bytes.
    if (bytes.length > MAX_BLOB_BYTES || bytes.includes(0)) throw new AppError(413, 'Binary or oversized file excluded from text analysis.'); // Avoid binary payloads and large text reads.
    const sha = gitBlobSha(bytes); // Recreate the Git object identity.
    if (sha !== entry.sha) throw new AppError(502, 'GitHub blob integrity verification failed.'); // Refuse inconsistent evidence.
    return { path: entry.path, sha, content: bytes.toString('utf8'), size: bytes.length }; // Return evidence without any credential fields.
  } // End verified blob reading.
} // End the GitHub reader.
const PERIPHERAL = /(^|\/)(examples?|samples?|demos?|benchmarks?|bench|fixtures?|tests?|__tests__|spec|e2e|testdata|vendor[s]?|third[_-]?party)\//i; // Folders that illustrate or test the core rather than define it.
export function priorityScore(path, { scope = '', focus = '', peripheralPenalty = true } = {}) { // Rank a candidate before any content is read.
  const relative = scope && path.startsWith(`${scope}/`) ? path.slice(scope.length + 1) : path; const depth = relative.split('/').length; const name = relative.split('/').pop(); // Score relative to the analyzed scope.
  let score = 0; // Accumulate transparent, path-only hints.
  if (path === focus) score += 1000; // A file opened from a blob URL is always read first.
  if (/^readme(\.[a-z]+)?$/i.test(name)) score += depth === 1 ? 85 : 25; // The scope's own README explains the project; nested ones explain parts.
  if (/^(package\.json|platformio\.ini|pyproject\.toml|Cargo\.toml|go\.mod|CMakeLists\.txt|setup\.py|pom\.xml|build\.gradle(\.kts)?|composer\.json|Gemfile|library\.(json|properties))$/i.test(name)) score += depth === 1 ? 75 : 40; // Manifests declare entry points and dependencies.
  if (/^(main|app|server|cli|__main__)\.[a-z]+$/i.test(name)) score += 45; else if (/^index\.[a-z]+$/i.test(name)) score += depth <= 2 ? 30 : 8; // Entry names; nested index files are usually module barrels.
  if (/architecture|design|implementation|wiring|connection-diagram|system-diagram|overview/i.test(relative)) score += 35; // Explanatory documents.
  if (/\.(c|cc|cpp|h|hpp|ino|py|[cm]?[jt]sx?|go|rs|java|kt|cs|swift|rb|php)$/i.test(name)) score += 20; // Source code.
  if (peripheralPenalty && PERIPHERAL.test(relative)) score -= 45; // Prefer the core when the scope also contains examples and tests.
  return score - depth * 2; // Mildly prefer shallow files.
} // End path scoring.
export function selectFiles(snapshot, maxFiles = 32) { // Select a bounded, distributed sample of code and documentation.
  const candidates = snapshot.entries.filter(entry => entry.type === 'blob' && entry.mode !== '120000' && entry.size <= 96000 && safeTextPath(entry.path)); // Skip symlinks, secrets, binaries, and large files.
  const scope = snapshot.scope || ''; const core = candidates.filter(entry => /\.(c|cc|cpp|h|hpp|ino|py|[cm]?[jt]sx?|go|rs|java|kt|cs|swift|rb|php)$/i.test(entry.path) && !PERIPHERAL.test(scope ? entry.path.slice(scope.length + 1) : entry.path)).length; // Count code outside examples and tests.
  const options = { scope, focus: snapshot.focus || '', peripheralPenalty: core >= 3 }; // Only demote examples when a core exists to read instead.
  const ranked = candidates.map(entry => { const relative = scope ? entry.path.slice(scope.length + 1) : entry.path; return { ...entry, score: priorityScore(entry.path, options), anchor: !relative.includes('/') && (/^readme(\.[a-z]+)?$/i.test(relative) || PROJECT_MARKER.test(relative)) }; }); // Scope-root README and manifests never compete for folder diversity.
  return { selected: pickDiverse(ranked, maxFiles), eligible: candidates.length, ranked }; // Expose the selection denominator for coverage reporting.
} // End source selection.
function directoryOf(path) { return path.split('/').slice(0, -1).join('/'); } // Group candidates by parent folder.
function pickDiverse(ranked, count, counts = new Map(), boosts = new Map()) { // Pick the best candidates while stopping one folder from consuming the budget.
  const remaining = [...ranked]; const chosen = []; // Work on a copy so callers can reuse the ranking.
  const value = entry => entry.score + (boosts.get(entry.path) || 0) - (entry.anchor ? 0 : (counts.get(directoryOf(entry.path)) || 0) * (boosts.get(entry.path) ? 10 : 18)); // Referenced files tolerate more siblings; root anchors are exempt.
  while (remaining.length && chosen.length < count) { remaining.sort((a, b) => value(b) - value(a) || a.path.localeCompare(b.path)); const entry = remaining.shift(); chosen.push(entry); counts.set(directoryOf(entry.path), (counts.get(directoryOf(entry.path)) || 0) + 1); } // Greedy selection with a diversity penalty.
  return chosen; // Return in reading order.
} // End diverse selection.
/**
 * Read up to `maxFiles` files, following references discovered in files already read.
 * Selection is strictly sequential (each choice sees the imports found so far), so the same commit and options always
 * select the same files. For speed, when reads are cheap (public repository, raw reads on, no hosted request budget),
 * the next `concurrency` most likely candidates are fetched ahead of time. A prefetched file that is never selected is
 * discarded and counted in coverage.requests.prefetchUnused; it never affects the report.
 */
export async function ingest(snapshot, reader, maxFiles, progress = () => {}, { discover, concurrency = INGEST_CONCURRENCY } = {}) {
  const selection = selectFiles(snapshot, maxFiles); const files = []; const skipped = []; let bytes = 0; // Actual evidence and skip accounting.
  const pool = new Map(selection.ranked.map(entry => [entry.path, entry])); const boosts = new Map(); const counts = new Map(); const reasons = new Map(); // Candidates, discovered priority, and why each file was chosen.
  const next = () => pickDiverse([...pool.values()], 1, new Map(counts), boosts)[0]; // The single best remaining candidate.
  const width = Math.max(1, Math.min(8, Number(concurrency) || 1)); // At most eight reads in flight.
  const prefetch = width > 1 && typeof reader.rawEligible === 'function' && !snapshot.private && !Number.isFinite(reader.maxRequests ?? Infinity); // Never spend a hosted budget or API quota on speculation.
  const inflight = new Map(); // path → settled-result promise for reads started ahead of selection.
  const settle = promise => promise.then(value => (value ? { value } : { miss: true }), error => ({ error })); // Never leaves an unhandled rejection.
  const topUp = () => { // Keep the best remaining candidates in flight. Prefetch uses raw reads only, never the API.
    if (!prefetch || !reader.rawEligible(snapshot)) return;
    for (const entry of pickDiverse([...pool.values()], width, new Map(counts), boosts)) if (!inflight.has(entry.path) && entry.size + bytes <= 900000) inflight.set(entry.path, settle(reader.rawBlob(snapshot, entry)));
  };
  const read = async entry => { // A prefetched raw result when there is one; otherwise the normal raw-then-API read.
    const early = inflight.get(entry.path); inflight.delete(entry.path);
    if (!early) return settle(reader.blob(snapshot, entry));
    const outcome = await early;
    if (!outcome.miss) return outcome;
    reader.stats.rawFallbacks++; // The raw read failed or could not be verified; the API decides.
    return settle(reader.apiBlob(snapshot, entry));
  };
  while (files.length + skipped.length < maxFiles && pool.size) { // Fill the requested file budget.
    topUp();
    const entry = next(); pool.delete(entry.path); counts.set(directoryOf(entry.path), (counts.get(directoryOf(entry.path)) || 0) + 1); // Claim the candidate.
    if (bytes + entry.size > 900000) { skipped.push({ path: entry.path, reason: 'Total byte budget' }); inflight.delete(entry.path); continue; } // Keep memory and downstream model input bounded.
    progress({ stage: 'Reading source', detail: entry.path, read: files.length, total: maxFiles }); // Honest file-reading progress.
    const outcome = await read(entry);
    if (outcome.value) {
      const file = outcome.value; bytes += file.size;
      file.reason = reasons.get(entry.path) || (entry.path === snapshot.focus ? 'Opened from the URL' : 'Ranked by path');
      files.push(file);
      if (discover) for (const hint of discover(file, snapshot) || []) { // Follow imports and manifest entry points from verified content.
        if (!pool.has(hint.path)) continue;
        boosts.set(hint.path, Math.max(boosts.get(hint.path) || 0, hint.weight));
        if (!reasons.has(hint.path)) reasons.set(hint.path, hint.reason);
      }
      continue;
    }
    const error = outcome.error;
    if ([401, 403, 408, 429].includes(error.status)) { // Upstream limits end reading; partial evidence is kept.
      const rest = pickDiverse([...pool.values()], Math.max(0, maxFiles - files.length - skipped.length - 1), new Map(counts), boosts);
      skipped.push({ path: entry.path, reason: error.message }, ...rest.map(item => ({ path: item.path, reason: error.message })));
      break;
    }
    skipped.push({ path: entry.path, reason: error.message });
  }
  const requests = reader.stats ? { ...reader.stats, prefetchUnused: inflight.size } : null; // Measured GitHub requests: API calls, raw reads, raw-to-API fallbacks, tree listings, unused prefetches.
  return { files, coverage: { readFiles: files.length, eligibleFiles: selection.eligible, listedFiles: snapshot.entries.filter(entry => entry.type === 'blob').length, maxFiles, bytes, treeTruncated: snapshot.treeTruncated, treeRecovered: Boolean(snapshot.treeRecovered), skipped, unsampledFiles: Math.max(0, selection.eligible - files.length), followedReferences: files.filter(file => /^(Imported|Declared|Built)/.test(file.reason)).length, rateLimit: reader.rateLimit || null, requests } }; // Describe exactly what the analyzer saw.
} // End ingestion.
