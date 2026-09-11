// The dedicated layout/composition layer AUDIT_REPORT.md §11/§20/§25 calls for: StageRenderer.jsx
// previously owned data-pipeline orchestration (bind -> validate -> registry) AND layout/grouping
// heuristics in the same file — a different *kind* of concern bolted onto an already-busy
// component. This module owns composition instead: turning a flat, ordered list of block
// descriptors (plus optional manifest-level `sections`) into main-region and rail-region
// section/row structures.
//
// Pure and deterministic — no React, no JSX, nothing async — so it's directly unit-testable
// (composeSections.test.js) without mounting anything. StageSections.jsx is the thin presentational
// component that turns this module's output into actual DOM.
//
// FORENSIC_AUDIT_S9.1.md §1/§5/§9/§10/§19 traced the dominant reference-fidelity gap to this
// module's *predecessor* behavior: main/rail placement used to be inferred entirely from a
// section's *name* (`compactSlots.js`'s old `RAIL_SECTION_IDS` — "guardrails"/"summary" are
// rail, everything else is main"), so a stage's own headline — classified into "summary" purely
// because its blockType happened to be a scalar `text` — silently ended up in the narrowest,
// least prominent part of the page, with zero way for a manifest to say otherwise.
//
// Region resolution is now explicit and layered (highest priority first), preserving every old
// manifest's rendering unchanged when it opts into none of this:
//   1. `item.region` ("main"|"rail") — a single block overriding its own placement.
//   2. the item's declared section's own `sectionDecls[].region` ("main"|"rail") — a section
//      saying where IT belongs, once, instead of every consumer re-guessing it from the name.
//   3. the OLD name-based heuristic (`guardrails`/`summary` => rail) — kept as the fallback for
//      any manifest (hand-authored or generated before this change) whose sections don't declare
//      a `region` at all. Never applied once a `region` is present anywhere in the input.
//   4. "main" — the safe default for anything unsectioned or otherwise unresolved (matches every
//      prior behavior: an unsectioned block, or a manifest with no `sections` at all, has always
//      rendered in the main column, never the rail).
//
// BACKWARD COMPATIBILITY IS THE CENTRAL CONSTRAINT: a manifest with no `sections`/`layout`/
// `role`/`region` anywhere renders through EXACTLY the same isGridEligible/groupIntoRows path as
// before, landing entirely in the returned `main` list — see composeSections.test.js's "legacy
// manifest (no sections, no layout)" suite for the enforcement of that guarantee.

import { isGridEligible } from './gridEligibility'
import { RAIL_SECTION_IDS as LEGACY_RAIL_SECTION_IDS } from './compactSlots'
import { inferSpan } from './blockSizing'

const MIN_SPAN = 1
const MAX_SPAN = 12
const DEFAULT_EXPLICIT_SPAN = 12 // an authored group's own member defaults to full panel width

/** Clamps a declared span to a safe integer in [MIN_SPAN, MAX_SPAN]; anything invalid/absent falls back. */
function sanitizeSpan(span, fallback) {
  const n = Number(span)
  if (!Number.isFinite(n)) return fallback
  return Math.min(MAX_SPAN, Math.max(MIN_SPAN, Math.round(n)))
}

/** A non-empty string is a real explicit group key; anything else (including absent) is not. */
function explicitGroupKey(layout) {
  return typeof layout?.group === 'string' && layout.group.trim() !== '' ? layout.group : null
}

// A single sentinel shared by every block that falls back to the heuristic (rather than an
// explicit `layout.group`) — consecutive heuristic-eligible items still merge into one row exactly
// like the pre-Phase-2 groupIntoRows did; giving them one shared key (instead of, say, `null`,
// which would mean "never group") is what makes that fallback behavior identical to before.
const HEURISTIC_GROUP = Symbol('heuristic-grid-group')

/**
 * @param {object} item - { slotName, blockType, value, layout? }. `value` is the block's already-
 *   resolved data (used only by the isGridEligible fallback — never re-derived here).
 * @returns {{ key: symbol|string|null, span: number, explicit: boolean, flowable: boolean }} the
 *   row-grouping key (null = not part of a `grid`-type row) and this item's column span. `explicit`
 *   distinguishes an authored `layout.group` (a real composed panel — e.g. a headline fused with
 *   its supporting metrics) from the automatic scalar/small-object heuristic (a metric strip) —
 *   StageSections.jsx renders the two differently. `flowable` marks an item that isn't part of
 *   either grid path but still carries a real (explicit or inferred) span, eligible for the
 *   separate mixed-width packing pass in `packFlowables` below.
 */
