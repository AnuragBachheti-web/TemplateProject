#!/usr/bin/env node
// extraction/audit.js
//
// Standalone, read-only, re-runnable auditor for the Action Stories extraction pipeline.
// Reads every fixture in src/features/action-stories/data/raw/ and every generated manifest in
// src/features/action-stories/manifests/, and checks them for two bug families:
//
//   AUDIT A — DATA FIDELITY: is every real field actually reaching the screen?
//     A.1 non-scalar (serialized DOM/JSX node) leakage into raw data
//     A.2 coordinate/geometry key completeness (chart-shape under-match backstop)
//     A.3 field-coverage: orphaned raw keys, and "classified correctly but incomplete" blocks
//     A.4 cross-story consistency: same data shape classified differently in different workflows
//
//   AUDIT B — LAYOUT DENSITY (separate from data correctness):
//     B.1 scalar-block density per stage
//     B.2 full-width waste on scalar blocks
//
// This script NEVER modifies data/raw, manifests, or any block component — it only reads them and
// writes extraction/audit-report.md. Re-run any time with `npm run audit`.
//
// Where this script duplicates logic instead of importing it (block components' own
// decorative-key filters, ItemQueueBlock's headline/detail picking, etc.), that mirrors the
// existing project convention — see e.g. TableBlock.jsx's and ItemQueueBlock.jsx's own local
// copies of "is this a decorative key" — those runtime files are never imported by generation-only
// tooling, and this audit tool deliberately doesn't import runtime React components either.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { classifyBlockType } from './classifyBlocks.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(REPO_ROOT, 'src/features/action-stories/data')
const RAW_DIR = path.join(DATA_DIR, 'raw')
const MANIFESTS_DIR = path.join(REPO_ROOT, 'src/features/action-stories/manifests')
const OUT_PATH = path.join(__dirname, 'audit-report.md')

// ============================================================================================
// Shared helpers (small, local copies of logic that lives in classifyBlocks.js / the block
// components — kept independent on purpose, same pattern the components themselves use)
// ============================================================================================

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function isNumericLike(v) {
  if (typeof v === 'number') return Number.isFinite(v)
  if (typeof v === 'string' && v.trim() !== '') return Number.isFinite(Number(v))
  return false
}

// --- decorative-key / pure-style filtering (mirrors extraction/classifyBlocks.js) ---

const STYLE_VALUE_PATTERNS = [/^var\(--/, /^#[0-9a-f]{3,8}$/i, /^rgba?\(/i, /^color-mix\(/i, /^linear-gradient\(/i]
const STYLE_KEYWORD_VALUES = new Set([
  'inline-flex', 'flex', 'flex-start', 'flex-end', 'none', 'block', 'inline', 'inline-block',
  'grid', 'center', 'pointer', 'default', 'not-allowed', 'wait', 'row', 'column',
])
function isStyleString(v) {
  return typeof v === 'string' && (STYLE_KEYWORD_VALUES.has(v) || STYLE_VALUE_PATTERNS.some((re) => re.test(v)))
}
function isPureStyleValue(v) {
  if (isStyleString(v)) return true
  if (Array.isArray(v) && v.length > 0) {
    return v.every((item) => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) return false
      return Object.values(item).every((sub) => isStyleString(sub))
    })
  }
  return false
}

const DECORATIVE_KEY_SUFFIX_RE = /(Bg|Fg|Tone|Tint|Border|Cursor|Icon|Glow|Edge|Dot|Shadow|Opacity|Mark|Hue|Fill|Stroke)$/
const DECORATIVE_EXACT_KEYS = new Set([
  'icon', 'tone', 'tint', 'bg', 'border', 'mark', 'hue', 'fill', 'stroke', 'cursor', 'shadow', 'opacity', 'edge', 'glow',
])
function isDecorativeKey(key) {
  return DECORATIVE_EXACT_KEYS.has(key) || DECORATIVE_KEY_SUFFIX_RE.test(key)
}
function meaningfulKeys(item) {
  return Object.keys(item).filter((k) => !isDecorativeKey(k) && !isPureStyleValue(item[k]))
}

// --- ItemQueueBlock's actual picking logic (mirrors blocks/ItemQueueBlock.jsx) ---
const IQ_HEADLINE_KEYS = ['title', 'name', 'label', 'product', 'theme', 'verdict', 'lens', 'term', 'date', 'when']
const IQ_DETAIL_KEYS = ['note', 'detail', 'summary', 'body', 'reason', 'rationale', 'rule', 'quote', 'text', 'sub', 'what', 'definition']
const IQ_IDENTIFIER_KEYS = ['sku', 'id', 'caseId', 'ref']
const IQ_STATE_KEYS = ['status', 'state']
const IQ_SEVERITY_KEYS = ['severity']
function pickKey(item, keys) {
  return keys.find((k) => item[k] !== undefined && item[k] !== null)
}

