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
// `dash` (SVG stroke-dasharray) and `anchor` (SVG text-anchor) joined this list alongside
// classifyBlocks.js's own parallel copy — both are chart/SVG-only drawing instructions in this
// corpus (e.g. S9.9/analyze.cliffs' marker-line annotations), never business content, the same
// class of field `stroke` already covers here.
//
// `x`/`y`/`cx`/`cy`/`r`/`tx`/`ty`/`lx`/`ly`/`nx` joined it too — plot-position coordinates for a
// chart's own marker/label geometry (matches classifyBlocks.js's own PLOT_POSITION_KEYS, extended
// with the same tx/ty/lx/ly/nx set for the identical reason — see that module's own doc comment).
// `op` (opacity's own short form — this corpus's `checkOpacity`/`opacity` convention shortened for
// chart markers specifically) rounds out S9.9/analyze.ladders' own remaining fields.
//
// `w` was tried too (S9.9/analyze.cliffs' stroke-width) and reverted: LabelValueListBlock.test.jsx's
// own "moveBar's exact shape" case proves `w` is a genuine, deliberately-supported PRIMARY VALUE for
// a `{label, w}` row elsewhere in the corpus (a real weight/share figure) — `w` is ambiguous across
// this corpus in a way none of the other keys here are (confirmed corpus-wide before adding each of
// them), so it stays real content; `cliffs`' own residual `w: "1.8"` showing as its primary value is
// a real, but far smaller, imperfection than the coordinate leak this whole fix targets.
//
// `x`/`y`/`cx`/`cy`/`r`/`tx`/`ty`/`lx`/`ly`/`nx` — plot-position coordinates for a chart's own
// marker/label geometry (matches classifyBlocks.js's own PLOT_POSITION_KEYS, extended with the same
// tx/ty/lx/ly/nx set for the identical reason — see that module's own doc comment). Checked
// corpus-wide before adding every one of these (every occurrence, including compounds like
// `bufferY`/`targetX`/`troughCx`, is a numeric SVG pixel coordinate, never a business figure) —
// confirmed the gap that let S9.9/analyze.cliffs' `{x, tx, ty}` leak as a bogus "primary value" and
// "extra fields" (`x: 107.7` shown as if it were the row's own metric) once the block itself was
// correctly reclassified away from `table`. Unlike the generation-time PLOT_POSITION_KEYS
// (deliberately narrow so chart-shape DETECTION still reads these values), no runtime code needs to
// see them once a block has already been classified as itemQueue/labelValueList/table/object —
// chart-type detection is generation-time only, so hiding them here carries none of that risk.
const DECORATIVE_WORDS = new Set([
  'bg', 'fg', 'tone', 'tint', 'border', 'cursor', 'icon', 'glow', 'edge', 'dot', 'shadow',
  'opacity', 'mark', 'hue', 'fill', 'stroke', 'weight', 'divider', 'radius', 'dash', 'anchor',
  'x', 'y', 'cx', 'cy', 'r', 'tx', 'ty', 'lx', 'ly', 'nx', 'op',
]);
const CAMEL_WORD_RE = /[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])/g;

/** True for a key that's pure presentation/UI-chrome, not real content. */
export function isDecorativeKey(key) {
  const words = String(key).match(CAMEL_WORD_RE) ?? [];
  return words.some((w) => DECORATIVE_WORDS.has(w.toLowerCase()));
}

// A `__`-prefixed key is this codebase's own convention for "internal bookkeeping, never real
// content" — extraction/dcLogicSandbox.js's attachRawRecords introduced the first one (`__raw`, a
// row's own unformatted numbers, kept around so a future feature can read real values behind a
// formatted display string like "$18.40"), but the RULE is the naming convention, not that one
// literal field name. Checked generically (any key starting with `__`) rather than a hardcoded
// `key === '__raw'` list, so a second internal companion field introduced later is excluded
// automatically everywhere this is used, instead of becoming a new leak the first time it appears —
// exactly what happened to `__raw` itself: TableBlock.jsx had its own local, hardcoded
// `HIDDEN_COLUMN_KEYS = new Set(['__raw'])` check, but ItemQueueBlock.jsx, LabelValueListBlock.jsx,
// and nestedEntryText.js each had their own independent copy of "what's decorative" that never
// mentioned `__raw` at all — confirmed leaking it as visible "Raw: ..." text on 37 blocks across the
// corpus before this fix.
export function isInternalKey(key) {
  return String(key).startsWith('__');
}

/** True for a key that should never reach a rendered label/value — decorative-by-name OR
 * internal-by-convention. The one check every block's "what's left to show" pass should use,
 * instead of either half alone (see this module's own header comment on why keeping these as
 * separate drifting per-block copies is exactly the bug class this file exists to prevent). */
export function isHiddenKey(key) {
  return isInternalKey(key) || isDecorativeKey(key);
}
