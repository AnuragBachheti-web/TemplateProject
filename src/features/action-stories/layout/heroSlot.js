// Shared, generic "is this scalar text actually this stage's own headline/primary narrative claim"
// detection — consulted by TextBlock.jsx to decide its own rich "Realify signal" visual treatment
// (a `role: "hero"` manifest block always qualifies too, independent of slotName — see TextBlock's
// own doc comment; this vocabulary list is the backward-compatible fallback for a manifest
// generated before `role` existed).
//
// `rationale`/`primaryInsight` are the project's own shared vocabulary slot names (see
// extraction/classifyBlocks.js's PRIORITY_GROUPS) — assigned identically across every one of the
// 26 workflows by the same generic rule, never a per-workflow special case. `heroTitle`/`heroSub`
// are raw mockup keys that recur verbatim across multiple workflows' `decide` stages for the exact
// same concept (a headline + its paired subheadline) — confirmed by grepping every manifest, a
// real generic pattern, not a one-off. Kept in sync with classifyBlocks.js's own generation-time
// copy of this same vocabulary (that module can't import this runtime file — see its own header
// comment on why — so the two lists are deliberately parallel, not shared).
export const HERO_SLOT_NAMES = new Set(['rationale', 'primaryInsight', 'heroTitle', 'heroSub']);
export const HERO_MIN_LENGTH = 60;

/** True when `slotName`/`data` together are this stage's own promotable primary narrative text. */
export function isHeroEligible(slotName, data) {
  return HERO_SLOT_NAMES.has(slotName) && typeof data === 'string' && data.length >= HERO_MIN_LENGTH;
}
