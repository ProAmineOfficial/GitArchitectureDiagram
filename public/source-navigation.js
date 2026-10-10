// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-EVIDENCE-001
// Source navigation is generated from verified repository paths, never repository-authored click directives.
export function mappedTarget(element, paths) { // Resolve only identifiers in the current generated diagram's map.
  for (const [key, target] of Object.entries(paths)) if (element.id?.startsWith(`flowchart-${key}-`) || element.id?.includes(`-flowchart-${key}-`) || element.dataset?.id === key || element.classList?.contains(`gad-${key}`)) return typeof target === 'string' ? { path: target, type: 'blob' } : target; // Match stable flowchart IDs or explicit mind-map classes.
  return null; // Authored and edited nodes have no invented source destination.
} // End node target resolution.
export function pinnedSourceURL(repository, target) { // Preserve full paths, scope, source type, and optional line citations.
  const item = typeof target === 'string' ? { path: target, type: 'blob' } : target; // Accept the existing file-path report format.
  return `${repository.htmlUrl}/${item.type === 'tree' ? 'tree' : 'blob'}/${repository.sha}${item.path ? '/' + item.path.split('/').map(encodeURIComponent).join('/') : ''}${Number.isInteger(item.line) && item.line > 0 ? '#L' + item.line : ''}`; // Build only an immutable GitHub source location.
} // End pinned link generation.
