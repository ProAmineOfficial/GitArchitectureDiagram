// Deterministic GitHub contract fixture; no network access or real credentials are needed.
import { createHash } from 'node:crypto'; // Generate real Git blob identities for integrity tests.
export const commitSHA = 'a'.repeat(40); export const treeSHA = 'b'.repeat(40); // Pin fixture metadata to stable object identities.
export const sources = { 'README.md': '# Demo\nA small repository.\n```mermaid\nflowchart TD\nA --> B\n```\n', 'package.json': '{"type":"module"}', 'src/main.js': '// import fake from "./missing.js";\nimport { helper } from "./helper.js";\nhelper();\n', 'src/helper.js': 'export const helper = () => "ready";\n', 'docs/guide.md': '# Guide\nStart at src/main.js.\n', 'LICENSE': 'MIT\n' }; // Include source, documentation, and a real authored diagram.
export const files = Object.entries(sources).map(([path, content]) => { const bytes = Buffer.from(content); return { path, content, size: bytes.length, sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') }; }); // Compute exact blob metadata from fixture bytes.
export const entries = [{ path: 'src', type: 'tree', mode: '040000', sha: treeSHA }, { path: 'docs', type: 'tree', mode: '040000', sha: treeSHA }, ...files.map(({ path, size, sha }) => ({ path, size, sha, type: 'blob', mode: '100644' }))]; // Supply a realistic recursive Git tree.
export function githubFixture({ privateRepo = false, name = 'demo', allowedRefs = ['main', 'feature/ui', commitSHA], truncated = false } = {}) { // Create an independently inspectable mock transport.
  const requests = []; const route = `/repos/acme/${name}`; // Record every upstream request without exposing any real service credentials.
  const fetchImpl = async (url, options = {}) => { requests.push({ url, options }); const parsed = new URL(url); let data; // Dispatch only the documented GitHub routes.
    if (parsed.pathname === route) data = { full_name: `acme/${name}`, default_branch: 'main', private: privateRepo, description: 'Fixture project' }; // Return repository metadata.
    else if (parsed.pathname.startsWith(`${route}/commits/`) && allowedRefs.includes(decodeURIComponent(parsed.pathname.slice(`${route}/commits/`.length)))) data = { sha: commitSHA, commit: { tree: { sha: treeSHA }, committer: { date: '2026-01-01T00:00:00Z' } } }; // Resolve allowed refs to an immutable commit.
    else if (parsed.pathname === `${route}/git/trees/${treeSHA}`) data = { tree: entries, truncated }; // Return an explicitly scoped tree contract.
    else if (parsed.pathname.startsWith(`${route}/git/blobs/`)) { const file = files.find(item => item.sha === parsed.pathname.split('/').pop()); if (file) data = { encoding: 'base64', content: Buffer.from(file.content).toString('base64') }; } // Supply exact verified blob bytes.
    return Response.json(data || { message: 'Not Found' }, { status: data ? 200 : 404 }); // Use real Fetch Response objects for contract fidelity.
  }; // End mock transport.
  return { fetchImpl, requests }; // Expose assertions without requiring a live service.
} // End fixture construction.
