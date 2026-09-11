// Normalization boundary for the two confirmed field-semantic collisions between this scaffold's
// manifest vocabulary and the real `/v1/proposals` API — documented in INTEGRATION.md §4, itself
// checked against the real source (`fromProposal.js`, `proposalVocabulary.js`,
// `services/proposalsService.js`) rather than guessed. Nothing in `src/features/action-stories/`
// binds a manifest slot directly to `execution_lane` or `guardrail_verdict` any more (see
// extraction/classifyBlocks.js's EXACT_KEY_OVERRIDES comment) — this file exists so that when a
// real backend *is* wired, there is one explicit, typed, tested place that knows what those two
// real fields actually mean and how they relate to this UI's own `display_mode`/`guardrail_checks`
// concepts, instead of a future engineer re-guessing the mapping (or worse, binding the real field
// straight into the old, wrongly-named slot and silently showing the wrong thing to a user).
//
// This module is NOT wired into any current screen — there is no live `/v1/proposals` endpoint in
// this repository to normalize a response from yet (services/actionStoriesService.js still reads
// local fixtures). It is the contract the eventual integration should use, kept here so the
// decision is made once, deliberately, and is testable now rather than invented under deadline
// pressure later.

/**
 * The real `guardrail_verdict` enum, per `proposalVocabulary.js:129`. Four values, no others.
 */
export const GUARDRAIL_VERDICT_VALUES = ['within_limits', 'beyond_limits', 'not_applicable', 'undetermined'];

/**
 * The real `execution_lane` enum this UI would receive once wired — informally two values,
 * confirmed by `proposalVocabulary.js:130,188`: "agent" only when the verdict is `within_limits`,
 * "human" otherwise. This is a SERVER-DERIVED field (the backend computes it from the verdict), not
 * independently authored, but the value still needs a name on the frontend side once it arrives.
 */
export const EXECUTION_LANE_VALUES = ['agent', 'human'];

/**
 * True for a value the real `guardrail_verdict` field is allowed to take. Use this to validate a
 * response before trusting it — never assume a backend response matches its own documented
 * contract without checking.
 */
export function isRealGuardrailVerdict(value) {
  return typeof value === 'string' && GUARDRAIL_VERDICT_VALUES.includes(value);
}

/**
 * Reproduces the real backend's own derivation (`proposalVocabulary.js`) so a frontend that only
 * has the verdict (not a separately-sent execution_lane) can still compute the same answer the
 * server would — useful for optimistic UI or a fixture that only sends one of the two fields. Once
 * a real API always sends both fields directly, prefer the server's own `execution_lane` value over
 * calling this; it exists for defensiveness, not to replace the source of truth.
 *
 * @param {string} guardrailVerdict - one of GUARDRAIL_VERDICT_VALUES.
 * @returns {'agent'|'human'}
 */
export function deriveExecutionLane(guardrailVerdict) {
  return guardrailVerdict === 'within_limits' ? 'agent' : 'human';
}

// This UI's OWN `guardrail_checks` slot (bound to the mockup's `data.checks`, a governance
// checklist array — see classifyBlocks.js) is a *rendering* of a decision, not the real verdict
// enum itself — the two are related but not interchangeable, and must never be assigned to each
// other's slot. INTEGRATION.md §4 leaves open whether the checklist becomes a *rendering* of the
// real verdict (e.g. "beyond_limits" → show the checklist as the reasons why) or is replaced
// outright, once the real endpoint's actual per-check payload shape is known — deliberately left as
// an open decision here rather than guessed, since fabricating that mapping now would be exactly
// the kind of false-confidence bug this module exists to prevent.
