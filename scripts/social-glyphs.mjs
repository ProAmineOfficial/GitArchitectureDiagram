// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-BRAND-001
// Project: Git Architecture Diagram | Component: Social dock glyph manifest.
// Put each network's official monochrome SVG, downloaded from that network's brand resources, in
// public/assets/brand/social/<network>.svg (telegram, tiktok, youtube, facebook, instagram, github, x, linkedin), then run
//   npm run brand:social
// The script validates each file (a plain SVG under 24 KB with no script, event handler, external reference, or
// embedded raster) and writes glyphs.json, which the footer reads to show the glyph instead of the monogram.
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NETWORKS } from '../public/social-dock.js';

const DIRECTORY = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'brand', 'social');

/** Why an SVG is not safe or suitable for the dock, or '' when it is. */
export function svgProblem(text) {
  if (Buffer.byteLength(text) > 24 * 1024) return 'larger than 24 KB';
  if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) return 'not an SVG document';
  if (/<script|<foreignObject|<iframe|<image\b|<use\b[^>]*href\s*=\s*["']?(?!#)/i.test(text)) return 'contains scripts, foreign content, images, or external references';
  if (/\son[a-z]+\s*=/i.test(text)) return 'contains event handler attributes';
  if (/(?:href|src)\s*=\s*["']\s*(?:https?:|data:|javascript:)/i.test(text) || /url\(\s*["']?\s*(?:https?:|data:)/i.test(text)) return 'references an external or embedded resource';
  return '';
}

export async function buildManifest(directory = DIRECTORY) {
  const glyphs = {}; const problems = [];
  for (const network of NETWORKS) {
    const file = path.join(directory, `${network}.svg`);
    try { await access(file); } catch { continue; }
    const problem = svgProblem(await readFile(file, 'utf8'));
    if (problem) problems.push(`${network}.svg: ${problem}`); else glyphs[network] = `${network}.svg`;
  }
  return { manifest: { version: 1, glyphs }, problems };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { manifest, problems } = await buildManifest();
  for (const problem of problems) console.error(`Skipped ${problem}`);
  await writeFile(path.join(DIRECTORY, 'glyphs.json'), JSON.stringify(manifest, null, 2) + '\n');
  const listed = Object.keys(manifest.glyphs); const missing = NETWORKS.filter(network => !listed.includes(network));
  console.log(`glyphs.json: ${listed.length ? listed.join(', ') : 'no glyphs'}${missing.length ? `; monograms for ${missing.join(', ')}` : ''}.`);
  process.exitCode = problems.length ? 1 : 0;
}
