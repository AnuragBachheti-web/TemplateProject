// GAP #2 — the normalized dataset is the canonical business data.
//
// These tests are the contract between the archived corpus and whatever eventually serves this data
// over HTTP. They assert what a real API must satisfy, so the same suite keeps its meaning when the
// transport changes from an in-memory double to a cloud endpoint.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dataset from './normalized/dataset.json'
import { validateDecisionObject, VALUE_UNITS } from '../contract/decisionObject'
import { selectTemplate } from '../templates/selectTemplate'
import { resolveTemplate } from '../templates/templateRegistry'
import { SLOT_VOCABULARY } from '../templates/slotVocabulary'
import { resolveBinding } from '../manifests/resolveBinding'
import { evaluateCondition } from '../manifests/actionCondition'
import { validateBlockData } from '../manifests/blockTypes'
import { groupProposalsIntoStories } from '../actionStory'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../../..')
const RAW_DIR = path.join(__dirname, 'fixtures/raw')

// ---- 1-3: discovery, stories, stage grouping -----------------------------------------------------

describe('1-3. the normalized dataset preserves the corpus and its Gap #1 grouping', () => {
  it('1. discovers all 105 corpus stage records', () => {
    const onDisk = fs
      .readdirSync(RAW_DIR)
      .filter((d) => fs.statSync(path.join(RAW_DIR, d)).isDirectory())
      .flatMap((d) => fs.readdirSync(path.join(RAW_DIR, d)).filter((f) => f.endsWith('.json')))
    expect(onDisk).toHaveLength(105)
    expect(dataset).toHaveLength(105)
  })

  it('2. preserves exactly the 26 Action Stories, with the same story_code values', () => {
    const fromDisk = new Set(fs.readdirSync(RAW_DIR).filter((d) => fs.statSync(path.join(RAW_DIR, d)).isDirectory()))
    const fromDataset = new Set(dataset.map((d) => d.story_code))
    expect(fromDataset.size).toBe(26)
    expect([...fromDataset].sort()).toEqual([...fromDisk].sort())
  })

  it('3. preserves stage grouping — every story keeps exactly the stages it had on disk', () => {
    for (const story of groupProposalsIntoStories(dataset)) {
      const onDisk = fs
        .readdirSync(path.join(RAW_DIR, story.story_code))
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''))
        .sort()
      expect([...story.stageKeys].sort(), story.story_code).toEqual(onDisk)
    }
  })

  it('3b. gives every stage its OWN proposal_id — stages are not merged into one proposal', () => {
    const ids = dataset.map((d) => d.proposal_id)
    expect(new Set(ids).size).toBe(ids.length)
    // …and the parent relationship is carried by story_code, not by a shared id.
    const s101 = dataset.filter((d) => d.story_code === 'S10.1')
    expect(s101).toHaveLength(4)
    expect(new Set(s101.map((d) => d.proposal_id)).size).toBe(4)
  })
})

// ---- 4: contract conformance ---------------------------------------------------------------------

describe('4. every normalized Decision Object conforms to the contract', () => {
  it('validates all 105 with zero problems', () => {
    const invalid = dataset
      .map((d) => ({ id: d.proposal_id, problems: validateDecisionObject(d) }))
      .filter((r) => r.problems.length > 0)
    expect(invalid).toEqual([])
  })

  it('carries all seven axes on every record', () => {
    const AXES = ['cardinality', 'contract_class', 'on_clock', 'mode', 'entitlement', 'lens', 'persona']
    for (const d of dataset) {
      for (const axis of AXES) {
        expect(d[axis], `${d.proposal_id} missing ${axis}`).toBeDefined()
      }
    }
  })

  it('carries explicit, fail-closed eligibility for all six operator actions', () => {
    for (const d of dataset) {
      for (const action of ['approve', 'approve_selected', 'modify', 'send_back', 'dismiss', 'snooze']) {
        expect(typeof d.eligibility?.[action]?.allowed, `${d.proposal_id}.${action}`).toBe('boolean')
      }
    }
  })
})

