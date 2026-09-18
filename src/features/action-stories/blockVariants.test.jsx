// @vitest-environment jsdom
//
// Phase 5B, T83-T92: block variants, and the semantic-to-token mapping that makes them look like
// the reference. The last phase.
//
// TEN SHAPES BECAME FIVE VARIANTS, and that is the survey working rather than a shortfall. Four of
// 5A's ten were scoped for keys 5A itself withdrew — `sizes`, `detectBars`, `timeline`@S10.6,
// `ladder`, and `opportunity` — which are unclaimed, which C1 forbids re-claiming, and which would
// therefore have rendered nothing at all. A fifth, `barChart row note`, was dropped because its
// evidence did not survive a second look: all three of its sources render as STACKED METRICS in the
// reference, not as bars with notes (ruling R69).
//
// WHAT A VARIANT IS ALLOWED TO BE. It comes from the SLOT and nowhere else (I1). A block cannot
// choose one, because the function that resolves it takes a slot name and has no access to data,
// row counts or blockType — the same signature discipline `spanOf` got in 5C after `blockSizing.js`
// was deleted for inferring width from content. That defect has now been removed from the renderer
// (3B), the claim ledger (5A) and the layout layer (5C); it does not return as styling.
//
// WHAT jsdom CANNOT DO, again. It has no layout engine, so nothing here asserts a pixel. The
// variants' geometry, the absence of clipped text and the screenshots live in `npm run smoke`'s
// layout gate (T88, T92). 5D's lesson is the reason: both of that phase's visual regressions were
// found by LOOKING at a screenshot after its measurement gate was already green.

import { describe, it, expect, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

import StageRenderer from './components/StageRenderer'
import { resolveTemplate } from './templates/templateRegistry'
import { resolveBinding } from './manifests/resolveBinding'
import { evaluateCondition } from './manifests/actionCondition'
import { SLOT_VOCABULARY } from './templates/slotVocabulary'
import { BLOCK_TYPES } from './manifests/blockTypes'
import { BLOCK_REGISTRY } from './blocks'
import { packRow } from './layout/packRows'
import { BLOCK_VARIANTS, MAX_VARIANTS_PER_BLOCK, variantOf } from './blocks/variants'
import dataset from './__corpus__/normalized/dataset.json'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')
const BLOCKS_DIR = path.join(REPO_ROOT, 'src/features/action-stories/blocks')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
}

let container
let root
function renderPane(decision) {
  const resolved = resolveTemplate(decision)
  if (!resolved) return null
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => { root.render(<StageRenderer manifest={resolved.manifest} fixture={decision} />) })
  return container
}
function unmount() {
  if (root) act(() => root.unmount())
  container?.remove()
  root = undefined
  container = undefined
}
afterEach(unmount)

const byId = (id) => dataset.find((d) => d.proposal_id === id)

/**
 * THE FIVE VARIANTS, with the object that carries each one's distinguishing feature and the
 * reference markup that justifies it (I5). `shows` is text that MUST appear in the rendered pane —
 * chosen to be impossible without the variant, never merely likely.
 */
const VARIANTS = [
  {
    name: 'metricGrid', block: 'statList', slot: 'recommendation_metrics',
    reference: 'S9.1-3-decide.dc.html:220-227 — label / value / range / note as four stacked lines',
    cases: [
      { id: 'prop_s9_1_decide', shows: ['+$17K to +$66K', 'P10–P90 on the full slate'] },
    ],
  },
  {
    name: 'meteredRow', block: 'gauge', slot: 'coverage',
    reference: 'S9.18-3-decide.dc.html:311-323 — label+value, a bar filled from pct with a tick at limitPct, note beneath',
    cases: [
      { id: 'prop_s9_18_decide', shows: ['floor 95%', 'scale 90–98%'] },
      { id: 'prop_s9_19_decide', shows: ['ceiling $240K'] },
    ],
  },
  {
    name: 'zoneRow', block: 'heatmapGrid', slot: 'matrix',
    reference: 'S9.18-2-analyze.dc.html:305-317 — grid 52px/1fr/62px: label+volume, split bar, optimal',
    cases: [
      { id: 'prop_s9_18_analyze', shows: ['3,300 orders', '99%'] },
      { id: 'prop_s9_13_analyze', shows: ['$310 median'] },
    ],
  },
  {
    name: 'groupCard', block: 'cardSet', slot: 'item_groups',
    reference: 'S9.18-3-decide:235-239 (nested rules), S10.4-3-decide:305-307 (foot), S9.7-3-decide:267-277 (inline histogram)',
    cases: [
      { id: 'prop_s9_18_decide', shows: ['Carrier allocation mix'] },
      { id: 'prop_s10_4_decide', shows: ['Staging is not delay'] },
      { id: 'prop_s9_7_decide', shows: ['−45%'] },
    ],
  },
  {
    name: 'routeCard', block: 'cardSet', slot: 'next_actions',
    reference: 'S10.3-3-decide:393-397 (attachments as pill chips), :321-325 (gate chip)',
    cases: [
      { id: 'prop_s10_3_decide', shows: ['Kessler authorisation', 'counsel files'] },
    ],
  },
  {
    name: 'scenarioCard', block: 'cardSet', slot: 'alternatives',
    reference: 'S9.14-3-decide.dc.html:227-230 — headline is n (15px), tag an 8px uppercase sub-label',
    cases: [
      // `tag` ALREADY renders, as a chip — CardSetBlock's CHIP_KEYS includes it — so asserting it
      // proves nothing. What the variant changes is the HEADLINE: today these three cards read
      // "Option 1/2/3" because none of name/title/label is present. The reference leads with the
      // number and labels it with the tag.
      { id: 'prop_s9_14_decide', shows: ['tight', 'planned', 'stretch'], hides: ['Option 1', 'Option 2', 'Option 3'] },
    ],
  },
]

