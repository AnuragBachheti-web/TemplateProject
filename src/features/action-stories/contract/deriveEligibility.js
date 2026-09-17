// THE ONE PRODUCER OF APPROVE ELIGIBILITY.
//
// WHY THIS MODULE EXISTS. `guardrails.verdict` and `eligibility.approve.allowed` are two independent
// fields on the Decision Object, and until this module they were coupled in exactly one place —
// offline, in extraction/normalizeCorpus.js, while fixtures were generated. Nothing at runtime
// coupled them. A payload with `verdict: "beyond_limits"` AND `approve.allowed: true` therefore
// passed every layer: button enabled, store accepted, server executed. No shipped fixture carried
// that pair, so the bug was latent — it becomes real the moment a live API is connected.
//
// The fix is not another check. Another check is another copy of the rule, and two copies of a
// safety rule are one copy plus one hole. The fix is that approve eligibility stops being DATA the
// payload asserts and becomes a VALUE derived here, once, from facts the Decision Object already
// carries. Every consumer — the action bar, the store's dispatch boundary, the mutations layer and
// the server gate — reads this function's answer and has no opinion of its own.
//
// THREE PROPERTIES, AND THEY ARE THE POINT:
//
//   PURE     no I/O, no clock, no globals, no imports beyond the status table. Same object in, same
//            answer out, every time, and nothing observable happens on the way.
//   TOTAL    every input has an answer, including `null`, `42` and `{}`. It never throws, so no
//            caller ever needs a try/catch around a question about permission.
//   CLOSED   absence is not permission. A missing Decision Object, a missing `guardrails`, a null
//            verdict, a verdict outside the contract's four values — all block, all with a reason.
//            There is no path through this function where missing data produces `allowed: true`.
//
// WHAT IT DELIBERATELY DOES NOT READ: `decision.eligibility.approve.allowed`. That field is what
// the payload CLAIMS; this function computes what is TRUE. When the two disagree the derived value
// wins and `warnOnApproveEligibilityDrift` logs it — see its own comment for why it warns rather
// than throws.

import { isLegalTransition, isTerminal } from './statusLifecycle.js'

/**
 * The stages at which an operator approves anything. `reason` and `analyze` are read-only stages —
 * there is nothing to approve yet — and `live` is an execution already in progress.
 */
const APPROVING_STAGES = ['decide', 'execute']

/**
 * The guardrail verdicts that do NOT block approval, and the reason each of the others does.
 *
 * `not_applicable` is not a failed guardrail, it is the absence of an applicable one — 40 of the 105
 * shipped Decision Objects are exactly this case and are approvable today. `undetermined` is the
 * opposite: guardrails exist and have not finished, which is not the same as having passed.
 *
 * Anything not named here — including `undefined`, `null`, a non-string, and any string outside the
 * contract's four values (contract/decisionObject.js's GUARDRAIL_VERDICTS) — falls through to the
 * fail-closed branch below.
 */
const VERDICT_RULES = {
  within_limits: null,
  not_applicable: null,
  beyond_limits: 'A guardrail on this proposal is beyond its limits.',
  undetermined: 'Guardrail checks on this proposal have not finished.',
}

/**
 * Whether this Decision Object may be approved, and if not, why.
 *
 * Every blocking condition is in one screen below, in the order a reader should meet them: is there
 * an object at all, is it still open, may this caller act, is this a stage that approves, and did
 * the guardrails pass.
 *
 * @param {object} decision - the Decision Object. Any value is accepted; only an object can pass.
 * @returns {{ allowed: boolean, reason: string|null }} `reason` is operator-facing copy when
 *   blocked, and `null` when allowed. A blocked answer always carries a specific reason.
 */