function groupingFor(item) {
  // A block that failed to resolve/validate (or an unknown blockType) always gets its own
  // full-width row, regardless of any declared layout — matching the pre-Phase-2 behavior of
  // always hardcoding `gridEligible: false` for a placeholder. A broken block should stand out
  // clearly, never blend into a compact grid cell next to healthy ones.
  if (item.forceFullWidth) return { key: null, span: MIN_SPAN, explicit: false, flowable: false }

  const explicit = explicitGroupKey(item.layout)
  if (explicit !== null) {
    return { key: explicit, span: sanitizeSpan(item.layout?.span, DEFAULT_EXPLICIT_SPAN), explicit: true, flowable: false }
  }
  if (isGridEligible(item.blockType, item.value)) {
    return { key: HEURISTIC_GROUP, span: MIN_SPAN, explicit: false, flowable: false }
  }
  // Not scalar-grid-eligible and not an authored group: this is exactly the "metadata is missing,
  // derive a conservative fallback from block semantics" case (RENDERED_UI_FORENSIC_AUDIT.md's
  // successor task) — a table/itemQueue/chart/large-object gets a real span (explicit if the
  // manifest declared one, inferred from its own shape otherwise) and becomes eligible for the
  // mixed-width flow-packing pass instead of automatically claiming a full row.
  const span = sanitizeSpan(item.layout?.span, inferSpan(item.blockType, item.value))
  return { key: null, span, explicit: false, flowable: true }
}

// A flow row never claims more than this many of its 12 columns — packing stops and starts a new
// row once the next item would exceed it (a table needing 8 doesn't squeeze in next to one that
// already used 6). Equal to MAX_SPAN by definition (a 12-column grid), named separately here only
// for readability at each call site.
const FLOW_ROW_CAPACITY = MAX_SPAN

/**
 * Packs a run of adjacent "flowable" items (see groupingFor) into shared rows by simple greedy
 * left-to-right bin-packing, preserving manifest order (the declared order is always the ordering
 * authority — packing only ever decides which already-adjacent items share a row, never reorders
 * them to fill space better). A row that ends up with only ONE member — the next item's span
 * always overflowed it, or it was the last flowable item in the run — is emitted as a plain
 * `single` (full-width) row instead of a lone, oddly-narrow "shared" row with empty space beside
 * it: a span suggestion only means anything when there's an actual sibling to share the row with
 * (the same principle StageSections.jsx's `LoneScalarStrip` already applies one level up).
 */
function packFlowables(flowItems) {
  const rows = []
  let current = null
  let usedSpan = 0

  for (const { slotName, span } of flowItems) {
    if (current && usedSpan + span <= FLOW_ROW_CAPACITY) {
      current.items.push({ slotName, span })
      usedSpan += span
    } else {
      current = { items: [{ slotName, span }] }
      rows.push(current)
      usedSpan = span
    }
  }

  return rows.map((row) =>
    row.items.length === 1 ? { type: 'single', slotName: row.items[0].slotName } : { type: 'flow', items: row.items },
  )
}

/**
 * Walks one ordered list of items and folds adjacent same-key items into rows — the same
 * adjacency-only rule the original groupIntoRows used (two blocks with the same explicit `group`
 * that AREN'T adjacent do not merge across unrelated content in between; author them adjacently,
 * or put them in the same `section` and adjacent within it, if they belong together).
 *
 * `allowFlow` gates the new mixed-width packing pass to the MAIN region only (see
 * composeOneRegion) — the rail's own composition (a single shared compact panel per section,
 * StageSections.jsx's `RailPanel`) is untouched and was never asked to change.
 */