// ---- 5: no presentation leaks --------------------------------------------------------------------

describe('5. no presentation data leaks into the normalized output', () => {
  const serialised = JSON.stringify(dataset)

  it('contains no CSS variables or colour functions', () => {
    expect(serialised).not.toMatch(/var\(--/)
    expect(serialised).not.toMatch(/color-mix\(/)
  })

  it('contains no SVG path data', () => {
    expect(serialised).not.toMatch(/"M\s*-?[\d.]+[\s,]-?[\d.]+\s+L/)
  })

  it('contains no mockup geometry keys, at any nesting depth', () => {
    // Split on camelCase WORD boundaries, exactly as blocks/decorativeKeys.js does. A suffix regex
    // is wrong here: `/(tx|ty|px)$/i` matches the tail of "cardinality" and "eligibility", which are
    // business fields. Only a whole camel word counts.
    const GEOMETRY = new Set(['left', 'right', 'width', 'top', 'bottom', 'px', 'py', 'cx', 'cy', 'tx', 'ty', 'lx', 'ly', 'nx'])
    const offenders = new Set()
    walk(dataset, (key) => {
      if (camelWords(key).some((word) => GEOMETRY.has(word))) offenders.add(key)
    })
    expect([...offenders]).toEqual([])
  })

  it('contains no decorative/tone keys, at any nesting depth', () => {
    // `anchor` is deliberately NOT here. On a variance-bridge row it is the business fact that this
    // row is an absolute LEVEL (the opening baseline, the closing actual) rather than a step — the
    // one thing a bridge cannot be drawn without once the mockup's `top`/`height` pixels are
    // correctly stripped. It is consumed by WaterfallChartBlock's own `bridgeGeometry`.
    const DECORATIVE = new Set(['bg', 'fg', 'tone', 'tint', 'border', 'hue', 'edge', 'srcTint', 'icon', 'glow', 'shadow', 'fill', 'stroke', 'dash'])
    const offenders = new Set()
    walk(dataset, (key) => {
      if (DECORATIVE.has(key)) offenders.add(key)
    })
    expect([...offenders]).toEqual([])
  })

  it('contains no React props/state envelope, extraction companions or UI visibility flags', () => {
    // `props` and `state` are the MOCKUP ENVELOPE's own keys, and they are banned where the envelope
    // put them: at a Decision Object's top level. They are not banned at every depth, because a ROW's
    // own `state` is real business status — "approved 09:38", "ready today", "needs booking",
    // "below" — and banning the word outright deleted 48 such values along with the envelope.
    const ENVELOPE = new Set(['props', 'state'])
    const topLevelOffenders = new Set()
    for (const decision of dataset) {
      for (const key of Object.keys(decision)) if (ENVELOPE.has(key)) topLevelOffenders.add(key)
    }
    expect([...topLevelOffenders]).toEqual([])

    const BANNED = new Set(['__raw', 'approveShow', 'blockShow', 'execSegs', 'execLabel', 'footerPushShow', 'footerDoneShow'])
    const offenders = new Set()
    walk(dataset, (key) => {
      if (BANNED.has(key) || key.startsWith('__')) offenders.add(key)
    })
    expect([...offenders]).toEqual([])
  })

  it('contains no component names, block types or layout instructions', () => {
    const BANNED = new Set(['blockType', 'template_id', 'component', 'slotName', 'region', 'span', 'layout', 'section'])
    const offenders = new Set()
    walk(dataset, (key) => {
      if (BANNED.has(key)) offenders.add(key)
    })
    expect([...offenders]).toEqual([])
  })

  it('carries no derived UI booleans standing in for eligibility', () => {
    const offenders = new Set()
    walk(dataset, (key) => {
      if (key === 'blocked' || key === 'canApprove') offenders.add(key)
    })
    expect([...offenders]).toEqual([])
  })
})

/** camelCase word split — "bandLeft" -> ["band","left"], the same rule decorativeKeys.js applies. */
function camelWords(key) {
  return (String(key).match(/[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])/g) ?? []).map((w) => w.toLowerCase())
}

/** Visits every key at every depth. */
function walk(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit)
    return
  }
  if (value === null || typeof value !== 'object') return
  for (const [k, v] of Object.entries(value)) {
    visit(k)
    walk(v, visit)
  }
}

