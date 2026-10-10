// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-PROVENANCE-CORE-001
// Project: Git Architecture Diagram | Component: Analysis store (memory and file adapters).
// Saved analyses are immutable: each key names one repository, commit, scope, file budget, and analyzer version, so a
// saved entry never describes different code. Only public-repository results are ever stored, and never credentials.

/**
 * The store contract used by the analysis service:
 *   get(key) → value | null      put(key, value) → void      delete(key) → void      describe() → { kind, entries }
 * Implementations must tolerate failures by behaving like a cache miss; the service never depends on a store.
 */

/** In-process store with a time limit and an entry limit. Used on hosts without a writable disk, and in tests. */
export function createMemoryStore({ ttlMs = 10 * 60 * 1000, maxEntries = 12 } = {}) {
  const items = new Map(); // key → { value, expires }; Map order is insertion order, used for eviction.
  const prune = () => {
    const now = Date.now();
    for (const [key, item] of items) if (item.expires < now) items.delete(key);
    while (items.size > maxEntries) items.delete(items.keys().next().value);
  };
  return {
    kind: 'memory',
    async get(key) {
      const item = items.get(key);
      if (!item) return null;
      if (item.expires < Date.now()) { items.delete(key); return null; }
      return structuredClone(item.value); // Callers may modify what they receive.
    },
    async put(key, value) {
      items.delete(key); // Re-inserting moves the key to the newest position.
      items.set(key, { value: structuredClone(value), expires: Date.now() + ttlMs });
      prune();
    },
    async delete(key) { items.delete(key); },
    describe() { prune(); return { kind: 'memory', entries: items.size }; },
  };
}

/**
 * Durable store: one JSON file per entry in `dir`, named by the SHA-256 of its key, written atomically (temporary file
 * and rename). Bounded by entry count, total bytes, per-entry bytes, and age; the oldest entries are removed first.
 * The directory is never served over HTTP. Any filesystem error turns into a miss, never a failed analysis.
 */
export async function createFileStore({ dir, ttlMs = 7 * 24 * 60 * 60 * 1000, maxEntries = 400, maxBytes = 300 * 1024 * 1024, maxEntryBytes = 4 * 1024 * 1024, version = 1 } = {}) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const { createHash, randomUUID } = await import('node:crypto');
  await fs.mkdir(dir, { recursive: true, mode: 0o700 }); // Fails early (and the caller falls back to memory) when the disk is not writable.
  const probe = path.join(dir, `.probe-${randomUUID()}`);
  await fs.writeFile(probe, 'ok'); await fs.rm(probe, { force: true }); // Prove that writes work before promising persistence.
  const fileOf = key => path.join(dir, `${createHash('sha256').update(String(key)).digest('hex')}.json`);
  let writes = 0;
  const stats = { hits: 0, misses: 0, writes: 0, skipped: 0, errors: 0 };

  /** Remove expired entries, then the oldest ones beyond the entry and byte limits. */
  async function cleanup() {
    const names = (await fs.readdir(dir)).filter(name => /^[0-9a-f]{64}\.json$/.test(name));
    const files = [];
    for (const name of names) {
      try { const info = await fs.stat(path.join(dir, name)); files.push({ name, size: info.size, time: info.mtimeMs }); } catch { /* Removed concurrently. */ }
    }
    files.sort((a, b) => a.time - b.time); // Oldest first.
    let total = files.reduce((sum, file) => sum + file.size, 0); let remaining = files.length;
    const now = Date.now();
    for (const file of files) {
      const expired = file.time + ttlMs < now;
      if (!expired && remaining <= maxEntries && total <= maxBytes) break;
      await fs.rm(path.join(dir, file.name), { force: true });
      total -= file.size; remaining--; // Track the shrinking set without re-reading the directory.
    }
  }

  return {
    kind: 'file',
    async get(key) {
      try {
        const record = JSON.parse(await fs.readFile(fileOf(key), 'utf8'));
        if (record.version !== version || record.key !== key || record.expires < Date.now()) { stats.misses++; return null; } // Wrong format, a hash collision, or too old.
        stats.hits++;
        return record.value;
      } catch (error) {
        if (error.code !== 'ENOENT') stats.errors++;
        stats.misses++;
        return null;
      }
    },
    async put(key, value) {
      try {
        const text = JSON.stringify({ version, key, expires: Date.now() + ttlMs, value });
        if (Buffer.byteLength(text) > maxEntryBytes) { stats.skipped++; return; } // Very large results stay in memory only.
        const target = fileOf(key); const temporary = `${target}.${randomUUID()}.tmp`;
        await fs.writeFile(temporary, text, { mode: 0o600 });
        await fs.rename(temporary, target); // Atomic replace: readers see the old or the new entry, never half of one.
        stats.writes++;
        if (++writes % 20 === 1) await cleanup(); // Bound disk use without scanning on every write.
      } catch { stats.errors++; }
    },
    async delete(key) { try { await fs.rm(fileOf(key), { force: true }); } catch { stats.errors++; } },
    async cleanup() { try { await cleanup(); } catch { stats.errors++; } },
    describe() { return { kind: 'file', ...stats }; },
  };
}

/**
 * Choose the analysis store for the Node server: a file store in GAD_CACHE_DIR (default `<root>/.cache/analysis`), or
 * memory when GAD_CACHE_DIR is "off" or the directory is not writable. Never throws.
 */
export async function defaultAnalysisStore({ root, env = process.env, log = () => {} } = {}) {
  const setting = String(env.GAD_CACHE_DIR ?? '').trim();
  if (setting.toLowerCase() === 'off') return createMemoryStore();
  const path = await import('node:path');
  const dir = setting ? path.resolve(setting) : path.join(root, '.cache', 'analysis');
  try { return await createFileStore({ dir }); }
  catch (error) { log(`Analysis cache: using memory (the cache folder is not writable: ${error.code || 'error'}).`); return createMemoryStore(); } // Report only an error code, never paths or environment values.
}