export function deriveApproveEligibility(decision) {
  if (decision === null || typeof decision !== 'object' || Array.isArray(decision)) {
    return blocked('This proposal is unavailable.')
  }

  // Lifecycle. A terminal proposal accepts nothing further. `modified` is in flight and returns as
  // `pending` before it can be approved again, so it is not terminal but it is not approvable.
  if (isTerminal(decision.status)) {
    return blocked(`This proposal is ${decision.status} and can no longer be changed.`)
  }
  if (!isLegalTransition(decision.status, 'approved')) {
    return blocked(`Approval isn't available while this proposal is ${describeStatus(decision.status)}.`)
  }

  // Entitlement. Two distinct answers on purpose: "you may not" and "your plan does not include it"
  // are different facts and lead an operator to different next steps.
  if (decision.entitlement === 'locked') {
    return blocked('You are not authorized to approve this proposal.')
  }
  if (decision.entitlement === 'limited') {
    return blocked('Your plan does not include approving proposals.')
  }

  // Stage. 53 of the 105 shipped objects are blocked by this branch alone, and this is the exact
  // copy all 53 of them ship today — kept verbatim so no operator-facing string moves in Phase 1.
  if (!APPROVING_STAGES.includes(decision.stage)) {
    return blocked('Approval happens at the decide stage.')
  }

  // Guardrails — the coupling this module exists to make real.
  const verdict = decision.guardrails?.verdict
  if (!Object.prototype.hasOwnProperty.call(VERDICT_RULES, verdict) || typeof verdict !== 'string') {
    // The fail-closed branch, stated once: no usable verdict is not the same as a passing one.
    return blocked('This proposal carries no recognised guardrail verdict.')
  }
  const verdictReason = VERDICT_RULES[verdict]
  if (verdictReason !== null) {
    return blocked(verdictReason)
  }

  return { allowed: true, reason: null }
}

function blocked(reason) {
  return { allowed: false, reason }
}

/** Keeps the status branch's copy readable when `status` is absent or not a contract status. */
function describeStatus(status) {
  return typeof status === 'string' && status !== '' ? status : 'in an unrecognised state'
}

/**
 * Reports a Decision Object whose own `eligibility.approve.allowed` disagrees with the derived
 * value. The derived value has already won by the time this runs — every caller passes it in.
 *
 * WHY IT WARNS RATHER THAN THROWS. A disagreement means the producer of the payload is out of step
 * with this contract, which is a real defect and worth a loud log. It is not a reason to take the
 * operator's screen away: the safe answer is already in hand, and throwing here would turn a
 * backend's contract bug into a broken page. So it logs and the caller proceeds with the safe value.
 *
 * Deliberately separate from `deriveApproveEligibility`, which stays pure — a console write is I/O,
 * and a pure function that logs is not a pure function.
 *
 * @param {object} decision
 * @param {{allowed: boolean}} derived - what `deriveApproveEligibility` returned for `decision`.
 * @param {string} moduleName - the module whose gate is reporting, so the log names a call site.
 */
export function warnOnApproveEligibilityDrift(decision, derived, moduleName) {
  const claimed = decision?.eligibility?.approve?.allowed
  // Nothing to disagree with. A Decision Object is required to carry the field
  // (contract/decisionObject.js), so this is the shape a validator would already have rejected.
  if (claimed === undefined) return
  if (claimed === derived.allowed) return

  console.warn(
    `[${moduleName}] contract violation: eligibility.approve.allowed disagrees with the derived ` +
      `value — proposal_id=${decision?.proposal_id ?? 'unknown'}, ` +
      `payload=${JSON.stringify(claimed)}, derived=${JSON.stringify(derived.allowed)}. ` +
      'Proceeding with the derived value.',
  )
}

/**
 * The derived `eligibility.approve` ENTRY, in the shape the Decision Object contract requires
 * (contract/decisionObject.js's validateEligibilityEntry: `blocked_reason` is mandatory whenever
 * `allowed` is false).
 *
 * Used where an entry has to be written rather than merely consulted — see
 * operatorActionExecution.js's `applyOperatorAction`, which stamps it onto the object an action
 * returns instead of hand-writing a value that could drift from this module's answer.
 */
export function deriveApproveEligibilityEntry(decision) {
  const derived = deriveApproveEligibility(decision)
  return derived.allowed ? { allowed: true } : { allowed: false, blocked_reason: derived.reason }
}
