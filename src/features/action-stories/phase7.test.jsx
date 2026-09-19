// @vitest-environment jsdom
//
// PHASE 7 — T111, T112, T113, T114, T117. The browser halves (T115/T116/T118) are in
// scripts/smoke.mjs: jsdom has no layout engine, so it cannot tell you a table overflows its host,
// and no renderer, so it cannot measure a contrast ratio or see a tofu box.
//
// WHAT THIS PHASE IS. Phase 6 established the palette, Inter, the type roles and blue as the
// interactive colour, and all of that is correct. What it did not build is a SURFACE system, so the
// app reads as a white page with blue buttons rather than a designed product. Measured before
// starting: ground #FAFBFD against card #FFFFFF is a 3.59% luminance step, which means a card is
// legible only because of its 1px border.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { SURFACE_TIERS, TIER_NAMES, surfaceTier, MIN_TIER_STEP } from './blocks/surfaceTier'
import { LABEL_LEVELS, labelLevel } from './blocks/labelLevel'
import StageRenderer from './components/StageRenderer'
import { resolveTemplate } from './templates/templateRegistry'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'
import before from '@/features/action-stories/__corpus__/__snapshots__/phase7-before-render.json'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '../../..')
const TOKENS = fs.readFileSync(path.join(REPO_ROOT, 'src/styles/tokens.css'), 'utf8')

/** Phase 6's exemption list, unchanged. Invariant I1 says it may not grow, so it is asserted. */
const OWNS_A_SCALE = ['blocks/typeRole.js', 'blocks/glyphSize.js', 'blocks/surfaceTier.js']

function sourceFiles() {
  const out = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) { if (e.name === '__corpus__') continue; walk(full) }
      else if (/\.(?:js|jsx)$/.test(e.name) && !/\.test\.(?:js|jsx)$/.test(e.name)) out.push(full)
    }
  }
  walk(HERE)
  return out
}
const FILES = sourceFiles().filter((f) => !OWNS_A_SCALE.some((o) => f.endsWith(o)))
const rel = (f) => path.relative(HERE, f)
const codeLines = (text) =>
  text.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => !/^\s*(\/\/|\*|\/\*|\{\/)/.test(l))

