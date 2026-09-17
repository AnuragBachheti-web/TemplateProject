// The canonical runtime business contract: ONE Decision Object per proposal, returned by the
// backend, validated here, and rendered through the existing engine unchanged.
//
// A Decision Object is NOT a screen. It is the runtime business object for a proposal. "Decide" is
// one of several UI stages rendered FROM it — there is deliberately no DecisionObjectPage,
// DecisionObject component, or DecisionObject route anywhere in this codebase.
//
// Validation style matches manifests/validateManifest.js exactly — plain JS checks (typeof,
// Array.isArray, key presence), no schema library, never throws, returns a list of problem strings
// where empty means valid. That convention already exists in this repository; a second validation
// technology would be a new dependency for no gain.
//
// FAIL-CLOSED IS THE POINT. Every one of the seven axes is REQUIRED. A missing axis is a contract
// violation, not a value to default. This is the direct lesson of the pre-existing `execLabel`
// field, which was present in 105 of 105 fixtures and carried exactly two distinct values
// ("Suggest" x104, "Assist" x1) — an axis that is allowed to be optional degenerates into a
// constant, and then into decoration.

import { STATUSES } from './statusLifecycle.js'
import { OPERATOR_ACTION_IDS } from './actionTypes.js'

// ---- the seven runtime axes -------------------------------------------------------------------

/** Axis 1. Drives template selection: a one-item decision and an N-item slate are different layouts. */
export const CARDINALITIES = ['one', 'many']

/**
 * Axis 2. PROVISIONAL — see this module's own note below and the final report's open-decisions
 * list. The repository contains no product definition of contract class, so this is the smallest
 * set that makes the axis non-degenerate. It must be confirmed by Product before launch; the
 * validator rejecting unknown values is what will surface a mismatch immediately rather than
 * silently accepting whatever the backend sends.
 */
export const CONTRACT_CLASSES = ['standard', 'strategic', 'regulated']

/** Axis 4. Evidenced by the corpus's own `execLabel` ("Suggest"/"Assist"), extended with "auto". */
export const MODES = ['suggest', 'assist', 'auto']

/**
 * Axis 5. `locked` is the one axis value that participates in template selection (see selectTemplate).
 *
 * `observe` and `not_hired` are the two product states the enum was missing. They are NOT populated
 * on any shipped object and deliberately so (ruling R5): assigning a non-`full` entitlement to a
 * real proposal has no basis in the corpus, and inventing one is refused outright. So this axis is
 * KNOWINGLY DEGENERATE at the end of Phase 2 — 'full' x105 — and is named in
 * contractExtension.test.js's EXEMPT_BY_RULING_R5 list rather than quietly skipped, because an
 * unexplained exemption is how a constant axis survives and a named one is a ticket.
 */
export const ENTITLEMENTS = ['full', 'limited', 'locked', 'observe', 'not_hired']

/**
 * Axis 6. Derived from the corpus, not invented: `data.lens` carries "Ads", "Cash", "Inventory",
 * "Margin" and "Sales", and the compound owner strings ("Navigator · Cash lens", "Promoter · Margin
 * lens") confirm the same five as a real product vocabulary.
 */
export const LENSES = ['ads', 'cash', 'inventory', 'margin', 'sales']

/**
 * Axis 7. Read from the reference itself: every one of the 26 Action Stories names its operating
 * group in the pinned identity strip its screens all carry — "Merchandiser + Prospector",
 * "Pricer, Controller governs", "Scout lead; Pricer, Merchandiser, Bidder respond" — and the LEAD
 * persona is the first one named. See extraction/referenceContext.js, which parses them.
 *
 * The original seven were inferred from `data.owner` alone and were incomplete: `arbiter`,
 * `pricer`, `prospector`, `scout`, `shipper`, `sourcer` and `steward` are each the lead persona on
 * at least one story and were being silently replaced by a hash-chosen value.
 *
 * A persona is a HUMAN OPERATOR. The named models on a proposal ("Forecaster", "GMROI Engine") are
 * agents and live on `proposal.agents` — conflating the two is what lost both.
 */