// ---- T83 -----------------------------------------------------------------------------------------

describe('T83 — every variant renders its distinguishing feature on the objects that carry it', () => {
  const cases = VARIANTS.flatMap((v) => v.cases.map((c) => [`${v.name} · ${c.id}`, v, c]))

  it.each(cases)('%s', (label, variant, testCase) => {
    const d = byId(testCase.id)
    expect(d, `${testCase.id} is not in the corpus`).toBeTruthy()
    const c = renderPane(d)
    expect(c, `${testCase.id} renders no pane`).toBeTruthy()
    const text = (c.textContent ?? '').replace(/\s+/g, ' ')
    for (const needle of testCase.shows) {
      expect(text, `${label}: "${needle}" is not on the page — ${variant.reference}`).toContain(needle)
    }
    for (const absent of testCase.hides ?? []) {
      expect(text, `${label}: "${absent}" is still rendered — ${variant.reference}`).not.toContain(absent)
    }
    unmount()
  })

  it('every variant cites reference markup (I5)', () => {
    for (const v of VARIANTS) {
      expect(v.reference, `${v.name} cites no reference`).toMatch(/\.dc\.html|-decide|-analyze/)
      expect(v.reference.length, `${v.name}'s citation is too thin to check`).toBeGreaterThan(40)
      expect(v.cases.length, `${v.name} has no object to prove it on`).toBeGreaterThan(0)
    }
  })
})

// ---- T84 -----------------------------------------------------------------------------------------

describe('T84 — no block chooses its own variant (I1)', () => {
  it('variantOf takes a slot name and nothing else', () => {
    // The signature IS the guarantee, exactly as it is for spanOf. A function with no parameter for
    // the data cannot branch on the data — which is what `blockSizing.js` did for width until 5C
    // deleted it, and what the renderer did for block type until 3B.
    expect(variantOf.length, 'variantOf takes more than a slot name').toBe(1)
  })

  it('no block component derives a variant from data, row count or blockType', () => {
    const offenders = []
    const SNIFF = [
      /variant\s*=\s*[^;\n]*\.length/, // chosen by row count
      /variant\s*=\s*[^;\n]*data\./, // chosen by the data
      /variant\s*=\s*[^;\n]*blockType/, // chosen by the block's own type
      /\bvariantOf\s*\(/, // a block resolving its own variant instead of being told
    ]
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) { walk(full); continue }
        if (!/\.jsx?$/.test(e.name) || e.name.includes('.test.') || e.name === 'variants.js') continue
        const code = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
        for (const re of SNIFF) if (re.test(code)) offenders.push(`${path.relative(REPO_ROOT, full)}: ${re}`)
      }
    }
    walk(BLOCKS_DIR)
    expect(offenders, 'a block is choosing its own variant').toEqual([])
  })

  it('a variant reaches a block only as a prop, resolved from the slot', () => {
    const renderer = fs.readFileSync(path.join(REPO_ROOT, 'src/features/action-stories/components/StageRenderer.jsx'), 'utf8')
    expect(renderer, 'the renderer does not resolve a variant from the slot').toMatch(/variantOf\s*\(/)
    expect(renderer, 'the variant is not passed to the block').toMatch(/variant=\{/)
  })

  it('an unknown variant is rejected, never silently ignored', async () => {
    const { assertVariant } = await import('./blocks/variants.js')
    expect(() => assertVariant('cardSet', 'notARealVariant')).toThrow(/variant/i)
    expect(() => assertVariant('statList', 'groupCard')).toThrow(/variant/i) // right name, wrong block
    expect(() => assertVariant('cardSet', 'groupCard')).not.toThrow()
    expect(() => assertVariant('cardSet', undefined)).not.toThrow() // no variant is always legal
  })
})