/** WCAG relative luminance, so a tier step is measured and not eyeballed. */
function luminance(hex) {
  const c = hex.replace('#', '').match(/../g).map((h) => {
    const v = parseInt(h, 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const step = (a, b) => Math.abs(luminance(a) - luminance(b)) * 100
const tokenValue = (name) => {
  const root = TOKENS.slice(TOKENS.indexOf(':root'), TOKENS.indexOf('[data-theme="dark"]'))
  return (root.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`)) ?? [])[1]?.toUpperCase()
}

describe('T111 — a surface is a TIER, never a colour a component picked (R101)', () => {
  it('there are exactly three tiers, and each carries background, border and shadow together', () => {
    // R101: a tier is all three or it is not a tier. The rail dissolving into the page in Phase 6
    // happened because the background moved and the border and shadow did not — one property
    // carrying an elevation that takes three.
    expect(TIER_NAMES).toEqual(['ground', 'card', 'nested'])
    for (const name of TIER_NAMES) {
      const t = SURFACE_TIERS[name]
      expect(t.bg, `${name} has no background`).toBeTruthy()
      expect(t, `${name} does not declare a border`).toHaveProperty('border')
      expect(t, `${name} does not declare a shadow`).toHaveProperty('shadow')
      expect(t.rule.length, `${name} has no rule in words`).toBeGreaterThan(40)
    }
  })

  it('returns props, and refuses a tier it does not have', () => {
    expect(surfaceTier('card')).toHaveProperty('className')
    expect(surfaceTier('card').className).toContain('bg-rf-surface-card')
    expect(() => surfaceTier('floating')).toThrow(/unknown tier/)
  })

  it('no component sets a background — it picks a tier', () => {
    // "If you find yourself setting a background in a component, the scale is missing a tier"
    // (R101). What follows is the list of things that are NOT tiers, each with its reason — because
    // a background is not automatically a surface:
    //
    //   transparent / current   the absence of one
    //   rf-brand- / rf-status- / rf-lens-   a SIGNAL. A hover tint or a status pill is a state on a
    //                           surface, not an elevation. T113 governs where blue may land.
    //   rf-surface-inverse      a dark pill with light type — the text colour used as a ground. Not
    //                           an elevation, so not a tier; named so nobody reaches for a raw hex.
    //   rf-scrim                the dimming behind a modal.
    //   rf-border-              a 1px rule or a chart bar drawn in a border colour.
    //   rf-text-               a tick mark or divider. A line, not a surface.
    //   gradient               the table's edge fades, whose stops are themselves tier tokens.
    //
    // The three TIERS never appear here, because a component asks surfaceTier() for them and the
    // class is written in that module. That is the whole point: this test passing means no
    // component names a surface at all.
    const ALLOWED = /bg-(?:transparent|current|gradient|rf-brand-|rf-status-|rf-lens-|rf-surface-inverse|rf-scrim|rf-border-|rf-text-)/
    const offenders = []
    for (const file of FILES) {
      for (const [n, line] of codeLines(fs.readFileSync(file, 'utf8'))) {
        for (const m of line.matchAll(/\bbg-[a-z0-9/[\]._-]+/g)) {
          if (ALLOWED.test(m[0])) continue
          offenders.push(`${rel(file)}:${n} ${m[0]} — pick a tier`)
        }
      }
    }
    expect(offenders, 'a component is choosing its own surface').toEqual([])
  })
})

describe('T112 — adjacent tiers are actually distinguishable (R108)', () => {
  it('THE FLOOR IS A 5% LUMINANCE STEP, and here is why that number', () => {
    // MEASURED, NOT CHOSEN. Before this phase the ground was #FAFBFD and a card #FFFFFF: a 3.59%
    // step, ratio 1.035. At that separation the two read as ONE SHEET at a glance — the card is
    // legible only because of its 1px border, and every surface in the app looked like the same
    // piece of paper. That is the evidence for the floor; without it the number looks arbitrary.
    //
    // 5% is where the boundary survives without the border carrying it. The tiers this phase ships
    // clear it by a wide margin rather than scraping it, which is deliberate: a floor you sit on is
    // a floor you fall through the next time a tint moves.
    expect(MIN_TIER_STEP).toBe(5)
    expect(step('#FAFBFD', '#FFFFFF')).toBeLessThan(MIN_TIER_STEP) // the defect, kept as evidence
  })

  it('every pair of tiers that can touch clears the floor', () => {
    // ground|card and card|nested are the pairs that share an edge. ground|nested is NOT: a nested
    // surface lives inside a card, so it is never drawn against the page.
    const v = (name) => tokenValue(SURFACE_TIERS[name].bg.replace(/^bg-/, ''))
    for (const [a, b] of [['ground', 'card'], ['card', 'nested']]) {
      const va = v(a); const vb = v(b)
      expect(va, `${a} resolves to no token value`).toBeTruthy()
      expect(vb, `${b} resolves to no token value`).toBeTruthy()
      expect(step(va, vb), `${a} and ${b} are ${step(va, vb).toFixed(2)}% apart`)
        .toBeGreaterThanOrEqual(MIN_TIER_STEP)
    }
  })

  it('and the ground stays light enough that text on it still clears AA (I4)', () => {
    // THE CONSTRAINT THAT SET THE GROUND. Darkening the page is how tiers separate, and it is also
    // how text on the page stops being readable. #F2F4F7 was the darker candidate and put tertiary
    // text at 4.51 — clearing AA by a hundredth, which the next tint change quietly breaks. R108
    // took #F4F6FA: 7.95% of separation with real headroom instead of 9.71% with none.
    const ground = tokenValue(SURFACE_TIERS.ground.bg.replace(/^bg-/, ''))
    const ratio = (fg) => {
      const a = luminance(fg); const b = luminance(ground)
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }
    for (const token of ['rf-text-primary', 'rf-text-secondary', 'rf-text-tertiary']) {
      const value = tokenValue(token)
      expect(ratio(value), `${token} on the ground`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('T113 — blue is interactive or current, wherever it lands (I3)', () => {
  // Phase 6's T104 enumerated the files. Phase 7 widens WHERE blue lands without widening what it
  // MEANS, so the enumeration grows and the rule does not.
  const INTERACTIVE = {
    'ui/Button.jsx': 'the primary CTA',
    'ui/Checkbox.jsx': 'a checked box is a selection the operator made',
    'ui/Tooltip.jsx': 'its focus ring',
    'blocks/SliderBlock.jsx': 'the slider is dragged',
    'blocks/TableBlock.jsx': 'row-select focus, the selected row, the header ground, row hover',
    'components/StepTracker.jsx': 'the CURRENT stage',
    'components/Shell.jsx': 'the current story, nav hover and focus, and the brand mark',
    'components/StageActionBar.jsx': 'the pinned primary action',
    'components/PaneEyebrow.jsx': 'the breadcrumb links',
    'ui/SnoozeUntilField.jsx': 'a focusable input',
    'ui/Toast.jsx': 'the info tone',
    'ui/Alert.jsx': 'the info tone',
    'pages/ActionStoriesHome.jsx': 'the story links',
    'blocks/CardSetBlock.jsx': 'a selectable card is the slate\'s row (R111)',
  }
  const usesBrand = (file) => /rf-brand-blue|rf-brand-focus-ring|rf-brand-indicator|rf-brand-tint/.test(
    codeLines(fs.readFileSync(file, 'utf8')).map(([, l]) => l).join('\n'),
  )

  it('no file outside the enumerated set carries the brand blue', () => {
    const leaked = []
    for (const file of FILES) {
      if (INTERACTIVE[rel(file)]) continue
      if (usesBrand(file)) leaked.push(`${rel(file)} — blue on something neither interactive nor current`)
    }
    expect(leaked).toEqual([])
  })

  it('and the Realify Signal mark stays violet (R112)', () => {
    // It marks AI PROVENANCE, not an affordance. Painting it blue would widen what blue MEANS
    // rather than where it lands, which is the distinction I3 exists to protect.
    const text = fs.readFileSync(path.join(HERE, 'blocks/TextBlock.jsx'), 'utf8')
    expect(text).toContain('rf-brand-purple')
    expect(codeLines(text).map(([, l]) => l).join('\n')).not.toMatch(/rf-brand-blue/)
  })
})

describe('T114 — one treatment per hierarchy level (R102/R109)', () => {
  // THE DIAGNOSIS THIS ASSERTS, measured on S9.1/decide before the phase: FOUR patterns across
  // three levels, and the two that mattered were indistinguishable.
  //
  //   Guardrails / Slate / Alternatives   h2,h3   12 / 600 / upper / #475467
  //   Recommendation Metrics              p       12 / 600 / upper / #667085   <- same treatment,
  //                                                                               different tag AND
  //                                                                               different colour
  //   Recommendation Identity             span    15 / 400 / none  / #475467   <- block title
  //   Grow 18 SKUs with proven headroom   h4      15 / 400 / none  / #111827   <- card title
  //
  // The block title and the card title render IDENTICALLY apart from colour. Two levels of
  // hierarchy drawn the same is why no hierarchy reads, and colour alone is not a level.
  it('the three levels are declared, and each steps in BOTH size and weight', () => {
    expect(Object.keys(LABEL_LEVELS)).toEqual(['section', 'blockTitle', 'cardTitle'])
    const px = (l) => LABEL_LEVELS[l].px
    const weight = (l) => LABEL_LEVELS[l].weight
    expect(px('section')).toBeLessThan(px('blockTitle'))
    expect(px('blockTitle')).toBeLessThan(px('cardTitle'))
    expect(weight('blockTitle'), 'a title must not be the same weight as prose').toBeGreaterThanOrEqual(600)
    expect(weight('cardTitle')).toBeGreaterThanOrEqual(600)
  })

  it('a level is one treatment, so no component spells its own', () => {
    for (const l of ['section', 'blockTitle', 'cardTitle']) {
      expect(labelLevel(l)).toHaveProperty('className')
    }
    expect(() => labelLevel('subheading')).toThrow(/unknown level/)
  })
})

describe('T117 — nothing changed but presentation (I6)', () => {
  // The whole corpus rendered before the phase started, committed, compared block-for-block and
  // character-for-character. R111 legitimately turns one slot from a table into cards, and the
  // strings that transition are named rather than regenerated — R75's rule.
  let container
  let root
  const render = (d) => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    const resolved = resolveTemplate(d)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<StageRenderer manifest={resolved.manifest} fixture={d} />))
    const slots = [...container.querySelectorAll('[data-block-slot]')].map((n) => n.getAttribute('data-block-slot'))
    const strings = []
    const w = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    let n; while ((n = w.nextNode())) { const t = (n.textContent || '').replace(/\s+/g, ' ').trim(); if (t) strings.push(t) }
    act(() => root.unmount()); container.remove()
    return { slots, text: strings.sort() }
  }

  it('measures the whole corpus, so this cannot pass vacuously', () => {
    expect(Object.keys(before)).toHaveLength(105)
  })

  it('every object renders the same block set', () => {
    const changed = []
    for (const d of dataset) {
      const now = render(d)
      if (JSON.stringify(now.slots) !== JSON.stringify(before[d.proposal_id].slots)) {
        changed.push(`${d.proposal_id}: ${before[d.proposal_id].slots.length} -> ${now.slots.length}`)
      }
    }
    expect(changed).toEqual([])
  })

  it('and the same rendered TEXT, to the character', () => {
    const changed = []
    for (const d of dataset) {
      const now = render(d)
      const was = before[d.proposal_id]
      if (JSON.stringify(now.text) !== JSON.stringify(was.text)) {
        const gone = was.text.filter((s) => !now.text.includes(s)).slice(0, 3)
        const added = now.text.filter((s) => !was.text.includes(s)).slice(0, 3)
        changed.push(`${d.proposal_id}: -${JSON.stringify(gone)} +${JSON.stringify(added)}`)
      }
    }
    expect(changed, 'a presentation change altered what the page says').toEqual([])
  })
})