export const PERSONAS = [
  'arbiter', 'bidder', 'controller', 'keeper', 'merchandiser', 'navigator', 'planner',
  'pricer', 'promoter', 'prospector', 'scout', 'shipper', 'sourcer', 'steward',
]

// ---- stage and business action vocabulary -----------------------------------------------------

/** Matches the existing manifest/route stage vocabulary exactly — see validateManifest.js. */
export const STAGES = ['reason', 'analyze', 'decide', 'execute', 'live']

/**
 * The BUSINESS action a proposal proposes — deliberately NOT the operator actions an operator
 * performs on it (approve/dismiss/...; those live in actionTypes.js).
 *
 * PROVISIONAL, and kept deliberately small. The repository has no product enum for this, and the
 * audit named it the single highest-risk contract unknown. Rather than mint one business action
 * type per workflow (26 of them, which is how a contract becomes a free string with extra steps),
 * this is the smallest set that covers the 25 corpus workflow categories at the altitude template
 * selection actually needs. The mapping is recorded in __corpus__/corpusToDecisionObject.js.
 */
export const ACTION_TYPES = [
  'reprice', // Repricing, Markdown, Competitive
  'reorder', // Replenishment, Working capital
  'reallocate', // Allocation, Peak readiness
  'adjust_assortment', // Assortment, Exit, Lifecycle, Launch
  'adjust_spend', // Advertising, Promo calendar
  'fix_listing', // Listings, Catalog integrity, Search visibility
  'file_claim', // Returns, Fee integrity
  'review', // the analysis-only workflows: Item research, Variance bridge, Account health, ...
]

/** Guardrail verdict — the real 4-value enum, per services/proposalFieldMapping.js. Never a boolean. */
export const GUARDRAIL_VERDICTS = ['within_limits', 'beyond_limits', 'not_applicable', 'undetermined']

/**
 * PER-ROW guardrail status — the field whose absence meant a governance checklist could show its
 * label and note but never whether the check actually passed.
 *
 * DERIVED FROM EVIDENCE, at extraction time, from three signals the reference already carries on
 * its 85 check rows (extraction/normalizeCorpus.js's `checkStatusOf`):
 *
 *   `ok`    an explicit boolean on 18 rows — 12 true, 6 false. Preferred whenever present, because
 *           it is the reference stating the answer rather than implying it.
 *   `icon`  fa-circle-check x111, fa-lock x9, fa-triangle-exclamation x5, fa-circle-xmark x4,
 *           fa-circle-stop x3, fa-circle-exclamation x2, fa-clock/eye/bolt/rotate-left/circle-info x1.
 *   `tone`  var(--green-700) x113, var(--rose-700) x11, var(--amber-700) x3, var(--amber-500) x1,
 *           var(--ink-400/600) x14.
 *
 * `blocked` is distinct from `fail` because the reference draws the distinction itself: fa-lock and
 * fa-circle-stop mark a check that CANNOT proceed (legal hold, contract lock), where
 * fa-circle-xmark marks one that ran and did not pass. An operator's next step differs.
 *
 * THE ICON AND THE TONE DO NOT CROSS THE BOUNDARY. They are read while the corpus is generated and
 * discarded; only this enum is serialized. The status -> colour map lives in exactly one place in
 * frontend code (I4), and __corpus__/boundary.test.js fails if a tone or an icon ever reappears in
 * a payload.
 */
export const GUARDRAIL_CHECK_STATUSES = ['pass', 'warn', 'fail', 'blocked', 'info']

/**
 * Sales channel the proposal acts on.
 *
 * Evidence: a raw `channel`/`channels` string on 7 of the 26 reference stories, 101 occurrences —
 * "Amazon" x36 (plus "Amazon FBA" x3, "Amazon · FBA" x2), "Walmart" x12 (plus "Walmart · WFS" x2,
 * "Walmart WFS · portal only" x1), "Shopify" x5, "DTC · northwind.com" x2 / "DTC" x1, "Google" x1,
 * "Faire" x1.
 *
 * `wholesale` is PROVISIONAL and is the one value here that is a grouping rather than a name: it
 * covers the supplier-side transports the reference names instead of a marketplace — "EDI 850" x4,
 * "Email PDF + portal ack" x2, "Supplier portal task" x2, "email" x8. Listed in deliverable F.
 *
 * Deliberately NOT included: "all four" x7, "mixed" x3 and "Crawl re-read window" x2, which are not
 * channels — the first two describe a span across channels and the third is a crawler window.
 */