// --- ObjectBlock's actual renderable-entry logic (mirrors blocks/ObjectBlock.jsx) ---
const OB_STYLE_VALUE_RE = /^(var\(--|#[0-9a-f]{3,8}$|rgba?\(|color-mix\(|linear-gradient\()/i
function obIsStyleString(v) {
  return typeof v === 'string' && OB_STYLE_VALUE_RE.test(v)
}
function obIsRenderablePrimitive(v) {
  return (typeof v === 'string' && !obIsStyleString(v)) || typeof v === 'number' || typeof v === 'boolean'
}
function obIsReactDescriptor(v) {
  return v !== null && typeof v === 'object' && 'type' in v && typeof v.props === 'object'
}
// Mirrors ObjectBlock.jsx's renderEntryValue: primitives, JSX descriptors, arrays (joined), and
// one level of nested plain object (joined) all render as text; anything that still reduces to
// '' after that is genuinely dropped.
function objectRenderText(v) {
  if (obIsRenderablePrimitive(v)) return String(v)
  if (obIsReactDescriptor(v)) return flattenJsxPreview(v)
  // Compact per-item summary (flattenNestedEntry), not a full field-by-field dump — mirrors
  // ObjectBlock.jsx's own fix for this (a 9-item chart-bar array would otherwise turn into an
  // unreadable wall of pixel-position numbers instead of "PRICE $24.00, COGS −$10.56, …").
  if (Array.isArray(v)) return v.map(flattenNestedEntryPreview).filter(Boolean).join(', ')
  if (isPlainObject(v)) {
    return Object.entries(v)
      .map(([k, sub]) => {
        const text = objectRenderText(sub)
        return text ? `${k}: ${text}` : ''
      })
      .filter(Boolean)
      .join(', ')
  }
  return ''
}

// The 5 chart blockTypes classifyBlocks.js can produce for an array-of-objects value.
const CHART_BLOCK_TYPES = new Set(['lineChart', 'barChart', 'scatterChart', 'waterfallChart', 'heatmapGrid'])

// --- A.2's broader geometry candidate vocabulary (deliberately wider than classifyBlocks.js's
// own CHART_COORD_KEYS/CHART_MAGNITUDE_KEYS) ---
const GEOMETRY_CANDIDATE_KEYS = new Set([
  'x', 'y', 'cx', 'cy', 'r', 'h', 'value', 'size', 'weight', 'radius', 'width', 'height', 'angle',
])
function looksLikeShortNumericKey(key, value) {
  return /^[a-z]{1,2}$/i.test(key) && isNumericLike(value)
}

function flattenPreview(value, maxLen = 90) {
  let text
  try {
    text = JSON.stringify(value)
  } catch {
    text = String(value)
  }
  if (text.length > maxLen) text = text.slice(0, maxLen) + '…'
  return text
}

// A tiny recursive re-implementation of flattenDisplayValue.js, used only to show a human-readable
// preview of a JSX-shaped leak in the report (not to change any actual rendering behavior).
function flattenJsxPreview(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map(flattenJsxPreview).filter(Boolean).join(' ')
  if (isPlainObject(value) && 'type' in value && isPlainObject(value.props)) {
    return flattenJsxPreview(value.props.children)
  }
  return ''
}

// Mirrors blocks/nestedEntryText.js's flattenNestedEntry — the compact "label (+ value)" /
// "field: before → after" per-item summary ItemQueueBlock's sub-lists, LabelValueListBlock's
// extra entries, and ObjectBlock's array entries all use, instead of a full field-by-field dump.
function flattenNestedEntryPreview(entry) {
  if (entry === null || entry === undefined) return ''
  if (typeof entry !== 'object') return flattenJsxPreview(entry)
  if ('field' in entry && 'before' in entry && 'after' in entry) {
    return `${flattenJsxPreview(entry.field)}: ${flattenJsxPreview(entry.before)} → ${flattenJsxPreview(entry.after)}`
  }
  if ('label' in entry) {
    const v = entry.value !== undefined ? ` ${flattenJsxPreview(entry.value)}` : ''
    return `${flattenJsxPreview(entry.label)}${v}`
  }
  return flattenJsxPreview(entry)
}

// ============================================================================================
// Loading fixtures + manifests
// ============================================================================================

function loadIndex() {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'index.json'), 'utf8'))
}

function loadFixture(code, stageKey) {
  const p = path.join(RAW_DIR, code, `${stageKey}.json`)
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function loadManifest(code) {
  const p = path.join(MANIFESTS_DIR, `${code}.json`)
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function rawKeyFromBinding(binding) {
  // Every binding the generator produces is exactly "data.<rawKey>" (see
  // extraction/generateManifests.js buildStageManifest) — no nested bindings exist today. Handled
  // defensively anyway: strip a leading "data." if present, else use the whole binding.
  if (typeof binding !== 'string') return binding
  return binding.startsWith('data.') ? binding.slice('data.'.length) : binding
}

// ============================================================================================
// AUDIT A.1 — non-scalar (serialized DOM/JSX node) leakage scan
// ============================================================================================

function isJsxNodeShape(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false
  if (typeof v.type !== 'string') return false
  if (v.props === null || typeof v.props !== 'object' || Array.isArray(v.props)) return false
  return 'children' in v.props
}

function pathToString(segments) {
  let out = ''
  for (const seg of segments) {
    if (typeof seg === 'number') out += `[${seg}]`
    else out += out ? `.${seg}` : seg
  }
  return out
}

/**
 * Walks a whole fixture JSON tree looking for isJsxNodeShape matches. Stops descending into a
 * matched node's own subtree (the leak is reported at the outermost point it occurs — a nested
 * <strong>/<span> inside an already-flagged node's children is part of the same leak, not a
 * separate one), but keeps walking every other sibling/branch of the tree.
 */
function findJsxLeaks(root) {
  const hits = []
  function walk(value, segments) {
    if (value === null || typeof value !== 'object') return
    if (isJsxNodeShape(value)) {
      hits.push({ path: pathToString(segments), value })
      return // don't descend into the leaked node's own children
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, [...segments, i]))
    } else {
      for (const [k, v] of Object.entries(value)) {
        walk(v, [...segments, k])
      }
    }
  }
  walk(root, [])
  return hits
}

