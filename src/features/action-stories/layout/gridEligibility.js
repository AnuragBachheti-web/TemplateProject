// The original, purely-heuristic answer to "is this block small enough to share a row with its
// neighbors" — moved out of StageRenderer.jsx unchanged (AUDIT_REPORT.md §10/§18/§25: layout
// heuristics are a different *kind* of concern from StageRenderer's data pipeline, and belonged in
// their own file even before any declarative layout existed). This is now explicitly the FALLBACK
// composeSections.js reaches for only when a block carries no explicit `layout.group` — never
// removed, since every one of the 105 real manifests (and any manifest a backend sends without
// opting into `layout`) still needs it to render the way it always has.
//
// A short/scalar block (a one-line text value, a number, a flag, a small object with only a
// handful of fields) is cheap to read at a glance; StageRenderer used to stack every block
// full-width in one plain vertical column regardless — a stage full of these renders as a wall of
// giant, nearly-empty cards (see extraction/audit.js's B.1/B.2 checks: this is exactly the "0 of 5
// orders created" / "Suggest" / "n/a" screen). Consecutive blocks like this are grouped into a
// responsive grid row instead; anything richer (table/series/itemQueue/labelValueList/slider, or a
// placeholder) still gets its own full-width row, in its original position.
export function isGridEligible(blockType, value) {
  if (blockType === 'text' || blockType === 'number' || blockType === 'flag') return true;
  if (blockType === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value).length <= 3;
  }
  return false;
}