export const CHANNELS = ['amazon', 'walmart', 'shopify', 'dtc', 'google', 'faire', 'wholesale']

/**
 * Why an operator dismissed a proposal.
 *
 * PROVISIONAL — the repository has NO evidence for this vocabulary. The dismiss action collects
 * free text today (actionTypes.js's `reasonRequired`/`reasonMinLength`), and the reference never
 * shows a dismissal at all. Kept as small as the concept allows: five outcomes that lead an
 * operator somewhere different, rather than one value per workflow. Must be confirmed by Product;
 * listed in deliverable F.
 *
 * The free-text reason is NOT replaced by this. A code makes a queue filterable; the prose is what
 * the next person reads. Both are required, and both are persisted — see
 * operatorActionExecution.js's `dismissal_reason` / `dismissal_note`.
 */
export const DISMISS_REASONS = [
  'not_actionable', // nothing to do — the situation resolved itself or never applied
  'already_handled', // done outside Realify, so the proposal is redundant
  'incorrect_data', // the analysis is wrong; the proposal should not have been raised
  'policy', // correct, but disallowed by a rule the system does not model
  'other', // present so an operator is never forced into a wrong code; prose carries it
]

/** Units a typed business number may carry. Presentation (symbol, precision, compaction) is frontend-owned. */
export const VALUE_UNITS = ['USD', 'EUR', 'GBP', 'pct', 'count', 'days']

// ---- helpers ----------------------------------------------------------------------------------

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== ''
}

/** ISO-8601 instant. Rejects a value that merely parses — "2026-13-45" must not pass. */
function isIsoTimestamp(v) {
  if (!isNonEmptyString(v)) return false
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v)) return false
  return !Number.isNaN(Date.parse(v))
}

function checkEnum(problems, value, allowed, field) {
  if (!allowed.includes(value)) {
    problems.push(`"${field}" must be one of: ${allowed.join(', ')} (got ${JSON.stringify(value)})`)
  }
}

/**
 * A typed business number: `{ value: number, unit: string, precision?: number }`. This is the shape
 * that replaces the corpus's 3,009 pre-formatted display strings ("$7.90", "88%"). The backend
 * sends the magnitude and its unit; blocks/formatValue.js decides every character of the display.
 */
export function validateTypedNumber(value, field) {
  const problems = []
  if (!isPlainObject(value)) {
    return [`"${field}" must be an object of shape { value, unit }`]
  }
  if (typeof value.value !== 'number' || !Number.isFinite(value.value)) {
    problems.push(`"${field}.value" must be a finite number`)
  }
  if (!VALUE_UNITS.includes(value.unit)) {
    problems.push(`"${field}.unit" must be one of: ${VALUE_UNITS.join(', ')}`)
  }
  if (value.precision !== undefined) {
    if (!Number.isInteger(value.precision) || value.precision < 0 || value.precision > 6) {
      problems.push(`"${field}.precision" must be an integer between 0 and 6 when present`)
    }
  }
  return problems
}

/**
 * REQUIRED AND NULLABLE — the shape ruling R1 adopted for the five fields the UI needs and the
 * reference does not always state.
 *
 * The field must be PRESENT and correctly typed on every object. `null` is a legal typed value and
 * means one specific thing: "the reference does not state this". Absence, a wrong type, or a
 * non-null value of the wrong shape all remain contract violations, so I1's "no optional additions"
 * stands — what is relaxed is the claim that the corpus knows the answer, never the requirement
 * that the backend answer.
 *
 * This is deliberately NOT the same as optional. An optional field is one a producer may forget; a
 * required nullable field is one a producer must decide about. That difference is the whole reason
 * `execLabel` became decoration and this will not.
 */