function runAuditA1(stages) {
  const groups = [] // { file, code, stageKey, containerPath, occurrences: [{path, value}] }
  for (const s of stages) {
    const hits = findJsxLeaks(s.fixture.data ?? {})
    if (hits.length === 0) continue
    // Group hits by their "container path" (path with trailing array index stripped) so e.g.
    // rows[0].product, rows[1].product, ... rows[9].product report as one group with 10
    // occurrences, matching the natural unit of "this column leaks" rather than one write-up per
    // row.
    const byContainer = new Map()
    for (const hit of hits) {
      const container = hit.path.replace(/\[\d+\]/g, '[]')
      if (!byContainer.has(container)) byContainer.set(container, [])
      byContainer.get(container).push(hit)
    }
    for (const [container, occurrences] of byContainer) {
      groups.push({
        code: s.code,
        stageKey: s.stageKey,
        file: `src/features/action-stories/data/raw/${s.code}/${s.stageKey}.json`,
        containerPath: container,
        occurrences,
      })
    }
  }
  return groups
}

// ============================================================================================
// AUDIT A.2 — coordinate/geometry key completeness (chart-shape under-match backstop)
// ============================================================================================
//
// This used to have an "over-match" half too (a 'series' block whose rows don't cleanly fit its
// own coordinate shape) — that's now redundant: classifyBlocks.js produces 5 precise, narrow chart
// signatures instead of one broad heuristic, and extraction/generateManifests.js's self-check
// already re-validates every block's binding against its own blockType's real validator on every
// run (see its "self-check problems" count) — which catches classifier/validator drift for any
// block type, generically, not just charts. Only the under-match half still adds anything: a
// backstop for a genuinely chart-shaped block that none of the 5 narrow signatures happened to
// catch.

function runAuditA2(stages) {
  const underMatches = []

  for (const s of stages) {
    for (const block of s.manifest?.blocks ?? []) {
      if (CHART_BLOCK_TYPES.has(block.blockType)) continue
      const rawKey = rawKeyFromBinding(block.binding)
      const value = s.fixture.data?.[rawKey]
      if (!Array.isArray(value) || value.length === 0) continue
      if (!isPlainObject(value[0])) continue

      const objectRows = value.filter(isPlainObject)
      if (objectRows.length === 0) continue
      const keys = meaningfulKeys(objectRows[0])
      if (keys.length === 0) continue
      const geoMatches = keys.filter((k) => GEOMETRY_CANDIDATE_KEYS.has(k) || looksLikeShortNumericKey(k, objectRows[0][k]))
      const ratio = geoMatches.length / keys.length
      if (ratio > 0.5) {
        underMatches.push({
          code: s.code, stageKey: s.stageKey, slotName: block.slotName, binding: block.binding,
          blockType: block.blockType, keys, geoMatches, ratio, rowCount: objectRows.length,
          sample: flattenPreview(objectRows[0]),
        })
      }
    }
  }
  return { underMatches }
}

// ============================================================================================
// AUDIT A.3 — field-coverage / silent-drop check
// ============================================================================================

