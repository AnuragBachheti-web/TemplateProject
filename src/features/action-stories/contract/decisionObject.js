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

/** Axis 5. `locked` is the one axis value that participates in template selection (see selectTemplate). */
export const ENTITLEMENTS = ['full', 'limited', 'locked']

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

  // optional business fields
  if (decision.impact !== undefined) problems.push(...validateTypedNumber(decision.impact, 'impact'))
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
  if (decision.guardrails !== undefined) {
    if (!isPlainObject(decision.guardrails)) {
      problems.push('"guardrails" must be an object')
    } else {
      checkEnum(problems, decision.guardrails.verdict, GUARDRAIL_VERDICTS, 'guardrails.verdict')
      if (decision.guardrails.checks !== undefined && !Array.isArray(decision.guardrails.checks)) {
        problems.push('"guardrails.checks" must be an array when present')
      }
    }
  }
  for (const key of ['totals', 'execution', 'context']) {
    if (decision[key] !== undefined && !isPlainObject(decision[key])) {
      problems.push(`"${key}" must be an object when present`)
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
  if (summary.impact !== undefined) problems.push(...validateTypedNumber(summary.impact, 'impact'))
  return problems
}