function validateRequiredNullable(problems, decision, field, check, expected) {
  if (!(field in decision)) {
    problems.push(`"${field}" is required — use null to state that it is unknown, never omit it`)
    return
  }
  const value = decision[field]
  if (value === null) return
  if (!check(value)) {
    problems.push(`"${field}" must be ${expected}, or null (got ${JSON.stringify(value)})`)
  }
}

/**
 * ONE ROW of the governance checklist. Previously validated only as "an array when present"
 * (the whole of the old `guardrails.checks` rule), which is why a row could carry a label, a note
 * and nothing that said whether the check passed.
 *
 * A row identifies itself EITHER by `label` or by `text` — both are legitimate and both occur:
 * `label` + `value`/`note` is a metric row (58 rows), `text` is a whole policy sentence with no
 * separate value (102 rows). Requiring `label` alone discarded the second kind entirely.
 */
function validateGuardrailCheck(row, field) {
  const problems = []
  if (!isPlainObject(row)) {
    return [`"${field}" must be an object of shape { status, label|text, ... }`]
  }
  if (!GUARDRAIL_CHECK_STATUSES.includes(row.status)) {
    problems.push(
      `"${field}.status" must be one of: ${GUARDRAIL_CHECK_STATUSES.join(', ')} (got ${JSON.stringify(row.status)})`,
    )
  }
  if (!isNonEmptyString(row.label) && !isNonEmptyString(row.text)) {
    problems.push(`"${field}" must carry a non-empty "label" or "text"`)
  }
  if (row.pct !== undefined && (typeof row.pct !== 'number' || !Number.isFinite(row.pct))) {
    problems.push(`"${field}.pct" must be a finite number when present`)
  }
  return problems
}

/**
 * Eligibility for ONE operator action. `allowed` is REQUIRED and must be a real boolean — this is
 * the whole fail-closed guarantee, and the reason the contract does not accept a missing or
 * non-boolean `allowed` as "probably fine". `blocked_reason` is the backend's own human explanation
 * and is required whenever the action is disallowed, because an operator being told only
 * "Unavailable" is a support ticket.
 */
function validateEligibilityEntry(entry, field) {
  const problems = []
  if (!isPlainObject(entry)) {
    return [`"${field}" must be an object of shape { allowed: boolean, blocked_reason?: string }`]
  }
  if (typeof entry.allowed !== 'boolean') {
    problems.push(`"${field}.allowed" must be a boolean (fail-closed: it is never optional)`)
  }
  if (entry.allowed === false && !isNonEmptyString(entry.blocked_reason)) {
    problems.push(`"${field}.blocked_reason" must be a non-empty string when "allowed" is false`)
  }
  if (entry.blocked_reason !== undefined && typeof entry.blocked_reason !== 'string') {
    problems.push(`"${field}.blocked_reason" must be a string when present`)
  }
  return problems
}

/**
 * THE CONSTRAINT / THRESHOLD SHAPES Phase 3A claims. Validated when present and omitted when the
 * reference does not state them, which is the `proposal.*` convention throughout — `proposal.policy`
 * has always been absent rather than null on the objects without it, and two conventions for one
 * idea is how a contract starts needing a decoder ring.
 *
 * `proposal.policy`           labelled governing constraints. Rows identify themselves, but NOT
 *                             necessarily by `label`: three reason screens use `{sev, sla, def}`,
 *                             `{term, definition}` and `{rule, setting, why}`. So the rule is "an
 *                             object with at least one own key", not "has a label".
 * `proposal.matrix`           a grid of `{label, cells[]}`. A cell's `share`, when present, must be
 *                             a finite NUMBER, and a row whose cells ALL carry one must sum to 100 —
 *                             that is what makes it a split rather than two independent bar widths,
 *                             and it is the one numeric threshold-family claim in this phase.
 * `proposal.threshold_control` a real numeric range: max > min, step > 0, min <= value <= max. A
 *                             control whose bounds are inverted or whose value sits outside them is
 *                             decoration, and fail-closed here means rejecting it rather than
 *                             rendering a slider that cannot mean anything.
 */