function runAuditA3(stages) {
  const orphaned = [] // real data.<key> that no block binding points to at all
  const incomplete = [] // block classified correctly, but its renderer drops some of its own keys

  for (const s of stages) {
    const dataKeys = Object.keys(s.fixture.data ?? {})
    const boundRawKeys = new Set((s.manifest?.blocks ?? []).map((b) => rawKeyFromBinding(b.binding)))
    for (const key of dataKeys) {
      if (boundRawKeys.has(key)) continue
      const value = s.fixture.data[key]
      // Mirror planSlotNames' own pre-filter: a pure-style value (a bare CSS var/color/keyword, or
      // an array of nothing but decorative sub-fields) is never even considered for a slot name in
      // the real pipeline, so it isn't a real "orphan" — it was correctly, deliberately excluded.
      if (isPureStyleValue(value)) continue
      const wouldBeAssignedType = classifyBlockType(value, key)
      if (wouldBeAssignedType !== null) {
        orphaned.push({ code: s.code, stageKey: s.stageKey, rawKey: key, wouldBeType: wouldBeAssignedType, sample: flattenPreview(value) })
      }
    }

    for (const block of s.manifest?.blocks ?? []) {
      const rawKey = rawKeyFromBinding(block.binding)
      const value = s.fixture.data?.[rawKey]

      // NOTE on the four checks below: each mirrors that block type's *current* renderer exactly
      // (ItemQueueBlock/LabelValueListBlock/ObjectBlock/TableBlock all now surface an "extra
      // fields" pass and/or union columns across rows — see each component's own comments), so
      // this only flags what's genuinely still unreachable today, not what the renderer already
      // recovered.

      if (block.blockType === 'itemQueue' && Array.isArray(value)) {
        const items = value.filter((it) => isPlainObject(it))
        if (items.length === 0) continue
        const droppedKeys = new Set()
        for (const item of items) {
          const headlineKey = pickKey(item, IQ_HEADLINE_KEYS)
          const detailKey = pickKey(item, IQ_DETAIL_KEYS)
          const idKey = pickKey(item, IQ_IDENTIFIER_KEYS)
          const stateKey = pickKey(item, IQ_STATE_KEYS)
          const sevKey = pickKey(item, IQ_SEVERITY_KEYS)
          const used = new Set([headlineKey, detailKey, idKey, stateKey, sevKey].filter(Boolean))
          for (const [k, v] of Object.entries(item)) {
            if (used.has(k) || isDecorativeKey(k)) continue // extra-fields pass excludes these too
            if (v === null || v === undefined || v === '' || Array.isArray(v)) continue // nothing to show either way (empty string: correctly invisible, same as EmptyState; non-empty array: rendered as a nested sub-list)
            if (flattenJsxPreview(v)) continue // extra-fields pass DOES render this — not dropped
            droppedKeys.add(k) // only a value that still flattens to '' (e.g. a nested plain object) is genuinely still dropped
          }
        }
        if (droppedKeys.size > 0) {
          incomplete.push({
            code: s.code, stageKey: s.stageKey, slotName: block.slotName, binding: block.binding,
            blockType: 'itemQueue', droppedKeys: [...droppedKeys], rowCount: items.length,
            sample: flattenPreview(items[0]),
          })
        }
      }

      if (block.blockType === 'labelValueList' && Array.isArray(value)) {
        const KNOWN = new Set(['label', 'value', 'note', 'detail', 'amount', 'pct'])
        const dropped = new Set()
        for (const item of value) {
          if (!isPlainObject(item)) continue
          for (const [k, v] of Object.entries(item)) {
            if (KNOWN.has(k) || isDecorativeKey(k)) continue
            if (v === null || v === undefined || v === '') continue // nothing to show — correctly invisible, same as EmptyState
            // extra-entries pass (LabelValueListBlock.jsx's entryText) renders anything flattenable
            // — including an array, via a per-item summary rather than flattenDisplayValue alone.
            const text = Array.isArray(v) ? v.map(flattenNestedEntryPreview).filter(Boolean).join(', ') : flattenJsxPreview(v)
            if (text) continue // renders fine — not dropped
            dropped.add(k) // only a value that still produces no text is genuinely still dropped
          }
        }
        if (dropped.size > 0) {
          incomplete.push({
            code: s.code, stageKey: s.stageKey, slotName: block.slotName, binding: block.binding,
            blockType: 'labelValueList', droppedKeys: [...dropped], rowCount: value.length,
            sample: flattenPreview(value.find((v) => isPlainObject(v)) ?? value[0]),
          })
        }
      }

      if (block.blockType === 'object' && isPlainObject(value)) {
        // Mirrors ObjectBlock's renderEntryValue: primitives, JSX descriptors, arrays (joined),
        // and one level of nested plain object (joined) all now render — only something that
        // still reduces to '' after that (a 2+-level-deep nested object, mainly) is truly dropped.
        // A decorative-named key, a bare style-string value, or an empty string are excluded here
        // deliberately — ObjectBlock is *correct* to show nothing for those (same as
        // TextBlock/NumberBlock treat an empty value as EmptyState); they aren't a bug, so they
        // don't belong in this report.
        const dropped = Object.entries(value)
          .filter(
            ([k, v]) =>
              v !== null && v !== undefined && v !== '' && !isDecorativeKey(k) && !obIsStyleString(v) && objectRenderText(v) === '',
          )
          .map(([k]) => k)
        if (dropped.length > 0) {
          incomplete.push({
            code: s.code, stageKey: s.stageKey, slotName: block.slotName, binding: block.binding,
            blockType: 'object', droppedKeys: dropped, rowCount: 1, sample: flattenPreview(value),
          })
        }
      }

      // No table check here: TableBlock now unions column keys across every row rather than
      // reading row 0 alone, so "a later row has a key row 0 doesn't" is no longer a drop at all.
    }
  }
  return { orphaned, incomplete }
}

// ============================================================================================
// AUDIT A.4 — cross-story consistency check
// ============================================================================================

const SHAPE_ELIGIBLE_TYPES = new Set([
  'table', 'itemQueue', 'labelValueList', 'lineChart', 'barChart', 'scatterChart', 'waterfallChart', 'heatmapGrid',
])

function shapeSignature(value) {
  if (!Array.isArray(value) || value.length === 0) return null
  const n = value.length
  const first = value[0]
  if (isPlainObject(first)) {
    const keys = meaningfulKeys(first).sort()
    if (keys.length === 0) return null
    const types = keys.map((k) => `${k}:${typeof first[k]}`).join(',')
    return `n=${n}|keys=${keys.join(',')}|types=${types}`
  }
  return `n=${n}|keys=(bare)|types=(bare):${typeof first}`
}

function looseShapeSignature(value) {
  if (!Array.isArray(value) || value.length === 0) return null
  const first = value[0]
  if (isPlainObject(first)) {
    const keys = meaningfulKeys(first).sort()
    if (keys.length === 0) return null
    const types = keys.map((k) => `${k}:${typeof first[k]}`).join(',')
    return `keys=${keys.join(',')}|types=${types}`
  }
  return `keys=(bare)|types=(bare):${typeof first}`
}

function runAuditA4(stages) {
  const strictGroups = new Map() // signature -> [{code, stageKey, slotName, blockType}]
  const looseGroups = new Map()

  for (const s of stages) {
    for (const block of s.manifest?.blocks ?? []) {
      if (!SHAPE_ELIGIBLE_TYPES.has(block.blockType)) continue
      const rawKey = rawKeyFromBinding(block.binding)
      const value = s.fixture.data?.[rawKey]
      const occurrence = { code: s.code, stageKey: s.stageKey, slotName: block.slotName, blockType: block.blockType }

      const sig = shapeSignature(value)
      if (sig) {
        if (!strictGroups.has(sig)) strictGroups.set(sig, [])
        strictGroups.get(sig).push(occurrence)
      }
      const loose = looseShapeSignature(value)
      if (loose) {
        if (!looseGroups.has(loose)) looseGroups.set(loose, [])
        looseGroups.get(loose).push(occurrence)
      }
    }
  }

  const strictInconsistent = [...strictGroups.entries()]
    .map(([sig, occs]) => ({ sig, occs, types: new Set(occs.map((o) => o.blockType)) }))
    .filter((g) => g.types.size > 1)

  const looseInconsistent = [...looseGroups.entries()]
    .map(([sig, occs]) => ({ sig, occs, types: new Set(occs.map((o) => o.blockType)) }))
    .filter((g) => g.types.size > 1)

  return { strictInconsistent, looseInconsistent }
}

