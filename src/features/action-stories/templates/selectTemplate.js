// The template layer, in one function.
//
// This is the entire architectural addition the audit called for: the thing that used to decide
// which layout renders was the URL (`manifests[code].find(m => m.stageKey === k)` — a file lookup
// keyed by workflow code), and it is now a deterministic function of the Decision Object's own
// business facts. Nothing downstream changed: the selected template is an ordinary manifest, and
// StageRenderer/composeSections/resolveBinding consume it exactly as they always have.
//
// Pure, synchronous, deterministic, offline. No React, no store, no network, no async, no scoring,
// no priority engine, no backend lookup. A table and four `??`.
//
// THE BACKEND NEVER SENDS template_id. Layout is a frontend concern (the backend sends business
// facts); a backend-chosen template would make every layout change a cross-team deploy and would
// let a server dictate the client's visual composition.

/**
 * `${action_type}|${stage}|${cardinality}` -> template id.
 *
 * `*` is a literal wildcard segment, not a pattern language — the lookup below tries three fixed
 * key shapes in order. There is no matcher, no regex, no precedence scoring: adding an
 * action_type-specific layout later is one row here and one entry in templateRegistry.js.
 *
 * Only stage-level rows exist today, because nothing in the corpus needs an action_type-specific
 * layout. The more specific tiers are wired and tested so the first real one is a data change.
 *
 * `decide` matches on `*` rather than on `many`. Cardinality is a REAL axis again — it is derived
 * from the proposal's own item count (see extraction/normalizeCorpus.js's cardinalityFor), not
 * hard-coded to "many" as it was when the audit ran — and it does real work: `approve_selected`
 * gates on it. What it must NOT do is decide whether a decide-stage proposal renders at all; a
 * single-item decision is still a decision, and failing it to an unsupported-decision page would be
 * a coverage regression dressed up as strictness.
 */
const TEMPLATE_TABLE = Object.freeze({
  '*|reason|*': 'reason.v1',
  '*|analyze|*': 'analyze.compare.v1',
  '*|decide|*': 'decide.slate.v1',
  '*|execute|*': 'execute.bridge.v1',
  // `live` is not a sixth business stage: it is the execute stage still running, and the reference's
  // one live screen (S10.6) renders exactly what execute.bridge.v1 renders — a plan, progress rows,
  // monitors, the systems being written to, and a ledger. Mapping it here rather than minting a
  // speculative `live.v1` is the audit's RB-7 resolution: no new template, and the 11 business
  // concepts on that screen stop rendering as an error page.
  '*|live|*': 'execute.bridge.v1',
})

/**
 * @param {{action_type?: string, stage?: string, cardinality?: string, entitlement?: string}} decision
 *   Reads exactly four fields off a Decision Object. Takes the whole object rather than four
 *   positional arguments so a call site can never silently transpose two of them.
 * @returns {string|null} a template id, or `null` when no rule matches.
 *
 * `null` is a real, deliberate outcome and the caller must handle it (StagePage renders an explicit
 * unsupported-decision state). The selector NEVER falls back to a default template: silently
 * rendering the wrong layout for an unrecognised decision is strictly worse than rendering nothing,
 * because the operator cannot tell that it happened.
 */
export function selectTemplate(decision) {
  if (decision === null || typeof decision !== 'object') return null
  const { action_type: actionType, stage, cardinality, entitlement } = decision

  // Entitlement short-circuits before the table is consulted. A locked proposal must not reveal the
  // structure of the template it would otherwise have used — which slots exist, how many items are
  // in the slate, and which actions would have been offered are all themselves information.
  if (entitlement === 'locked') return 'locked.v1'

  if (typeof stage !== 'string' || stage === '') return null

  return (
    TEMPLATE_TABLE[`${actionType}|${stage}|${cardinality}`] ??
    TEMPLATE_TABLE[`*|${stage}|${cardinality}`] ??
    TEMPLATE_TABLE[`*|${stage}|*`] ??
    null
  )
}

/**
 * Every template id the table can produce, plus `locked.v1`. Exported so templateRegistry.js can
 * assert at module load that it holds an entry for each one — a table row pointing at a template
 * that does not exist is a bug that should surface on import, not on the one route that hits it.
 */
export const SELECTABLE_TEMPLATE_IDS = Object.freeze([...new Set([...Object.values(TEMPLATE_TABLE), 'locked.v1'])])