// ---- T85 -----------------------------------------------------------------------------------------

describe('T85 — variants are capped and declared (I2)', () => {
  it('declares five variants across four blocks, with cardSet at the cap of 3', () => {
    const all = Object.values(BLOCK_VARIANTS).flat()
    expect(all.sort()).toEqual(['groupCard', 'meteredRow', 'metricGrid', 'routeCard', 'scenarioCard', 'zoneRow'].sort())
    expect(Object.keys(BLOCK_VARIANTS).sort()).toEqual(['cardSet', 'gauge', 'heatmapGrid', 'statList'])
    expect(BLOCK_VARIANTS.cardSet).toHaveLength(MAX_VARIANTS_PER_BLOCK)
  })

  it('no block exceeds the cap', () => {
    const over = Object.entries(BLOCK_VARIANTS)
      .filter(([, list]) => list.length > MAX_VARIANTS_PER_BLOCK)
      .map(([block, list]) => `${block}: ${list.length}`)
    expect(over, 'a fourth variant is a new block wearing a variant\'s name — it needs a ruling').toEqual([])
  })

  it('the declared list matches exactly what the slots use', () => {
    const used = {}
    for (const spec of Object.values(SLOT_VOCABULARY)) {
      if (spec.variant === undefined) continue
      ;(used[spec.blockType] ??= new Set()).add(spec.variant)
    }
    for (const [block, list] of Object.entries(BLOCK_VARIANTS)) {
      expect([...(used[block] ?? [])].sort(), `${block}: declared list does not match slot usage`).toEqual([...list].sort())
    }
    // …and no slot declares a variant for a block that declares none.
    expect(Object.keys(used).sort()).toEqual(Object.keys(BLOCK_VARIANTS).sort())
  })

  it('every variant in the table above is declared, and every declared variant is in the table', () => {
    expect(VARIANTS.map((v) => v.name).sort()).toEqual(Object.values(BLOCK_VARIANTS).flat().sort())
    for (const v of VARIANTS) {
      expect(SLOT_VOCABULARY[v.slot]?.variant, `${v.slot} does not declare ${v.name}`).toBe(v.name)
      expect(SLOT_VOCABULARY[v.slot]?.blockType, `${v.slot} is not a ${v.block}`).toBe(v.block)
    }
  })
})

// ---- T86 -----------------------------------------------------------------------------------------

describe('T86 — statusTone is the only semantic-to-token module (I3)', () => {
  // R70: the exemption list shrinks from three to two. R25 exempted SliderBlock as "an UNUSED
  // blockType; no canonical slot targets it" — 5A's R50 wired `threshold_control` to it, so it
  // renders on S9.12/decide and that justification is now false. An exemption whose stated reason
  // has expired reads as reviewed when it is stale, which is worse than no exemption.
  const EXEMPT = ['BlockStates.jsx', 'BlockErrorBoundary.jsx']
  const PALETTE = /\b(?:bg|text|border|ring|accent|from|to|via|fill|stroke|decoration|outline)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/
  const HEX = /#[0-9a-fA-F]{6}\b/

  it('the exemption list is exactly two files', () => {
    expect(EXEMPT).toHaveLength(2)
    expect(EXEMPT).toEqual(['BlockStates.jsx', 'BlockErrorBoundary.jsx'])
  })

  it('no block or child component outside that list contains a palette literal', () => {
    const offenders = []
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) { walk(full); continue }
        if (!e.name.endsWith('.jsx') || e.name.includes('.test.') || EXEMPT.includes(e.name)) continue
        const code = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
        if (PALETTE.test(code)) offenders.push(`${e.name}: ${PALETTE.exec(code)[0]}`)
        if (HEX.test(code)) offenders.push(`${e.name}: ${HEX.exec(code)[0]}`)
      }
    }
    walk(BLOCKS_DIR)
    expect(offenders, 'a palette literal is in a block component').toEqual([])
  })

  it('only statusTone.js maps a semantic word to a status token', () => {
    const offenders = []
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) { walk(full); continue }
        if (!/\.jsx?$/.test(e.name) || e.name.includes('.test.') || e.name === 'statusTone.js') continue
        const code = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
        // A literal status token inside a conditional is a tone decision living outside the module.
        if (/[?:][^\n]*rf-status-/.test(code)) offenders.push(path.relative(REPO_ROOT, full))
      }
    }
    walk(BLOCKS_DIR)
    expect(offenders, 'a block decides a status colour outside statusTone').toEqual([])
  })

  it('R73 — the over-limit tone moved into statusTone and GaugeBlock no longer decides it', async () => {
    const { limitTone } = await import('./blocks/statusTone.js')
    expect(typeof limitTone, 'limitTone is not exported').toBe('function')
    // NO DIRECTIONAL COLOUR, and the screenshot is why. S9.18/decide renders "On-time · DTC 95.6%"
    // past its tick, which its note calls a FLOOR — so being past it is good, and the first version
    // of this variant painted it critical red. That object carries two floors and two ceilings, and
    // the direction exists only in the prose. A red bar that is wrong half the time is worse than a
    // neutral one on a surface people approve from (R72's principle, found by looking).
    expect(limitTone().text, 'the gauge must not colour a verdict it cannot derive').not.toMatch(/rf-status-/)
    expect(limitTone.length, 'limitTone takes an argument it cannot honestly use').toBe(0)
    const gauge = fs.readFileSync(path.join(BLOCKS_DIR, 'GaugeBlock.jsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(gauge, 'GaugeBlock still picks a status token itself').not.toMatch(/rf-status-/)
  })
})

