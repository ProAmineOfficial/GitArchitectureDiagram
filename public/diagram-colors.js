// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: MIT · Provenance ID: GAD-WORKSPACE-UI-001
// Shared palette follows Mermaid's eleven branch sections, with cScale0 reserved for the root.
const COLORS = ['#17445d', '#49336b', '#1c5547', '#624720', '#602f4b', '#254965', '#414c24', '#40395b']; // Keep folder colors distinct from architecture role claims.
export function mindmapColor(branch) { return COLORS[(branch % 11) % COLORS.length]; } // Match Mermaid's section wrapping for every displayed folder.
export const MINDMAP_THEME = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [[`cScale${index}`, index ? mindmapColor(index - 1) : '#17445d'], [`cScaleLabel${index}`, '#f3f7ff']]).flat()); // Use the same colors for rendered nodes and the visible legend.
