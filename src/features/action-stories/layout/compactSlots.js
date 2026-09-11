// The LEGACY, name-based "which section ids are rail sections" guess — kept as composeSections.js's
// fallback for a manifest (hand-authored, or generated before this schema existed) whose `sections`
// don't declare a real `region` field at all. Once anything in a manifest declares `region`
// (per-section or per-block), THAT is authoritative and this list is never consulted for it — see
// composeSections.js's own doc comment for the full region-resolution order.
//
// These are exactly the ids extraction/classifyBlocks.js's `planSections` used to emit with no way
// to say otherwise — a generic, vocabulary/shape-driven set, not a per-workflow list. Guardrails and
// Summary read as inherently secondary/supporting context for MOST stages (a policy gate, a metric
// roundup) — which is exactly why this guess is wrong often enough to need overriding: a stage
// whose "Summary" bucket happens to hold its own headline (see classifyBlocks.js's `recommendation`
// section) now declares `region: "main"` for that bucket explicitly instead of relying on this guess.
export const RAIL_SECTION_IDS = new Set(['guardrails', 'summary'])