// ---- T87 -----------------------------------------------------------------------------------------

describe('T87 — no colour, tone, icon name or CSS value crosses from data (I4)', () => {
  const KEYS = new Set()
  ;(function walk(v) {
    if (Array.isArray(v)) return v.forEach(walk)
    if (v !== null && typeof v === 'object') for (const [k, s] of Object.entries(v)) { KEYS.add(k); walk(s) }
  })(dataset)

  it('no presentation key anywhere in the shipped corpus (Phase 2 T10)', () => {
    const FORBIDDEN = /^(colou?r|tone|tint|hue|icon|glyph|show|hidden|visible|className|css|style|bg|fg|fill|stroke|shadow|opacity|border|radius|dot|glow)$/i
    expect([...KEYS].filter((k) => FORBIDDEN.test(k))).toEqual([])
  })

  it('no CSS value, hex colour or icon class anywhere (Phase 2 T10, 3A T21)', () => {
    const offenders = []
    ;(function walk(v, at) {
      if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${at}[${i}]`))
      if (v !== null && typeof v === 'object') return Object.entries(v).forEach(([k, s]) => walk(s, `${at}.${k}`))
      if (typeof v !== 'string') return
      if (/var\(--|color-mix\(|^#[0-9a-f]{3,8}$|\bfa-[a-z-]{3,}\b/i.test(v)) offenders.push(at)
    })(dataset, '')
    expect(offenders).toEqual([])
  })

  it('no geometry key re-entered through a variant (Phase 3A T20)', () => {
    const GEOMETRY = ['floorPct', 'nowPct', 'targetPct', 'markPct', 'lowPct', 'widthPct', 'ourPct',
      'bandWidth', 'barWidth', 'pctFrom', 'pctTo', 'fromPct', 'toPct', 'targetY', 'targetX', 'width']
    expect(GEOMETRY.filter((k) => KEYS.has(k))).toEqual([])
  })

  it('every variant that shows colour derives it, and the six declined cases stay uncoloured', () => {
    // R72. The reference colours these four and the payload carries no semantic field behind any of
    // them; inferring polarity from wording like "over appetite" would be a classifier on prose,
    // in a component, deciding what is good news. They render without colour, deliberately.
    const DECLINED = ['item_groups[].tag', 'alternatives[].flag', 'alternatives[].badge', 'matrix[].optimal', 'next_actions[].kind']
    expect(DECLINED.length, 'the declined list was quietly emptied').toBeGreaterThanOrEqual(5)
    // The structural half: no block maps any of those field names to a token.
    const offenders = []
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) { walk(full); continue }
        if (!/\.jsx?$/.test(e.name) || e.name.includes('.test.')) continue
        const code = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
        if (/\b(tag|flag|badge|kind|optimal)\b[^\n]{0,40}(rf-status-|Tone\()/.test(code)) {
          offenders.push(path.relative(REPO_ROOT, full))
        }
      }
    }
    walk(BLOCKS_DIR)
    expect(offenders, 'a block colours a field the payload carries no status for').toEqual([])
  })
})

// ---- T89 -----------------------------------------------------------------------------------------

describe('T89 — 5C and 5D hold (I7)', () => {
  it('the declared spans are unchanged', () => {
    const halves = Object.entries(SLOT_VOCABULARY).filter(([, s]) => s.span === 'half').map(([n]) => n).sort()
    expect(halves).toEqual(['constraints', 'entities', 'plan', 'policy', 'roles', 'secondary_rows'])
  })

  it('the packer is still pure and still never reorders', () => {
    const input = ['policy', 'constraints', 'roles', 'narrative']
    const first = packRow(input)
    for (let i = 0; i < 10; i += 1) expect(packRow(input)).toEqual(first)
    expect(packRow(input).flatMap((r) => r.slots)).toEqual(input)
  })

  it('the block set per object is identical — a variant changes presentation, never content', () => {
    const differences = []
    for (const d of dataset) {
      const c = renderPane(d)
      if (!c) continue
      const rendered = [...c.querySelectorAll('[data-block-slot]')].map((n) => n.getAttribute('data-block-slot'))
      const resolved = resolveTemplate(d)
      const expected = resolved.manifest.blocks
        .filter((b) => b.when === undefined || evaluateCondition(b.when, d))
        .filter((b) => resolveBinding(b.binding, d) !== undefined)
        .map((b) => b.slotName)
      if (rendered.length !== expected.length || expected.some((s) => !rendered.includes(s))) {
        differences.push(`${d.proposal_id}: ${rendered.length} rendered vs ${expected.length} expected`)
      }
      unmount()
    }
    expect(differences, 'a variant changed which blocks render').toEqual([])
  })

  it('the column-role text contract is untouched (5D)', async () => {
    const { CELL_ROLES } = await import('./blocks/cellText.js')
    expect(Object.keys(CELL_ROLES).sort()).toEqual(['figure', 'identifier', 'prose'])
  })
})

// ---- T90 -----------------------------------------------------------------------------------------

describe('T90 — no data changed, no new slot, no new blockType (I6/C1)', () => {
  const changed = (paths) => execSync(`git diff --name-only HEAD -- ${paths}`, { encoding: 'utf8' }).trim()

  it('the normalized corpus is byte-identical', () => {
    const diff = changed('src/features/action-stories/__corpus__/normalized/')
    expect(diff, `corpus changed: ${diff}`).toBe('')
  })

  it('the generator and the contract validator are untouched', () => {
    const diff = changed('extraction/normalizeCorpus.js src/features/action-stories/contract/decisionObject.js')
    expect(diff, `frozen files changed: ${diff}`).toBe('')
  })

  it('the slot vocabulary gained no slot and the registry gained no block', () => {
    expect(Object.keys(SLOT_VOCABULARY)).toHaveLength(49)
    expect(BLOCK_TYPES).toHaveLength(19)
    expect(Object.keys(BLOCK_REGISTRY).sort()).toEqual(BLOCK_TYPES.slice().sort())
  })

  it('the shape ledger\'s RULES are unchanged — only entries that became rendered may move (R68)', () => {
    const ledger = fs.readFileSync(path.join(REPO_ROOT, 'src/features/action-stories/__corpus__/shapeLedger.js'), 'utf8')
    // The three ignore categories and the gate's contract stay exactly as 5A wrote them.
    expect(ledger).toContain("'extraction residue', 'derived geometry', 'rendered elsewhere'")
    expect(ledger).toMatch(/MISROUTED\s+anything else/)
  })
})

// ---- T91 / T92 ------------------------------------------------------------------------------------

describe('T91/T92 — the browser gate carries the visual half', () => {
  const smoke = () => fs.readFileSync(path.join(REPO_ROOT, 'scripts/smoke.mjs'), 'utf8')

  it('T91 — the live path and layout gate run in the smoke script', () => {
    for (const marker of ['T73', 'T75', 'T76', 'T78']) {
      expect(smoke(), `${marker} left the smoke run`).toContain(marker)
    }
  })

  it('T92 — a screenshot is captured per variant at both widths, and a missing one fails the run', () => {
    const src = smoke()
    expect(src, 'the screenshot pass is not in the smoke run').toContain('T92')
    expect(src, 'screenshots are not captured per variant').toMatch(/captureScreenshot/)
    // R65's rule, applied to the artefact: a missing screenshot must FAIL, never warn.
    expect(src, 'a missing screenshot does not fail the run').toMatch(/T92[\s\S]{0,4000}?fail\(/)
    for (const v of VARIANTS) {
      expect(src, `${v.name} has no screenshot case`).toContain(v.name)
    }
  })
})