function validateProposalConstraints(proposal) {
  const problems = []

  if (proposal.policy !== undefined) {
    if (!Array.isArray(proposal.policy) || proposal.policy.length === 0) {
      problems.push('"proposal.policy" must be a non-empty array when present')
    } else {
      proposal.policy.forEach((row, i) => {
        if (!isPlainObject(row) || Object.keys(row).length === 0) {
          problems.push(`"proposal.policy[${i}]" must be a non-empty object`)
        }
      })
    }
  }

  if (proposal.matrix !== undefined) {
    if (!Array.isArray(proposal.matrix) || proposal.matrix.length === 0) {
      problems.push('"proposal.matrix" must be a non-empty array when present')
    } else {
      proposal.matrix.forEach((row, i) => {
        if (!isPlainObject(row)) {
          problems.push(`"proposal.matrix[${i}]" must be an object`)
          return
        }
        if (row.cells !== undefined && !Array.isArray(row.cells)) {
          problems.push(`"proposal.matrix[${i}].cells" must be an array when present`)
        } else if (Array.isArray(row.cells)) {
          const shares = []
          row.cells.forEach((cell, c) => {
            if (!isPlainObject(cell)) {
              problems.push(`"proposal.matrix[${i}].cells[${c}]" must be an object`)
              return
            }
            if (cell.share !== undefined) {
              if (typeof cell.share === 'number' && Number.isFinite(cell.share)) shares.push(cell.share)
              else problems.push(`"proposal.matrix[${i}].cells[${c}].share" must be a finite number when present`)
            }
          })
          // A split that does not sum to 100 is not a split. Only checked when EVERY cell carries a
          // share, so the other matrix shape (rfmGrid's count/ltv cells) is unaffected.
          if (shares.length > 1 && shares.length === row.cells.length) {
            const total = shares.reduce((a, b) => a + b, 0)
            if (total !== 100) {
              problems.push(`"proposal.matrix[${i}]" cell shares must sum to 100 (a two-way split), got ${total}`)
            }
          }
        }
      })
    }
  }

  if (proposal.threshold_control !== undefined) {
    const c = proposal.threshold_control
    if (!isPlainObject(c)) {
      problems.push('"proposal.threshold_control" must be an object of shape { min, max, step, value }')
    } else {
      for (const key of ['min', 'max', 'step', 'value']) {
        if (typeof c[key] !== 'number' || !Number.isFinite(c[key])) {
          problems.push(`"proposal.threshold_control.${key}" must be a finite number`)
        }
      }
      if (typeof c.min === 'number' && typeof c.max === 'number' && !(c.max > c.min)) {
        problems.push('"proposal.threshold_control" must have max greater than min')
      }
      if (typeof c.step === 'number' && !(c.step > 0)) {
        problems.push('"proposal.threshold_control.step" must be greater than zero')
      }
      if (typeof c.value === 'number' && typeof c.min === 'number' && typeof c.max === 'number' && (c.value < c.min || c.value > c.max)) {
        problems.push('"proposal.threshold_control.value" must lie within min..max')
      }
    }
  }

  return problems
}

// ---- the validator ----------------------------------------------------------------------------

/**
 * @param {*} decision - an untrusted API response body.
 * @param {{ operatorActions?: string[] }} [options] - which operator actions must carry eligibility.
 *   Defaults to the full set; callers pass a narrower list only in focused tests.
 * @returns {string[]} problems — an empty array means the Decision Object is valid.
 */
