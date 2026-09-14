// A small, safe, declarative predicate language for one thing only: deciding whether something is
// currently eligible/visible, by reading this stage's own real data through the exact same safe
// path resolver every block binding already uses (resolveBinding.js — never throws, a missing/null
// step just resolves to `undefined`). Two call sites share it (both via `validateCondition` for
// schema validation and `evaluateCondition` for runtime evaluation): a template-declared action's
// own eligibility gate (validateManifest.js's `actions[].when`, resolved by
// components/actionEligibility.js) and a BLOCK's own conditional-rendering gate
// (validateManifest.js's `blocks[].when`, resolved by components/StageRenderer.jsx before a block
// ever reaches binding/validation/layout — see that file's own doc comment). Same language, same
// safety guarantees, because "should this action be clickable" and "should this block exist on the
// page at all" are the same kind of question: a boolean gate over real fixture data.
//
// Deliberately NOT a general expression language — no arithmetic, no string ops, no user-supplied
// code, nothing that can loop or throw. A fixed, small operator set is the whole surface area, so a
// condition is exactly as safe to evaluate as a block binding is to resolve: pure data in, boolean
// out, never a crash.
//
// `undefined`-safe by construction, on purpose: `ne`/`notExists`/`notIn` all treat a MISSING value
// as satisfying the condition (the same "absence is not itself a block" semantics
// stageActionEligibility.js's guardrail logic always had — see actionEligibility.js for where this
// gets used to reproduce that exact behavior generically), while `eq`/`gt`/`gte`/`lt`/`lte`/`in`
// treat a missing value as NOT satisfying it — you can't safely claim a value equals/exceeds
// something you don't have. A condition that genuinely needs to REQUIRE a field's presence (fail
// closed when it's missing, rather than fail open) uses `exists` explicitly — opt-in per action,
// never a global default (see this project's own audit: never silently change fail-open to
// fail-closed without the contract saying so).

import { resolveBinding } from './resolveBinding.js'

const COMPARISON_OPS = new Set(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn'])
const EXISTENCE_OPS = new Set(['exists', 'notExists', 'truthy', 'falsy'])
export const CONDITION_OPS = new Set([...COMPARISON_OPS, ...EXISTENCE_OPS])

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

function evaluateLeaf(leaf, fixture) {
  const resolved = resolveBinding(leaf.path, fixture)
  switch (leaf.op) {
    case 'exists':
      return resolved !== undefined && resolved !== null
    case 'notExists':
      return resolved === undefined || resolved === null
    case 'truthy':
      return Boolean(resolved)
    case 'falsy':
      return !resolved
    case 'eq':
      return resolved === leaf.value
    case 'ne':
      return resolved !== leaf.value
    case 'gt':
      return isFiniteNumber(resolved) && resolved > leaf.value
    case 'gte':
      return isFiniteNumber(resolved) && resolved >= leaf.value
    case 'lt':
      return isFiniteNumber(resolved) && resolved < leaf.value
    case 'lte':
      return isFiniteNumber(resolved) && resolved <= leaf.value
    case 'in':
      return Array.isArray(leaf.value) && leaf.value.includes(resolved)
    case 'notIn':
      return !(Array.isArray(leaf.value) && leaf.value.includes(resolved))
    default:
      // An unrecognized op never silently passes a gate — validateCondition() below is what should
      // have caught this at manifest-load time; this is the last-resort safe default if it didn't.
      return false
  }
}

/**
 * @param {*} condition - `{all: [...]}` (AND, recursive), `{any: [...]}` (OR, recursive), a leaf
 *   `{path, op, value?}`, or `undefined`/`null` (no condition at all).
 * @param {object} fixture - the stage's raw fixture, resolved against exactly like a block binding.
 * @returns {boolean} `true` when `condition` is absent — no gate means always eligible.
 */
export function evaluateCondition(condition, fixture) {
  if (condition === undefined || condition === null) return true
  if (Array.isArray(condition.all)) return condition.all.every((c) => evaluateCondition(c, fixture))
  if (Array.isArray(condition.any)) return condition.any.some((c) => evaluateCondition(c, fixture))
  return evaluateLeaf(condition, fixture)
}

/**
 * Structural validation for a condition tree — plain checks, never throws, mirrors the rest of this
 * project's validators (return a problem-string list, empty = valid).
 * @param {*} condition
 * @param {string} where - a label prefix for each problem message (e.g. `"actions[0].when"`).
 * @returns {string[]}
 */
export function validateCondition(condition, where) {
  if (condition === null || typeof condition !== 'object' || Array.isArray(condition)) {
    return [`${where}: must be an object`]
  }

  if (condition.all !== undefined || condition.any !== undefined) {
    const key = condition.all !== undefined ? 'all' : 'any'
    if (condition.all !== undefined && condition.any !== undefined) {
      return [`${where}: must not declare both "all" and "any"`]
    }
    const list = condition[key]
    if (!Array.isArray(list) || list.length === 0) {
      return [`${where}: "${key}" must be a non-empty array`]
    }
    return list.flatMap((c, i) => validateCondition(c, `${where}.${key}[${i}]`))
  }

  const problems = []
  if (typeof condition.path !== 'string' || condition.path.length === 0) {
    problems.push(`${where}: "path" must be a non-empty string`)
  }
  if (typeof condition.op !== 'string' || !CONDITION_OPS.has(condition.op)) {
    problems.push(`${where}: "op" must be one of ${[...CONDITION_OPS].join(', ')}`)
  } else if (COMPARISON_OPS.has(condition.op) && condition.value === undefined) {
    problems.push(`${where}: op "${condition.op}" requires a "value"`)
  }
  return problems
}