// ============================================================================================
// AUDIT B.1 / B.2 — layout density
// ============================================================================================

const SCALAR_TYPES = new Set(['text', 'number', 'flag', 'object'])

function leafCount(blockType, value) {
  if (blockType === 'text' || blockType === 'number' || blockType === 'flag') return 1
  if (blockType === 'object' && isPlainObject(value)) {
    return Object.entries(value).filter(([, v]) => objectRenderText(v) !== '').length
  }
  return Infinity // not a scalar-eligible shape
}

// Rough content-width estimate in characters — this is a heuristic, not a pixel measurement (see
// report notes). Each block type's single widest rendered row is what actually bounds its ideal
// width, since TextBlock/NumberBlock/FlagBlock/ObjectBlock all stack label-above-value or
// label-beside-value in one column.
function estimateMaxRowChars(blockType, slotName, value) {
  const labelLen = slotName.length
  if (blockType === 'text' && typeof value === 'string') return Math.max(labelLen, value.length)
  if (blockType === 'number') return Math.max(labelLen, String(value?.toLocaleString?.() ?? value).length)
  if (blockType === 'flag') return labelLen + 6 // label + "Yes"/"No" pill
  if (blockType === 'object' && isPlainObject(value)) {
    let max = labelLen
    for (const [k, v] of Object.entries(value)) {
      const text = objectRenderText(v)
      if (!text) continue
      max = Math.max(max, k.length + text.length + 3)
    }
    return max
  }
  return Infinity
}

function runAuditB(stages) {
  const densityFlags = [] // stages > 40% scalar-low-cardinality blocks
  const widthFlags = [] // individual scalar blocks that would comfortably fit at half/third width

  for (const s of stages) {
    const blocks = s.manifest?.blocks ?? []
    if (blocks.length === 0) continue
    let scalarLowCardCount = 0
    for (const block of blocks) {
      const rawKey = rawKeyFromBinding(block.binding)
      const value = s.fixture.data?.[rawKey]
      if (!SCALAR_TYPES.has(block.blockType)) continue
      const leaves = leafCount(block.blockType, value)
      if (leaves <= 3) scalarLowCardCount++

      const maxRowChars = estimateMaxRowChars(block.blockType, block.slotName, value)
      if (maxRowChars <= 20) {
        widthFlags.push({ code: s.code, stageKey: s.stageKey, slotName: block.slotName, blockType: block.blockType, maxRowChars, tier: 'third' })
      } else if (maxRowChars <= 40) {
        widthFlags.push({ code: s.code, stageKey: s.stageKey, slotName: block.slotName, blockType: block.blockType, maxRowChars, tier: 'half' })
      }
    }
    const density = scalarLowCardCount / blocks.length
    if (density > 0.4) {
      densityFlags.push({ code: s.code, stageKey: s.stageKey, density, scalarLowCardCount, totalBlocks: blocks.length })
    }
  }
  return { densityFlags, widthFlags }
}

// ============================================================================================
// Report writer
// ============================================================================================

function fmtPct(n) {
  return `${(n * 100).toFixed(0)}%`
}

