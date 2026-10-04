// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-PROVENANCE-CORE-001
// Project: Git Architecture Diagram | Script: download the official brand images into public/assets/brand/ | Author: Amine Saoud ibn al-Bashir.
// Run once on a machine that can reach proamine.tech, review the files, and commit them:
//   node scripts/fetch-brand-assets.mjs            # download only missing files
//   node scripts/fetch-brand-assets.mjs --force    # replace existing files
// The site never hotlinks these images; until a file exists, its footer card shows a labeled fallback. The provenance
// of every file is recorded in docs/BRAND.md. Images are saved exactly as published (no recompression).
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'public', 'assets', 'brand');
export const ASSETS = [
  { file: 'git-architecture-diagram-icon.png', url: 'https://proamine.tech/wp-content/uploads/2026/10/Icon-Git-Architecture-Diagram.png', type: 'png', use: 'Favicon, touch icon, and header mark' },
  { file: 'pro-amineumt-ide-ai.png', url: 'https://proamine.tech/wp-content/uploads/2026/09/with-deep-sek.png', type: 'png', use: 'Footer: Pro_AmineUMT IDE with AI' },
  { file: 'umt-16x16-bga-hybrid-mcu-soc.png', url: 'https://proamine.tech/wp-content/uploads/2026/09/UMT-16x16-BGA-IC.png', type: 'png', use: 'Footer: UMT 16×16 BGA package' },
  { file: 'pro-amine-logo.png', url: 'https://proamine.tech/wp-content/uploads/2023/03/logo-use-transparent-1024x468.png', type: 'png', use: 'Footer: Pro_Amine LLC logo' },
  { file: 'nanokit-integrated-esp32-official.webp', url: 'https://proamine.tech/wp-content/uploads/2025/03/Icon-NanoKit-Integrated-ESP32.webp', type: 'webp', use: 'Optional: the published WebP of the NanoKit render (the committed nanokit-integrated-esp32.webp is derived from the same render in the official GitHub repository)' },
];
const MAX_BYTES = 8_000_000;
const looksLike = (bytes, type) => (type === 'png' ? bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP');

async function exists(file) { try { await access(file); return true; } catch { return false; } }

export async function fetchBrandAssets({ force = false, fetchImpl = fetch, log = console.log, directory = target } = {}) {
  await mkdir(directory, { recursive: true }); const report = [];
  for (const asset of ASSETS) {
    const destination = path.join(directory, asset.file);
    if (!force && await exists(destination)) { report.push({ ...asset, status: 'kept' }); continue; }
    try {
      const response = await fetchImpl(asset.url, { redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > MAX_BYTES) throw new Error('the file is larger than 8 MB');
      if (!looksLike(bytes, asset.type)) throw new Error(`the response is not a ${asset.type.toUpperCase()} image`);
      await writeFile(destination, bytes); report.push({ ...asset, status: 'downloaded', bytes: bytes.length });
    } catch (error) { report.push({ ...asset, status: 'failed', error: error.message }); }
  }
  for (const item of report) log(`${item.status.padEnd(10)} ${item.file}${item.bytes ? ` (${Math.round(item.bytes / 1024)} KB)` : ''}${item.error ? ` — ${item.error}; the footer keeps its labeled fallback` : ''}`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { // A command-line script, not the server entry.
  const report = await fetchBrandAssets({ force: process.argv.includes('--force') });
  if (report.some(item => item.status === 'failed' && !item.file.endsWith('-official.webp'))) process.exitCode = 1;
}