// ---- 6: typed numbers -----------------------------------------------------------------------------

describe('6. numeric values are typed correctly', () => {
  it('types impact as {value, unit} on every record that has one', () => {
    for (const d of dataset) {
      // `null` is a legal typed value since Phase 2 (required-and-nullable, ruling R1): the field
      // is always present, and null states that the reference gives no figure.
      if (d.impact === undefined || d.impact === null) continue
      expect(typeof d.impact.value, d.proposal_id).toBe('number')
      expect(VALUE_UNITS, d.proposal_id).toContain(d.impact.unit)
    }
  })

  it('types execution progress as a percent, never a formatted string', () => {
    for (const d of dataset) {
      if (!d.execution?.progress_pct) continue
      expect(typeof d.execution.progress_pct.value, d.proposal_id).toBe('number')
      expect(d.execution.progress_pct.unit).toBe('pct')
    }
  })

  it('keeps confidence a real 0..1 number with an explicit calibrated flag', () => {
    for (const d of dataset) {
      if (d.confidence === undefined) continue
      expect(d.confidence.value).toBeGreaterThanOrEqual(0)
      expect(d.confidence.value).toBeLessThanOrEqual(1)
      expect(typeof d.confidence.calibrated).toBe('boolean')
    }
  })

  it('never carries a typed-number-shaped object with a formatted string inside it', () => {
    walk(dataset, () => {})
    const bad = []
    const check = (v) => {
      if (Array.isArray(v)) return v.forEach(check)
      if (v === null || typeof v !== 'object') return
      if ('unit' in v && 'value' in v && typeof v.value === 'string') bad.push(JSON.stringify(v).slice(0, 60))
      Object.values(v).forEach(check)
    }
    check(dataset)
    expect(bad).toEqual([])
  })
})

// ---- 7-8: templates receive the expected data ------------------------------------------------------

describe('7-8. all five canonical templates receive the expected canonical data', () => {
  const covered = dataset.filter((d) => selectTemplate(d) !== null)

  it('7. every stage template family is populated from the normalized dataset', () => {
    const used = {}
    for (const d of covered) used[selectTemplate(d)] = (used[selectTemplate(d)] ?? 0) + 1
    // `locked.v1` is absent by EVIDENCE: all 105 reference screens show their whole slate, figures
    // and item count, so every record carries `entitlement: "full"`. The template stays registered
    // and tested — it is a real contract capability with no corpus instance — where previously
    // `ENTITLEMENTS[hash % 5]` manufactured 20 locked records that no reference screen depicts.
    expect(Object.keys(used).sort()).toEqual([
      'analyze.compare.v1',
      'decide.slate.v1',
      'execute.bridge.v1',
      'reason.v1',
    ])
    for (const [id, n] of Object.entries(used)) expect(n, `${id} has no data`).toBeGreaterThan(0)
  })

  it('7b. every CORE slot resolves, with block-valid data, for every covered record', () => {
    const failures = []
    for (const d of covered) {
      const { manifest } = resolveTemplate(d)
      for (const block of manifest.blocks) {
        if (SLOT_VOCABULARY[block.slotName].tier !== 'core') continue
        if (block.when !== undefined && !evaluateCondition(block.when, d)) continue
        const value = resolveBinding(block.binding, d)
        if (value === undefined) {
          failures.push(`${d.proposal_id}: core slot "${block.slotName}" empty`)
          continue
        }
        const problems = validateBlockData(block.blockType, value)
        if (problems.length) failures.push(`${d.proposal_id}: "${block.slotName}" ${problems[0]}`)
      }
    }
    expect(failures).toEqual([])
  })

  it('8. no slot resolves to a value its declared blockType would reject (no placeholders)', () => {
    const failures = []
    for (const d of covered) {
      const { manifest } = resolveTemplate(d)
      for (const block of manifest.blocks) {
        if (block.when !== undefined && !evaluateCondition(block.when, d)) continue
        const value = resolveBinding(block.binding, d)
        if (value === undefined) continue // conditional-but-ungated absence is covered above
        const problems = validateBlockData(block.blockType, value)
        if (problems.length) failures.push(`${d.proposal_id}: "${block.slotName}" ${problems[0]}`)
      }
    }
    expect(failures).toEqual([])
  })

  it('8b. every record selects a canonical template — no uncovered stage remains', () => {
    const uncovered = dataset.filter((d) => selectTemplate(d) === null)
    expect(uncovered.map((d) => `${d.story_code}/${d.stage}`)).toEqual([])
  })
})