function writeReport(stages, results) {
  const { a1, a2, a3, a4, b } = results
  const totalBlocks = stages.reduce((sum, s) => sum + (s.manifest?.blocks?.length ?? 0), 0)

  const a1Count = a1.reduce((sum, g) => sum + g.occurrences.length, 0)
  const a2Count = a2.underMatches.length
  const a4Count = a4.strictInconsistent.length + a4.looseInconsistent.length
  const bCount = b.densityFlags.length + b.widthFlags.length

  const dataLossCount = a1Count + a3.orphaned.length
  const misclassificationCount = a2Count + a3.incomplete.length + a4Count
  const layoutOnlyCount = bCount
  const totalIssues = dataLossCount + misclassificationCount + layoutOnlyCount

  const lines = []
  lines.push('# Action Stories audit report')
  lines.push('')
  lines.push(`Generated by \`extraction/audit.js\` (read-only — no fixes applied) on ${new Date().toISOString()}.`)
  lines.push('')
  lines.push('## Top line')
  lines.push('')
  lines.push(`- Workflows audited: ${stages.reduce((set, s) => set.add(s.code), new Set()).size}`)
  lines.push(`- Stage manifests audited: ${stages.length}`)
  lines.push(`- Total blocks audited: ${totalBlocks}`)
  lines.push(`- **Total issues found: ${totalIssues}**`)
  lines.push(`  - Data loss: ${dataLossCount} (A.1: ${a1Count}, A.3-orphaned: ${a3.orphaned.length})`)
  lines.push(`  - Misclassification: ${misclassificationCount} (A.2: ${a2Count}, A.3-incomplete: ${a3.incomplete.length}, A.4: ${a4Count})`)
  lines.push(`  - Layout only: ${layoutOnlyCount} (B.1: ${b.densityFlags.length}, B.2: ${b.widthFlags.length})`)
  lines.push('')
  lines.push('## Summary by category')
  lines.push('')
  lines.push('| Check | Occurrences | Groups |')
  lines.push('|---|---|---|')
  lines.push(`| A.1 non-scalar (JSX node) leakage | ${a1Count} | ${a1.length} |`)
  lines.push(`| A.2 geometry under-match (looks chart-shaped, not classified as one) | ${a2.underMatches.length} | — |`)
  lines.push(`| A.3 orphaned raw keys | ${a3.orphaned.length} | — |`)
  lines.push(`| A.3 classified-but-incomplete blocks | ${a3.incomplete.length} | — |`)
  lines.push(`| A.4 strict shape-signature inconsistencies (exact row count) | ${a4.strictInconsistent.length} | — |`)
  lines.push(`| A.4 loose shape-signature inconsistencies (ignoring row count, informational) | ${a4.looseInconsistent.length} | — |`)
  lines.push(`| B.1 stages over 40% scalar density | ${b.densityFlags.length} | — |`)
  lines.push(`| B.2 scalar blocks that would fit at half/third width | ${b.widthFlags.length} | — |`)
  lines.push('')

  // ---------------- BUCKET 1: DATA LOSS ----------------
  lines.push('---')
  lines.push('')
  lines.push('## Bucket 1 — Data loss')
  lines.push('')
  lines.push('Real content that a user will never see at all, under any circumstances.')
  lines.push('')
  lines.push(`### A.1 — Non-scalar (serialized DOM/JSX node) leakage (${a1Count} occurrences in ${a1.length} groups)`)
  lines.push('')
  if (a1.length === 0) {
    lines.push('None found.')
  } else {
    for (const g of a1) {
      lines.push(`#### \`${g.code}/${g.stageKey}\` — \`data.${g.containerPath}\` (${g.occurrences.length} occurrence(s))`)
      lines.push('')
      lines.push(`- **File:** \`${g.file}\``)
      lines.push(
        `- **What the raw data actually is:** a serialized DOM/JSX node — an object shaped like ` +
          `\`{ type: "<tag>", props: { ...style, children: ... } }\` — captured verbatim from the mockup's own ` +
          `rendered output by \`extraction/dcLogicSandbox.js\`'s React stub, instead of the plain scalar value the ` +
          `field conceptually holds.`,
      )
      lines.push(
        `- **What the current logic does with it, and why:** \`extraction/classifyBlocks.js\`'s \`classifyBlockType\` ` +
          `(around its "Table-shaped" check, ~line 129) requires every column value to be ` +
          '`string`/`number`/`boolean` to classify an array as `\'table\'`; an object-valued column like this fails ' +
          `that check, so the whole array is classified \`'itemQueue'\` instead. \`ItemQueueBlock.jsx\`'s \`Item()\` ` +
          `only recovers text from a JSX-shaped value when that key is one of its \`HEADLINE_KEYS\` (via ` +
          '`flattenDisplayValue`); for any other key, or under `LabelValueListBlock`/`ObjectBlock`/`TableBlock` (whose ' +
          `renderer doesn't special-case this shape), the value renders as \`[object Object]\` or is dropped entirely.`,
      )
      lines.push(
        `- **Why that's wrong:** whether the value survives at all is an accident of which key name it happens to ` +
          `carry and which block type the rest of the array got classified as — not a deliberate design.`,
      )
      lines.push(
        `- **Proposed fix (not applied):** flatten these fields to plain scalars at extraction time (in ` +
          `\`extraction/parseMockup.js\`/\`dcLogicSandbox.js\`, using the same logic as \`flattenDisplayValue.js\`) ` +
          `before they ever reach \`data/raw/\`, so every downstream classifier/renderer sees a plain string.`,
      )
      lines.push('')
      lines.push('Occurrences:')
      lines.push('')
      for (const occ of g.occurrences) {
        lines.push(`- \`data.${occ.path}\` → flattened text: "${flattenJsxPreview(occ.value)}" — raw: \`${flattenPreview(occ.value)}\``)
      }
      lines.push('')
    }
  }

  lines.push(`### A.3 — Orphaned raw keys (${a3.orphaned.length})`)
  lines.push('')
  lines.push(
    'A raw `data.<key>` field that has real, classifiable content (per `classifyBlockType`) but that no block in ' +
      "the stage's manifest binds to at all — the manifest generator's `planSlotNames`/`buildStageManifest` " +
      '(`extraction/generateManifests.js`) is supposed to create exactly one block per non-decorative, ' +
      'non-empty top-level key, so any hit here means the manifest on disk is stale relative to the raw fixture, ' +
      'or a generator bug is silently skipping a real field.',
  )
  lines.push('')
  if (a3.orphaned.length === 0) {
    lines.push('None found — every real top-level `data` key in every fixture has a corresponding block binding in its manifest.')
  } else {
    for (const o of a3.orphaned) {
      lines.push(
        `- \`${o.code}/${o.stageKey}\`: \`data.${o.rawKey}\` (would classify as \`'${o.wouldBeType}'\`) has no block ` +
          `binding in the manifest. Sample: \`${o.sample}\`. **Proposed fix:** re-run \`npm run generate-manifests\` ` +
          `if the fixture changed after the manifest was last generated; if regenerating doesn't fix it, ` +
          `\`buildStageManifest\`/\`planSlotNames\` has a real bug dropping this key.`,
      )
    }
  }
  lines.push('')

  // ---------------- BUCKET 2: MISCLASSIFICATION ----------------
  lines.push('---')
  lines.push('')
  lines.push('## Bucket 2 — Misclassification')
  lines.push('')
  lines.push('Data that reaches a block, but the wrong kind of block, or a block that drops some of its own fields by design.')
  lines.push('')
  lines.push(`### A.2 — Geometry under-match: looks chart-shaped, but wasn't classified as one of the 5 chart types (${a2.underMatches.length})`)
  lines.push('')
  lines.push(
    "`extraction/classifyBlocks.js` now has 5 narrow, precise chart signatures (line/bar/scatter/waterfall/heatmap) " +
      'instead of one broad heuristic — this check is a backstop for a row that still looks geometric by a *broader* ' +
      'candidate vocabulary than any of those 5 signatures use, in case a real chart shape slips through all of them. ' +
      "(The old \"over-match\" half of this check — a chart-classified block whose data doesn't cleanly fit its own " +
      'shape — is retired: `extraction/generateManifests.js`\'s self-check already re-validates every block against ' +
      "its own blockType's real validator on every run, which catches that generically for every block type, not just charts.)",
  )
  lines.push('')
  if (a2.underMatches.length === 0) {
    lines.push('None found — every array-of-objects block that looks geometric is already one of the 5 chart types.')
  } else {
    for (const m of a2.underMatches) {
      lines.push(
        `- \`${m.code}/${m.stageKey}\` \`${m.slotName}\` (\`${m.binding}\`), currently \`'${m.blockType}'\`, ${m.rowCount} rows: ` +
          `meaningful keys \`[${m.keys.join(', ')}]\`, ${m.geoMatches.length}/${m.keys.length} (${fmtPct(m.ratio)}) match the broader ` +
          `geometry vocabulary (\`${[...GEOMETRY_CANDIDATE_KEYS].join(', ')}\` + short 1-2 letter numeric keys). Sample row: ` +
          `\`${m.sample}\`. **Why wrong:** this is very likely chart/plot data being rendered as a flat table or item list. ` +
          `**Proposed fix:** check whether it fits one of the 5 existing chart signatures with a small tweak, or is a genuinely ` +
          `new shape needing its own.`,
      )
    }
  }
  lines.push('')

  lines.push(`### A.3 — Classified correctly but incomplete: block's own renderer drops some of its bound data's keys (${a3.incomplete.length})`)
  lines.push('')
  lines.push(
    'The block type itself is a reasonable classification for this data\'s *shape*, but that block type\'s ' +
      "renderer has a fixed, narrow set of fields it looks for — anything else present on the same items is " +
      'silently dropped, never shown, and never logged as missing (this is the exact bug family that broke ' +
      "S9.1/analyze's `rows` — `role`, `vel`, `cm`, `turns`, `gmroi`, `cpw` all vanish, leaving only a bare product " +
      'name in a full-width card).',
  )
  lines.push('')
  if (a3.incomplete.length === 0) {
    lines.push('None found.')
  } else {
    const byType = { itemQueue: [], labelValueList: [], object: [], table: [] }
    for (const inc of a3.incomplete) byType[inc.blockType].push(inc)

    if (byType.itemQueue.length > 0) {
      lines.push(
        '**`itemQueue` blocks** — `ItemQueueBlock.jsx`\'s `Item()` only ever surfaces one headline key (from ' +
          '`HEADLINE_KEYS`), one detail key, one identifier key, one state key, one severity key, plus any *array*-valued ' +
          'field as a nested sub-list. Any other scalar- or object-valued key on the item — a second metric, a status badge ' +
          'object, a formatted figure — is dropped with no visual trace.',
      )
      lines.push('')
      for (const inc of byType.itemQueue) {
        lines.push(
          `- \`${inc.code}/${inc.stageKey}\` \`${inc.slotName}\` (\`${inc.binding}\`), ${inc.rowCount} rows: dropped keys ` +
            `\`[${inc.droppedKeys.join(', ')}]\`. Sample row: \`${inc.sample}\`. **Proposed fix:** extend \`ItemQueueBlock\`'s ` +
            'candidate lists to cover these keys, or add a generic "extra fields" row (like its existing nested-list handling) ' +
            'for scalar/object keys that survive after headline/detail/id/state/severity picks.',
        )
      }
      lines.push('')
    }
    if (byType.labelValueList.length > 0) {
      lines.push(
        '**`labelValueList` blocks** — `LabelValueListBlock.jsx` renders only `item.label` plus the first present of ' +
          '`value`/`note`/`detail`/`amount`/`pct`; any other key on the same item is dropped.',
      )
      lines.push('')
      for (const inc of byType.labelValueList) {
        lines.push(
          `- \`${inc.code}/${inc.stageKey}\` \`${inc.slotName}\` (\`${inc.binding}\`), ${inc.rowCount} rows: dropped keys ` +
            `\`[${inc.droppedKeys.join(', ')}]\`. Sample row: \`${inc.sample}\`. **Proposed fix:** extend the picked-value ` +
            'candidate list, or render additional known keys as a second column.',
        )
      }
      lines.push('')
    }
    if (byType.object.length > 0) {
      lines.push(
        '**`object` blocks** — `ObjectBlock.jsx` only renders entries whose value is a renderable primitive ' +
          '(string/number/boolean, non-style) or a JSX-descriptor node; a nested array or plain object on the same ' +
          'descriptor is dropped.',
      )
      lines.push('')
      for (const inc of byType.object) {
        lines.push(
          `- \`${inc.code}/${inc.stageKey}\` \`${inc.slotName}\` (\`${inc.binding}\`): dropped keys ` +
            `\`[${inc.droppedKeys.join(', ')}]\`. Sample: \`${inc.sample}\`. **Proposed fix:** recurse one level for ` +
            'nested plain-object values, or render array values as an inline chip list.',
        )
      }
      lines.push('')
    }
    lines.push(
      "**`table` blocks** — not checked here: `TableBlock.jsx` now unions column keys across every row (instead " +
        "of reading row 0 alone), so a later row carrying a key row 0 doesn't is no longer dropped table-wide. " +
        'No residual check needed for this block type.',
    )
    lines.push('')
  }

  lines.push(`### A.4 — Cross-story consistency (${a4.strictInconsistent.length} strict, ${a4.looseInconsistent.length} loose/informational)`)
  lines.push('')
  lines.push(
    'Groups blocks across all 26 workflows by a "shape signature." **Strict** = sorted meaningful key names + exact ' +
      'row count + per-key value type (as specified). **Loose** (extra, informational) = same keys/types, any row ' +
      'count — included because requiring an exact row-count match across unrelated workflows is a very strict bar ' +
      'and may hide real inconsistencies the strict check misses.',
  )
  lines.push('')
  lines.push('**Strict (exact row count):**')
  lines.push('')
  if (a4.strictInconsistent.length === 0) {
    lines.push('None found.')
  } else {
    for (const g of a4.strictInconsistent) {
      lines.push(`- Signature \`${g.sig}\` classified as ${[...g.types].map((t) => `\`'${t}'\``).join(' and ')} across:`)
      for (const o of g.occs) lines.push(`  - \`${o.code}/${o.stageKey}\` \`${o.slotName}\` → \`'${o.blockType}'\``)
    }
  }
  lines.push('')
  lines.push('**Loose (same keys/types, any row count — informational, not counted toward the strict total above unless noted):**')
  lines.push('')
  if (a4.looseInconsistent.length === 0) {
    lines.push('None found.')
  } else {
    for (const g of a4.looseInconsistent) {
      lines.push(`- Signature \`${g.sig}\` classified as ${[...g.types].map((t) => `\`'${t}'\``).join(' and ')} across:`)
      for (const o of g.occs) lines.push(`  - \`${o.code}/${o.stageKey}\` \`${o.slotName}\` (${o.blockType})`)
    }
  }
  lines.push('')

  // ---------------- BUCKET 3: LAYOUT ONLY ----------------
  lines.push('---')
  lines.push('')
  lines.push('## Bucket 3 — Layout only (data is correct; presentation is not)')
  lines.push('')
  lines.push(`### B.1 — Scalar-block density per stage (${b.densityFlags.length} stages flagged, >40% threshold)`)
  lines.push('')
  lines.push(
    '`StageRenderer.jsx` (`<div className="flex flex-col gap-3 p-6">`) stacks every block full-width in a single ' +
      'column regardless of type. A stage dominated by short scalar blocks (`text`/`number`/`flag`/small `object`, ' +
      '≤3 leaf values) is a strong candidate for grid grouping instead of vertical stacking.',
  )
  lines.push('')
  if (b.densityFlags.length === 0) {
    lines.push('None found.')
  } else {
    for (const f of b.densityFlags) {
      lines.push(
        `- \`${f.code}/${f.stageKey}\`: ${f.scalarLowCardCount}/${f.totalBlocks} blocks (${fmtPct(f.density)}) are low-cardinality ` +
          `scalar blocks. **Proposed fix:** group consecutive \`text\`/\`number\`/\`flag\`/small \`object\` blocks into a ` +
          '`grid grid-cols-2`/`grid-cols-3` row in `StageRenderer.jsx`, leaving `table`/`series`/`itemQueue` full width.',
      )
    }
  }
  lines.push('')
  lines.push(`### B.2 — Full-width waste on individual scalar blocks (${b.widthFlags.length} blocks flagged)`)
  lines.push('')
  lines.push(
    'Heuristic only (character-count estimate of each block\'s widest rendered row, not a pixel measurement) — ' +
      'meant to prioritize triage, not as an exact layout spec. "third" = comfortably fits at ~1/3 card width ' +
      '(≤20 estimated characters); "half" = comfortably fits at ~1/2 card width (≤40 estimated characters).',
  )
  lines.push('')
  if (b.widthFlags.length === 0) {
    lines.push('None found.')
  } else {
    const byTier = { third: [], half: [] }
    for (const f of b.widthFlags) byTier[f.tier].push(f)
    for (const tier of ['third', 'half']) {
      if (byTier[tier].length === 0) continue
      lines.push(`**Fits at ${tier} width (${byTier[tier].length}):**`)
      lines.push('')
      for (const f of byTier[tier]) {
        lines.push(`- \`${f.code}/${f.stageKey}\` \`${f.slotName}\` (${f.blockType}), ~${f.maxRowChars} chars wide`)
      }
      lines.push('')
    }
  }

  fs.writeFileSync(OUT_PATH, lines.join('\n') + '\n')
  return { totalBlocks, totalIssues, dataLossCount, misclassificationCount, layoutOnlyCount }
}

