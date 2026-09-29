// Source navigation is generated from verified repository paths, never repository-authored click directives.
import { lineAnchor } from './route-state.js'; // Keep single-line and range links consistent with shared routes.
export function mappedTarget(element, paths) { // Resolve only identifiers in the current generated diagram's map.
  for (const [key, target] of Object.entries(paths)) if (element.id?.startsWith(`flowchart-${key}-`) || element.id?.includes(`-flowchart-${key}-`) || element.dataset?.id === key || element.classList?.contains(`gad-${key}`)) return typeof target === 'string' ? { path: target, type: 'blob' } : target; // Match stable flowchart IDs or explicit mind-map classes.
  return null; // Authored and edited nodes have no invented source destination.
} // End node target resolution.
export function pinnedSourceURL(repository, target) { // Preserve full paths, scope, source type, and optional line citations.
  const item = typeof target === 'string' ? { path: target, type: 'blob' } : target; // Accept the existing file-path report format.
  return `${repository.htmlUrl}/${item.type === 'tree' ? 'tree' : 'blob'}/${repository.sha}${item.path ? '/' + item.path.split('/').map(encodeURIComponent).join('/') : ''}${item.type === 'tree' ? '' : lineAnchor(item)}`; // Build only immutable file or folder links with validated line ranges.
} // End pinned link generation.