function groupIntoRows(items, allowFlow) {
  const rows = []
  let current = null
  let currentKey = undefined
  let flowRun = []

  function flushFlowRun() {
    if (flowRun.length > 0) {
      rows.push(...packFlowables(flowRun))
      flowRun = []
    }
  }

  for (const item of items) {
    const { key, span, explicit, flowable } = groupingFor(item)

    if (allowFlow && flowable) {
      current = null
      currentKey = undefined
      flowRun.push({ slotName: item.slotName, span })
      continue
    }
    flushFlowRun()

    if (key !== null && key === currentKey) {
      current.items.push({ slotName: item.slotName, span })
    } else if (key !== null) {
      current = { type: 'grid', explicit, items: [{ slotName: item.slotName, span }] }
      rows.push(current)
      currentKey = key
    } else {
      rows.push({ type: 'single', slotName: item.slotName })
      current = null
      currentKey = undefined
    }
  }
  flushFlowRun()
  return rows
}

function isValidSectionDecl(s) {
  return s !== null && typeof s === 'object' && typeof s.id === 'string' && s.id.trim() !== ''
}

/**
 * @param {Array<{id, region?}>} validSections
 * @returns {Map<string, 'main'|'rail'>} only for sections that declared a real region — an entry
 *   absent from this map falls through to the legacy name-based heuristic, never to a made-up default.
 */
function declaredRegionsById(validSections) {
  const map = new Map()
  for (const s of validSections) {
    if (s.region === 'main' || s.region === 'rail') map.set(s.id, s.region)
  }
  return map
}

/**
 * Resolves one item's effective region using the layered priority documented at the top of this
 * file: an explicit per-block override, then its section's declared region, then the legacy
 * name-based guess, then "main".
 */
function regionOf(item, declaredRegions) {
  if (item.region === 'main' || item.region === 'rail') return item.region
  if (typeof item.section === 'string') {
    if (declaredRegions.has(item.section)) return declaredRegions.get(item.section)
    if (LEGACY_RAIL_SECTION_IDS.has(item.section)) return 'rail'
  }
  return 'main'
}

/**
 * Buckets one region's own items into declared sections (in declared order), plus one trailing
 * implicit section for anything unsectioned within this region — the same algorithm this module
 * always used, just now run once per region instead of once for the whole stage. `allowFlow`
 * (true only for the main region) is threaded straight through to `groupIntoRows`.
 */
function composeOneRegion(items, validSections, allowFlow) {
  const sectionIds = new Set(validSections.map((s) => s.id))
  const bySection = new Map(validSections.map((s) => [s.id, []]))
  const unsectioned = []

  for (const item of items) {
    const targetId = typeof item.section === 'string' && sectionIds.has(item.section) ? item.section : null
    if (targetId === null) unsectioned.push(item)
    else bySection.get(targetId).push(item)
  }

  const result = validSections
    .map((s) => ({
      id: s.id,
      title: typeof s.title === 'string' ? s.title : null,
      rows: groupIntoRows(bySection.get(s.id), allowFlow),
    }))
    .filter((s) => s.rows.length > 0) // an empty declared section renders nothing

  if (unsectioned.length > 0) {
    result.push({ id: null, title: null, rows: groupIntoRows(unsectioned, allowFlow) })
  }

  return result
}

/**
 * @param {Array<{slotName, blockType, value, layout?, section?, region?}>} items - in manifest
 *   .blocks[] order (the declared order is always the ordering authority — sections/groups/
 *   regions only ever reshuffle *presentation*, never invent an order of their own).
 * @param {*} sectionDecls - manifest.sections, whatever it happens to be (untrusted input — may be
 *   absent, malformed, or reference section ids no block uses).
 * @returns {{ main: Array<{id,title,rows}>, rail: Array<{id,title,rows}> }} each list holds one
 *   entry per section that landed in that region (in declared order), followed by at most one
 *   trailing implicit section (id: null) for that region's own unsectioned blocks. A manifest with
 *   no `sections`/`region` anywhere collapses to `{ main: [{id:null, title:null, rows:[...]}], rail: [] }`
 *   — every block in one implicit main-region bucket, which is what makes old manifests render
 *   unchanged (see this module's own top-of-file doc comment).
 */
export function composeSections(items, sectionDecls) {
  const validSections = Array.isArray(sectionDecls) ? sectionDecls.filter(isValidSectionDecl) : []
  const declaredRegions = declaredRegionsById(validSections)

  const mainItems = []
  const railItems = []
  for (const item of items) {
    ;(regionOf(item, declaredRegions) === 'rail' ? railItems : mainItems).push(item)
  }

  return {
    main: composeOneRegion(mainItems, validSections, true),
    rail: composeOneRegion(railItems, validSections, false),
  }
}