// ============================================================================================
// Main
// ============================================================================================

function main() {
  const index = loadIndex()
  const stages = [] // { code, stageKey, fixture, manifest }

  for (const workflow of index) {
    const manifestArr = loadManifest(workflow.code)
    for (const stageKey of workflow.stages) {
      const fixture = loadFixture(workflow.code, stageKey)
      const manifest = manifestArr?.find((m) => m.stageKey === stageKey) ?? null
      if (!manifest) {
        console.warn(`[audit] no manifest entry for ${workflow.code}/${stageKey} — skipping manifest-dependent checks for it`)
      }
      stages.push({ code: workflow.code, stageKey, fixture, manifest })
    }
  }

  const a1 = runAuditA1(stages)
  const a2 = runAuditA2(stages)
  const a3 = runAuditA3(stages)
  const a4 = runAuditA4(stages)
  const b = runAuditB(stages)

  const totals = writeReport(stages, { a1, a2, a3, a4, b })

  console.log('─'.repeat(60))
  console.log('Action Stories audit')
  console.log('─'.repeat(60))
  console.log(`workflows audited:   ${new Set(stages.map((s) => s.code)).size}`)
  console.log(`stages audited:      ${stages.length}`)
  console.log(`blocks audited:      ${totals.totalBlocks}`)
  console.log(`total issues:        ${totals.totalIssues}`)
  console.log(`  data loss:           ${totals.dataLossCount}`)
  console.log(`  misclassification:   ${totals.misclassificationCount}`)
  console.log(`  layout only:         ${totals.layoutOnlyCount}`)
  console.log('')
  console.log(`Full report: extraction/audit-report.md`)
  console.log('─'.repeat(60))
}

main()
