// Shared, single source of truth for "is this field name pure presentation, not content" —
// previously three independent, drifting copies (ItemQueueBlock.jsx, LabelValueListBlock.jsx,
// TableBlock.jsx), each a trailing-suffix-only regex that missed a compound key like `dotInner`
// ("dot" isn't the LAST word) — confirmed leaking "Dot Inner: transparent" as visible text on
// S9.1/Decide's `slates` (RENDERED_UI_FORENSIC_AUDIT.md §3.5/§8). Consolidating the three runtime
// copies into one module (all three are runtime components already, so sharing between them costs
// nothing) while keeping extraction/classifyBlocks.js's own separate, generation-time-only copy —
// that module explicitly never imports runtime code, and vice versa (see its own header comment).
//
// Checked word-by-word (splitting on camelCase boundaries), not only as a trailing suffix, so the
// decorative word can appear anywhere in the key. Never matches on a raw substring — "dot" only
// matches as a whole camelCase word ("dotInner" → ["dot","Inner"]), so a real field name that
// merely CONTAINS these letters is never a false positive.
const DECORATIVE_WORDS = new Set([
  'bg', 'fg', 'tone', 'tint', 'border', 'cursor', 'icon', 'glow', 'edge', 'dot', 'shadow',
  'opacity', 'mark', 'hue', 'fill', 'stroke', 'weight', 'divider', 'radius',
]);
const CAMEL_WORD_RE = /[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])/g;

/** True for a key that's pure presentation/UI-chrome, not real content. */
export function isDecorativeKey(key) {
  const words = String(key).match(CAMEL_WORD_RE) ?? [];
  return words.some((w) => DECORATIVE_WORDS.has(w.toLowerCase()));
}
