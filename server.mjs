// Project: Git Architecture Diagram | Component: HTTP server | Author: Amine Saoud ibn al-Bashir.
// Features: same-origin API, streamed progress, bundled browser modules, bounded analysis, and secure defaults.
import http from 'node:http'; // Serve the application without an additional web framework.
import { readFile } from 'node:fs/promises'; // Read allowlisted static assets.
import path from 'node:path'; // Resolve static files within fixed roots.
import { fileURLToPath } from 'node:url'; // Resolve the application directory independently of the working directory.
import { timingSafeEqual } from 'node:crypto'; // Compare an optional instance access password safely.
import { AppError } from './src/github.mjs'; // Reuse user-facing HTTP errors.
import { runAnalysis, getSession } from './src/service.mjs'; // Expose the same analysis pipeline used by the CLI.
import { searchEvidence } from './src/genius.mjs'; // Provide source-backed questions without an AI dependency.
const ROOT = path.dirname(fileURLToPath(import.meta.url)); const rates = new Map(); let active = 0; // Scope assets and bound process-level resource usage.
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }; // Define static content types explicitly.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"; // Keep repository content from loading arbitrary scripts or remote assets.
function json(response, status, data) { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data)); } // Return compact uncached API responses.
async function body(request) { let text = ''; for await (const chunk of request) { text += chunk; if (Buffer.byteLength(text) > 20000) throw new AppError(413, 'The request is too large.'); } try { return JSON.parse(text); } catch { throw new AppError(400, 'Expected a JSON request.'); } } // Bound and parse incoming JSON.
function authorized(request) { const expected = process.env.GENIUS_ACCESS_TOKEN; if (!expected) return false; const actual = String(request.headers['x-instance-token'] || ''); const a = Buffer.from(expected); const b = Buffer.from(actual); return a.length === b.length && timingSafeEqual(a, b); } // Protect an optional shared deployment and its provider key.
function guard(request) { // Validate browser origin, deployment access, and request frequency.
  const expectedOrigin = process.env.PUBLIC_ORIGIN || `http://${request.headers.host}`; if (request.headers.origin && request.headers.origin !== expectedOrigin) throw new AppError(403, 'This API accepts same-origin requests only.'); // Prevent cross-origin use of local credentials.
  if (process.env.GENIUS_ACCESS_TOKEN && !authorized(request)) throw new AppError(401, 'Enter the instance access password in Settings.'); // Enforce configured instance access.
  const now = Date.now(); const ip = request.socket.remoteAddress || 'unknown'; const current = rates.get(ip); if (rates.size > 5000) rates.clear(); // Bound the in-memory limiter.
  const item = current && current.until > now ? current : { count: 0, until: now + 60000 }; item.count++; rates.set(ip, item); if (item.count > 20) throw new AppError(429, 'Too many requests. Please wait a minute.'); // Limit expensive endpoint calls per direct client address.
} // End API request admission.
async function staticAsset(url, response, method) { // Serve only public files and explicitly approved dependency distributions.
  let base = path.join(ROOT, 'public'); let relative = url.pathname.slice(1); // Default to the application public directory.
  const vendors = { '/vendor/mermaid/': 'mermaid/dist', '/vendor/dompurify/': 'dompurify/dist', '/vendor/marked/': 'marked/lib', '/vendor/fflate/': 'fflate/esm' }; // Restrict browser dependencies to known distribution roots.
  const vendor = Object.keys(vendors).find(prefix => url.pathname.startsWith(prefix)); // Detect an approved browser-module URL.
  if (vendor) { base = path.join(ROOT, 'node_modules', vendors[vendor]); relative = url.pathname.slice(vendor.length); } // Resolve dependency assets under their distribution directory.
  else if (relative === '' || /^[\w.-]+\/[\w.-]+(?:\/(?:tree|blob)\/.*)?\/?$/.test(relative)) relative = 'index.html'; // Serve repository names and scoped file URLs even when they contain dots.
  try { relative = decodeURIComponent(relative); } catch { throw new AppError(400, 'Invalid asset path.'); } // Decode once before containment checking.
  const file = path.resolve(base, relative); if (!file.startsWith(base + path.sep) || relative.includes('\\') || !MIME[path.extname(file)]) throw new AppError(404, 'Asset not found.'); // Prevent arbitrary filesystem reads and directory listing.
  let data; try { data = await readFile(file); } catch { throw new AppError(404, 'Asset not found.'); } // Return a predictable missing-file response.
  response.writeHead(200, { 'Content-Type': MIME[path.extname(file)], 'Cache-Control': vendor ? 'public, max-age=86400' : 'no-cache' }); response.end(method === 'HEAD' ? undefined : data); // Cache immutable installed dependencies more aggressively than application files.
} // End static asset serving.
export function createAppServer() { // Export the actual server for integration tests.
  return http.createServer(async (request, response) => { // Handle the small application API and its frontend.
    response.setHeader('Content-Security-Policy', CSP); response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Referrer-Policy', 'no-referrer'); response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); // Apply browser protections before every response.
    try { // Convert all request failures into bounded user-facing errors.
      const url = new URL(request.url, 'http://localhost'); // Parse routing independently of an untrusted Host header.
      if (url.pathname === '/api/health' && request.method === 'GET') return json(response, 200, { ok: true, version: '0.1.0', aiAvailable: Boolean(process.env.OPENAI_API_KEY && process.env.GENIUS_MODEL && process.env.GENIUS_ACCESS_TOKEN), accessRequired: Boolean(process.env.GENIUS_ACCESS_TOKEN) }); // Expose capability state without secrets.
      if (url.pathname.startsWith('/api/')) { // Admit only the documented same-origin API operations.
        if (request.method !== 'POST') throw new AppError(405, 'Use POST for this API endpoint.'); guard(request); // Require bounded authenticated browser actions where configured.
        if (!String(request.headers['content-type'] || '').startsWith('application/json')) throw new AppError(415, 'Use application/json.'); const input = await body(request); // Reject cross-site form submissions and oversized bodies.
        if (url.pathname === '/api/ask') { const result = getSession(input.id); const question = String(input.question || '').slice(0, 600); return json(response, 200, { mode: 'evidence-search', matches: searchEvidence(result, question), explanation: 'These are matching lines from the files Genius actually read. They are source evidence, not a generated answer.' }); } // Keep the no-model question mode truthful.
        if (url.pathname !== '/api/analyze') throw new AppError(404, 'API endpoint not found.'); // Reject undocumented operations.
        if (active >= 3) throw new AppError(429, 'The analyzer is busy. Please try again shortly.'); active++; // Bound concurrent GitHub and model work.
        const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 180000); response.on('close', () => { if (!response.writableEnded) controller.abort(); }); // Cancel work when the browser leaves or the run deadline expires.
        response.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' }); // Stream progress without buffering it behind a proxy.
        const emit = data => { if (!response.destroyed) response.write(JSON.stringify(data) + '\n'); }; // Write one complete progress event per line.
        try { const result = await runAnalysis(input, { signal: controller.signal, progress: event => emit({ type: 'progress', ...event }), allowEnvAI: authorized(request) }); emit({ type: 'result', result }); } catch (error) { emit({ type: 'error', message: error instanceof AppError ? error.message : 'Analysis failed unexpectedly. Please try again.', status: error.status || 500 }); } finally { active--; clearTimeout(timer); response.end(); } // Preserve completion, error, and resource-release behavior.
        return; // Finish the streamed analysis response.
      } // End API routing.
      if (!['GET', 'HEAD'].includes(request.method)) throw new AppError(405, 'Method not allowed.'); await staticAsset(url, response, request.method); // Serve the regular browser application.
    } catch (error) { if (!response.headersSent) json(response, error.status || 500, { error: error instanceof AppError ? error.message : 'The request could not be completed.' }); else response.end(); } // Avoid exposing stack traces or credentials.
  }); // Return the configured server instance.
} // End application server construction.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { const port = Number(process.env.PORT || 3000); const host = process.env.HOST || '127.0.0.1'; createAppServer().listen(port, host, () => console.log(`Git Architecture Diagram is running at http://${host}:${port}`)); } // Start directly while keeping imports side-effect free for tests.