export function validateDecisionObject(decision, { operatorActions = OPERATOR_ACTION_IDS } = {}) {
  if (!isPlainObject(decision)) {
    return [`Decision Object must be an object, got ${Array.isArray(decision) ? 'array' : typeof decision}`]
  }

  const problems = []

  // identity
  if (!isNonEmptyString(decision.proposal_id)) problems.push('"proposal_id" must be a non-empty string')
  if (!isNonEmptyString(decision.story_code)) problems.push('"story_code" must be a non-empty string')
  checkEnum(problems, decision.stage, STAGES, 'stage')
  checkEnum(problems, decision.action_type, ACTION_TYPES, 'action_type')

  // the seven axes — every one required, none defaulted
  checkEnum(problems, decision.cardinality, CARDINALITIES, 'cardinality')
  checkEnum(problems, decision.contract_class, CONTRACT_CLASSES, 'contract_class')
  if (typeof decision.on_clock !== 'boolean') problems.push('"on_clock" must be a boolean')
  checkEnum(problems, decision.mode, MODES, 'mode')
  checkEnum(problems, decision.entitlement, ENTITLEMENTS, 'entitlement')
  checkEnum(problems, decision.lens, LENSES, 'lens')
  checkEnum(problems, decision.persona, PERSONAS, 'persona')

  // deadline is conditionally required — this is the one cross-field rule in the contract
  if (decision.on_clock === true) {
    if (!isIsoTimestamp(decision.deadline)) {
      problems.push('"deadline" must be an ISO-8601 timestamp when "on_clock" is true')
    }
  } else if (decision.deadline !== undefined && decision.deadline !== null && !isIsoTimestamp(decision.deadline)) {
    problems.push('"deadline" must be an ISO-8601 timestamp when present')
  }

  // presentation-neutral identity
  if (!isNonEmptyString(decision.title)) problems.push('"title" must be a non-empty string')
  if (typeof decision.narrative !== 'string') problems.push('"narrative" must be a string')

  // lifecycle
  checkEnum(problems, decision.status, STATUSES, 'status')
  if (!isIsoTimestamp(decision.updated_at)) problems.push('"updated_at" must be an ISO-8601 timestamp')

  // eligibility — required, and required to be complete for every operator action
  if (!isPlainObject(decision.eligibility)) {
    problems.push('"eligibility" must be an object')
  } else {
    for (const actionId of operatorActions) {
      if (decision.eligibility[actionId] === undefined) {
        // Absence is a contract violation, NOT an implicit "allowed". resolveActionState treats a
        // missing entry as disabled regardless, so this never opens a hole — it makes the hole loud.
        problems.push(`"eligibility.${actionId}" is required (fail-closed: absence is not permission)`)
      } else {
        problems.push(...validateEligibilityEntry(decision.eligibility[actionId], `eligibility.${actionId}`))
      }
    }
  }

  // the decision payload
  if (!isPlainObject(decision.proposal)) problems.push('"proposal" must be an object')
  else problems.push(...validateProposalConstraints(decision.proposal))

  // ---- required-and-nullable business fields (R1) ------------------------------------------------
  //
  // Each of these is a field the UI already reads. Before this phase they were absent from the
  // contract entirely, so the UI read `undefined` and rendered nothing — which is indistinguishable
  // from "the backend has no opinion" and is exactly how a needed field stays missing for a year.
  //
  // `impact` is required-nullable rather than populated because of a measurement, not a preference:
  // no reference fixture carries a top-level numeric magnitude anywhere. Every figure in the corpus
  // is either a pre-formatted display string ("+$41K" in `totals.rows`) or a row-level metric inside
  // a table. Per R2, parsing the former back into a typed number would ship a formatter round-trip
  // as a data source and invert the purpose of validateTypedNumber, so impact is null on 105/105 and
  // the count itself is the evidence Product needs.
  if (!('impact' in decision)) {
    problems.push('"impact" is required — use null to state that it is unknown, never omit it')
  } else if (decision.impact !== null) {
    problems.push(...validateTypedNumber(decision.impact, 'impact'))
  }
  validateRequiredNullable(problems, decision, 'brand', isNonEmptyString, 'a non-empty string')
  validateRequiredNullable(problems, decision, 'category', isNonEmptyString, 'a non-empty string')
  validateRequiredNullable(problems, decision, 'agent', isNonEmptyString, 'a non-empty string')
  validateRequiredNullable(
    problems,
    decision,
    'channel',
    (v) => CHANNELS.includes(v),
    `one of: ${CHANNELS.join(', ')}`,
  )

  // optional business fields
  if (decision.confidence !== undefined) {
    if (!isPlainObject(decision.confidence)) {
      problems.push('"confidence" must be an object of shape { value, calibrated }')
    } else {
      if (typeof decision.confidence.value !== 'number' || !(decision.confidence.value >= 0 && decision.confidence.value <= 1)) {
        problems.push('"confidence.value" must be a number between 0 and 1')
      }
      if (typeof decision.confidence.calibrated !== 'boolean') {
        problems.push('"confidence.calibrated" must be a boolean')
      }
    }
  }
  // GUARDRAILS ARE REQUIRED (ruling R11), not optional-when-present.
  //
  // contract/deriveEligibility.js reads `guardrails.verdict` to decide whether approval is allowed,
  // and fails closed when it is missing. A validator that ACCEPTED an object the producer must then
  // block is the same latent shape as the Phase 1 bug: two layers disagreeing about whether a field
  // matters, with the disagreement invisible until a live API sends the combination. All 105 shipped
  // objects carry it, so closing this is assertion-only — which is exactly when to close it.
  if (!isPlainObject(decision.guardrails)) {
    problems.push('"guardrails" is required and must be an object of shape { verdict, checks? }')
  } else {
    checkEnum(problems, decision.guardrails.verdict, GUARDRAIL_VERDICTS, 'guardrails.verdict')
    if (decision.guardrails.checks !== undefined) {
      if (!Array.isArray(decision.guardrails.checks)) {
        problems.push('"guardrails.checks" must be an array when present')
      } else {
        // Every ROW validated, not just the array. A checklist whose rows were unvalidated is how
        // 85 rows shipped with no field saying whether the check passed.
        decision.guardrails.checks.forEach((row, i) => {
          problems.push(...validateGuardrailCheck(row, `guardrails.checks[${i}]`))
        })
      }
    }
  }
  for (const key of ['totals', 'execution', 'context']) {
    if (decision[key] !== undefined && !isPlainObject(decision[key])) {
      problems.push(`"${key}" must be an object when present`)
    }
  }

  // R16. `totals` is ABSENT or it has rows — never `{}`. It was an empty object on 82 of 105,
  // because `dropUndefined({rows: undefined})` returns `{}` and `{}` is not `undefined`, so any
  // "populated on 105/105" claim about it was technically true and substantively false. A hollow key
  // is worse than an absent one: it answers the question wrongly instead of admitting it cannot.
  if (decision.totals !== undefined && isPlainObject(decision.totals)) {
    if (!Array.isArray(decision.totals.rows) || decision.totals.rows.length === 0) {
      problems.push('"totals" must carry a non-empty "rows" array when present, or be omitted entirely')
    }
  }

  return problems
}

/**
 * The summary shape `GET /v1/proposals` returns per row — enough to render a queue without
 * fetching each proposal in full.
 */
export function validateDecisionObjectSummary(summary) {
  if (!isPlainObject(summary)) return ['summary must be an object']
  const problems = []
  if (!isNonEmptyString(summary.proposal_id)) problems.push('"proposal_id" must be a non-empty string')
  if (!isNonEmptyString(summary.story_code)) problems.push('"story_code" must be a non-empty string')
  if (!isNonEmptyString(summary.title)) problems.push('"title" must be a non-empty string')
  checkEnum(problems, summary.stage, STAGES, 'stage')
  checkEnum(problems, summary.status, STATUSES, 'status')
  if (typeof summary.on_clock !== 'boolean') problems.push('"on_clock" must be a boolean')
  // `null` is a legal typed value on the full object (see validateRequiredNullable), so it has to be
  // legal on the row copied FROM it. A queue summary that rejected what the proposal legitimately
  // says would make every list request fail on a field the list does not even render.
  if (summary.impact !== undefined && summary.impact !== null) {
    problems.push(...validateTypedNumber(summary.impact, 'impact'))
  }
  return problems
}