// ---- 9: no runtime dependence on the old dataset ----------------------------------------------------

describe('9. no runtime code imports the old fixture dataset', () => {
  const sourceFiles = []
  ;(function collect(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue
        collect(full)
      } else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
        sourceFiles.push(full)
      }
    }
  })(path.join(REPO_ROOT, 'src'))

  it('the superseded src/services/mockData dataset no longer exists', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'src/services/mockData'))).toBe(false)
  })

  it('no runtime module imports a raw story fixture or an archived manifest', () => {
    const offenders = sourceFiles.filter((f) => {
      const src = fs.readFileSync(f, 'utf8')
      return /__corpus__\/(fixtures|manifests)\//.test(src)
    })
    expect(offenders.map((f) => path.relative(REPO_ROOT, f))).toEqual([])
  })

  it('no runtime module globs story data', () => {
    const offenders = sourceFiles.filter((f) => fs.readFileSync(f, 'utf8').includes('import.meta.glob('))
    expect(offenders.map((f) => path.relative(REPO_ROOT, f))).toEqual([])
  })

  it('the ONLY runtime importer of business data is the API test double', () => {
    const importers = sourceFiles
      .filter((f) => fs.readFileSync(f, 'utf8').includes('normalized/dataset.json'))
      .map((f) => path.relative(REPO_ROOT, f))
    expect(importers).toEqual(['src/services/mockDecisionApi.js'])
  })

  // The test double imports the dataset, so ANY application module importing the double drags the
  // whole corpus behind it. StagePage did exactly that for `slateItemId`, which is why that function
  // now lives in contract/slateItem.js. Only the transport switch may reach the double: it is the
  // one module whose job is choosing between it and HTTP.
  it('the API test double is imported ONLY by the transport switch', () => {
    const importsTheDouble = /(?:from|import\()\s*['"][^'"]*mockDecisionApi['"]/
    const importers = sourceFiles
      .filter((f) => importsTheDouble.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(REPO_ROOT, f))
    expect(importers).toEqual(['src/services/decisionApi.js'])
  })
})

// ---- dataset artifacts -------------------------------------------------------------------------------

describe('the normalized directory is a complete, reviewable artifact', () => {
  it('writes one file per Decision Object', () => {
    const files = fs.readdirSync(path.join(__dirname, 'normalized/proposals')).filter((f) => f.endsWith('.json'))
    expect(files).toHaveLength(105)
  })

  it('writes one representative example per template family', () => {
    const files = fs.readdirSync(path.join(__dirname, 'normalized/examples')).sort()
    expect(files).toEqual([
      'analyze.compare.v1.json',
      'decide.slate.v1.json',
      'execute.bridge.v1.json',
      'reason.v1.json',
    ])
  })

  it('keeps the bundle and the per-proposal files in sync', () => {
    for (const d of dataset.slice(0, 10)) {
      const file = path.join(__dirname, 'normalized/proposals', `${d.proposal_id}.json`)
      expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(d)
    }
  })
})
