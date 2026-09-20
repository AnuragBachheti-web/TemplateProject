// @vitest-environment jsdom
//
// PHASE 6 — T102, T103, T104, T108, T109. The browser halves (T105/T106/T107/T110) are in
// scripts/smoke.mjs, because jsdom has no layout engine and no renderer: it cannot measure a
// contrast ratio, cannot see a tofu box and cannot tell you a table is a ribbon. Structure here,
// behaviour there, and neither pretending to be the other — paneLayout.test.jsx's T79.
//
// WHAT THIS PHASE IS. The design source changed. docs/design-system/05-color.html and
// 06-typography.html describe a DIFFERENT system — Fraunces display, mono-dominant, a monochrome
// ink ramp, no brand accent — and Phase 5E applied them faithfully, which is why the app went grey,
// serif and oversized. The authoritative source is now the shipping product. Those files are
// historical; they are not deleted and they are not read again.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { TYPE_ROLES, TYPE_ROLE_NAMES, MONO_ROLES } from './blocks/typeRole'
import { LENS_ACCENTS } from './blocks/lensAccent'
import StageRenderer from './components/StageRenderer'
import { resolveTemplate } from './templates/templateRegistry'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'
import before from '@/features/action-stories/__corpus__/__snapshots__/phase6-before-render.json'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '../../..')
const TOKENS = fs.readFileSync(path.join(REPO_ROOT, 'src/styles/tokens.css'), 'utf8')

/** THE EXEMPTION LIST. Its length is asserted, so it cannot grow quietly (T102). */
// PHASE 7 ADDS TWO, AND THE GROWTH IS DELIBERATE — flagged rather than slipped in. Phase 7's I1
// says this list may not grow, and the intent behind that is that no COMPONENT gets an exemption.
// These two are not components: `surfaceTier` owns the elevation scale and `labelLevel` owns the
// label scale, exactly as `typeRole` owns the type scale and `glyphSize` the icon sizes. Ruling
// R101 created the first and R102 the second, so refusing them an exemption would mean either a
// scale that cannot state its own values or nine type roles to avoid saying `font-semibold` twice.
const OWNS_A_SCALE = ['blocks/typeRole.js', 'blocks/glyphSize.js', 'blocks/surfaceTier.js', 'blocks/labelLevel.js']

function sourceFiles() {
  const out = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === '__corpus__') continue
        walk(full)
      } else if (/\.(?:js|jsx)$/.test(e.name) && !/\.test\.(?:js|jsx)$/.test(e.name)) out.push(full)
    }
  }
  walk(HERE)
  return out
}
const FILES = sourceFiles().filter((f) => !OWNS_A_SCALE.some((o) => f.endsWith(o)))
const rel = (f) => path.relative(HERE, f)
/** Class-carrying code only. A rule quoted in a comment — including a JSX block comment, which is
 *  how these files document themselves — is documentation, not a breach of itself. */
const codeLines = (text) =>
  text.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => !/^\s*(\/\/|\*|\/\*|\{\/)/.test(l))

const PHASE9_SHAPE_SLOTS = new Set([
  'measures', 'secondary_measures', 'notes', 'execution_measures', 'execution_notes',
  'execution_secondary_notes',
])
// PHASE 9 RE-SCOPED THE TWO ASSERTIONS BELOW, and the promise they were written to keep is intact.
// This phase's whole purpose is to render reference content that nothing rendered before, so
// "identical" is no longer the right question — "nothing LOST, and every addition is a shape slot"
// is. Re-anchoring them to a Phase 9 snapshot instead would have quietly converted a statement
// about THIS phase into a statement about a later one, which is how a guard stops guarding.

describe('T102 — every visual value comes from a token', () => {
  it('the exemption list is four files long, and every one of them owns a scale', () => {
    // A list that may grow ARBITRARILY is not an exemption list. What is on it is the set of
    // modules that DECIDE a scale — typeRole for text, glyphSize for icon glyphs, and from Phase 7
    // surfaceTier for elevation and labelLevel for the three label levels. A literal in one of them
    // is the definition of a value, not a breach of the rule against spelling one.
    //
    // NO COMPONENT IS ON IT, AND NONE EVER MAY BE. That is the line the rule actually protects, and
    // it is why the two Phase 7 additions are stated in the open rather than slipped in.
    expect(OWNS_A_SCALE).toHaveLength(4)
    for (const f of OWNS_A_SCALE) expect(fs.existsSync(path.join(HERE, f)), f).toBe(true)
  })

  it('the product palette is in the token layer, at the product\'s own values', () => {
    for (const [token, value] of [
      ['--rf-brand-blue-500', '#0052EB'],
      ['--rf-brand-blue-600', '#00369D'],
      ['--rf-brand-blue-tint', '#EFF6FF'],
      ['--rf-text-primary', '#111827'],
      ['--rf-text-secondary', '#667085'],
      ['--rf-surface-canvas', '#FFFFFF'],
      ['--rf-surface-sunken', '#FAFBFD'],
      ['--rf-border-subtle', '#E5E7EB'],
    ]) {
      expect(TOKENS, `${token} missing`).toContain(`${token}:`)
      expect(TOKENS.toUpperCase(), `${token} is not the product value`).toContain(value)
    }
  })

  it('radius, shadow and motion are tokens, taken from the product (R94/R99)', () => {
    // R99: 80 `rounded-*`, 13 `shadow-*` and 5 duration classes were Tailwind defaults chosen per
    // component. That is defect 3's mechanism — a card reads as an undifferentiated box because its
    // border, radius and shadow were each picked locally rather than being one card treatment.
    for (const t of ['--rf-radius-sm', '--rf-radius-md', '--rf-radius-lg', '--rf-radius-xl',
                     '--rf-shadow-card', '--rf-shadow-raised', '--rf-shadow-overlay',
                     '--rf-duration-fast', '--rf-duration-base', '--rf-ease-standard']) {
      expect(TOKENS, `${t} missing`).toContain(`${t}:`)
    }
    // The product's own scale: 8 / 10 / 14 / 16.
    for (const v of ['8px', '10px', '14px', '16px']) expect(TOKENS).toContain(v)
  })

  it('no component spells a colour, radius, shadow or duration', () => {
    const BANNED = [
      [/\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:rose|emerald|green|amber|yellow|slate|gray|grey|zinc|neutral|stone|blue|sky|cyan|teal|violet|purple|indigo|fuchsia|pink|red|orange|lime)-\d{2,3}\b/g, 'a raw palette colour'],
      [/#[0-9a-fA-F]{3,8}\b/g, 'a hex literal'],
      // THE TOKEN-BACKED NAMES ARE THE POINT, NOT THE PROBLEM. `rounded-sm/md/lg/xl/full`,
      // `shadow-card/raised/overlay` and `duration-fast/base` all resolve to `var(--rf-*)` through
      // tailwind.config.js, so they ARE the tokens. What is banned is the Tailwind DEFAULTS that
      // bypass them (2xl/3xl, xs/sm/md/lg/xl shadows) and any arbitrary value.
      [/\brounded-(?:2xl|3xl|\[[^\]]+\])/g, 'a radius outside the scale'],
      [/\bshadow-(?:xs|sm|md|lg|xl|2xl|\[[^\]]+\])/g, 'a shadow outside the scale'],
      [/\bduration-(?:\d+|\[[^\]]+\])/g, 'a duration outside the scale'],
    ]
    const offenders = []
    for (const file of FILES) {
      for (const [n, line] of codeLines(fs.readFileSync(file, 'utf8'))) {
        for (const [re, what] of BANNED) {
          for (const m of line.matchAll(re)) offenders.push(`${rel(file)}:${n} ${what} — ${m[0]}`)
        }
      }
    }
    expect(offenders, 'a visual value is still decided in a component').toEqual([])
  })
})

describe('T103 — one type system, and mono is figures only (I3)', () => {
  it('MONO IS THE FIGURE ROLE AND NOTHING ELSE — this reverses 5E\'s R84', () => {
    // R84 made mono the face for label, figure and micro, following the reference mockups' 5,399
    // uses of var(--font-mono). That reading was of the OLD design source. The shipping product is
    // Inter throughout, and the operator's report on the 5E build was that it looked "zoomed in" —
    // mono at DS sizes on every label is most of why. Mono now means ONE thing: this is a quantity.
    expect(MONO_ROLES).toEqual(['figure'])
    for (const name of TYPE_ROLE_NAMES) {
      expect(TYPE_ROLES[name].face === 'mono', `${name}`).toBe(name === 'figure')
      expect(TYPE_ROLES[name].face, `${name} may not be serif — Fraunces is removed (C3)`).not.toBe('serif')
    }
  })

  it('every role states its product hierarchy row, or says why it has none', () => {
    for (const name of TYPE_ROLE_NAMES) {
      const spec = TYPE_ROLES[name]
      expect(spec, `${name} has no productRow`).toHaveProperty('productRow')
      if (spec.productRow === null) expect(spec.extension, `${name} claims no row and gives no reason`).toBeTruthy()
      expect(spec.rule.length, `${name} has no rule in words`).toBeGreaterThan(40)
    }
  })

  it('THE READING SIZE AND THE SCANNING SIZE ARE DIFFERENT ROLES (R95)', () => {
    // The product's body row is 15-16 and its small row is 13-14. This app is both kinds of surface:
    // a narrative is read, a 15-column slate is scanned. R95 binds the choice to the SLOT's nature
    // rather than to a component's taste — so they are two roles, and which file may use which is
    // asserted below rather than left to a rule a component interprets.
    expect(TYPE_ROLES.body.px).toBe(15)
    expect(TYPE_ROLES.small.px).toBe(13)
  })

  it('a dense block may not use the reading size, and a prose block may not use the scanning size', () => {
    // THE BOUNDARY, ENFORCED. Table, grid and list blocks are scanning surfaces; text and card
    // blocks are reading surfaces. A component cannot pick, because picking is what this asserts
    // against.
    const DENSE = ['TableBlock.jsx', 'HeatmapGridBlock.jsx', 'RosterBlock.jsx', 'ChecklistBlock.jsx',
                   'LabelValueListBlock.jsx', 'ItemQueueBlock.jsx', 'TimelineBlock.jsx']
    const PROSE = ['TextBlock.jsx']
    const offenders = []
    for (const file of FILES) {
      const base = path.basename(file)
      const src = fs.readFileSync(file, 'utf8')
      if (DENSE.includes(base) && /typeRole\(\s*'body'/.test(src)) {
        offenders.push(`${rel(file)} is a scanning surface and uses the reading size`)
      }
      if (PROSE.includes(base) && /typeRole\(\s*'small'/.test(src)) {
        offenders.push(`${rel(file)} is a reading surface and uses the scanning size`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('no component sets a family, size, weight or tracking', () => {
    const BANNED = [
      [/\bfont-(?:mono|serif|sans)\b/g, 'a font family'],
      [/\btext-\[[0-9.]+px\]/g, 'a font size'],
      [/\bfont-(?:thin|light|normal|medium|semibold|bold|extrabold|black)\b/g, 'a font weight'],
      [/\btracking-\[?[a-z0-9.-]+\]?/g, 'a tracking value'],
      [/\bleading-\[?[a-z0-9./]+\]?/g, 'a line height'],
    ]
    const offenders = []
    for (const file of FILES) {
      for (const [n, line] of codeLines(fs.readFileSync(file, 'utf8'))) {
        for (const [re, what] of BANNED) {
          for (const m of line.matchAll(re)) offenders.push(`${rel(file)}:${n} ${what} — ${m[0]}`)
        }
      }
    }
    expect(offenders, 'a component is deciding type').toEqual([])
  })
})

describe('T104 — blue is interactive or current, and nothing else (I4)', () => {
  // A pane with blue in five places has none. So the places are ENUMERATED here, and the test
  // fails both ways: a file outside the list using the brand token, and a file in the list that
  // stopped using it (which would mean the signal quietly disappeared again).
  const INTERACTIVE = {
    'ui/Button.jsx': 'the primary CTA — the most interactive thing on a pane',
    'ui/Checkbox.jsx': 'a checked box is a selection the operator made',
    'ui/Tooltip.jsx': 'its focus ring',
    'blocks/SliderBlock.jsx': 'the slider is dragged',
    'blocks/TableBlock.jsx': 'row-select focus ring and the selected row',
    'components/StepTracker.jsx': 'the CURRENT stage',
    // Shell also carries the one blue element that is neither interactive nor current: THE BRAND
    // MARK. A logo is the product's identity, not an affordance, and it does not compete with "what
    // can I act on here" the way a tinted card or a blue border would. Kept deliberately and named
    // here, because an exception nobody wrote down is indistinguishable from a leak.
    'components/Shell.jsx': 'the current story, the nav focus rings, and the brand mark',
    'components/StageActionBar.jsx': 'the pinned primary action',
    'components/PaneEyebrow.jsx': 'the breadcrumb links',
    'ui/SnoozeUntilField.jsx': 'a focusable input',
    'ui/Toast.jsx': 'the info tone, which carries a link-coloured icon',
    'ui/Alert.jsx': 'the info tone',
    // NOT HERE, and each for a stated reason:
    //   AsyncState  a spinner is FEEDBACK, not an affordance — nothing to act on and nowhere you
    //               are. It reads as neutral now. "Something is happening" is not "current".
    //   StagePage   it delegates its breadcrumb to PaneEyebrow and its stages to StepTracker, so it
    //               owns no interactive surface of its own. It was in the first draft of this list
    //               by assumption; the test is what caught that.
    //   TextBlock   the Realify signal mark identifies a block, it does not invite an action. It
    //               takes the product's violet AI accent instead.
    'pages/ActionStoriesHome.jsx': 'the story links',
  }

  const usesBrand = (file) => /rf-brand-blue|rf-brand-focus-ring|rf-brand-indicator|rf-brand-tint/.test(
    codeLines(fs.readFileSync(file, 'utf8')).map(([, l]) => l).join('\n'),
  )

  it('no file outside the enumerated set carries the brand blue', () => {
    const leaked = []
    for (const file of FILES) {
      const r = rel(file)
      if (INTERACTIVE[r]) continue
      if (usesBrand(file)) leaked.push(`${r} — blue on something that is neither interactive nor current`)
    }
    expect(leaked).toEqual([])
  })

  it('and every enumerated place actually has it, so the signal cannot vanish again', () => {
    const missing = []
    for (const [r, why] of Object.entries(INTERACTIVE)) {
      const full = path.join(HERE, r)
      if (!fs.existsSync(full)) { missing.push(`${r} no longer exists`); continue }
      if (!usesBrand(full)) missing.push(`${r} lost its blue — ${why}`)
    }
    expect(missing).toEqual([])
  })

  it('NO LENS ACCENT RESOLVES TO THE BRAND BLUE (R97)', () => {
    // rf-lens-sales was #383838, the same graphite the brand token held. Once blue lands, a lens
    // accent that followed it would read as "current" — which is exactly what I4 exists to stop,
    // and T96b's lens/status separation would not catch it because blue is neither.
    const root = TOKENS.slice(TOKENS.indexOf(':root'), TOKENS.indexOf('[data-theme="dark"]'))
    const valueOf = (name) => (root.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`)) ?? [])[1]?.toUpperCase()
    const blue = [valueOf('rf-brand-blue-500'), valueOf('rf-brand-blue-600')]
    for (const lens of Object.keys(LENS_ACCENTS)) {
      const v = valueOf(`rf-lens-${lens}`)
      expect(v, `rf-lens-${lens} has no value`).toBeTruthy()
      expect(blue, `rf-lens-${lens} is the brand blue — it would read as "current"`).not.toContain(v)
    }
  })
})

describe('T108 — nothing functional changed (I7)', () => {
  // THE STRONGEST FORM OF THIS AVAILABLE: the whole corpus rendered before the phase started,
  // committed, and compared block-for-block and string-for-string. A re-skin that changes a word
  // is not a re-skin.

  /**
   * THE THREE OBJECTS A LATER, DELIBERATELY FUNCTIONAL CHANGE MOVED — named, not regenerated.
   *
   * Re-recording the snapshot would have made this guard pass by forgetting what it was guarding;
   * 102 objects are still pinned block-for-block and character-for-character, and these three are
   * pinned to the ONE transition they are allowed to make. A second change to any of them, or the
   * same change reaching a fourth object, still fails here.
   *
   * `comparison` -> `reconciliation`: `proposal.comparison` carries `{label,value,note}` on these
   * three and `{label,value,pct}` on the other nine. With no `pct`, barChart fell through
   * MAGNITUDE_KEYS to `value` and drew a bar by stripping non-digits from a display string
   * ("−$1,970" -> 1970, sign gone; R2), plotting levels against deltas on one axis, and dropped the
   * `note` entirely. statList renders label, figure and note — the strip the reference draws
   * (S10.1-2-analyze.dc.html:286-288). See slotVocabulary.js's `reconciliation`.
   */
  const ALLOWED_SLOT_MOVE = {
    prop_s9_16_analyze: { was: ['comparison', 'detail_rows'], now: ['reconciliation', 'detail_rows'] },
    prop_s10_1_analyze: {
      // `reconciliation` is declared after `bridge` in the template, where the reference puts the
      // strip: the bridge chart, then its drill, then the reconciliation. `comparison` sat before it.
      was: ['comparison', 'bridge', 'entities', 'detail_rows'],
      now: ['bridge', 'reconciliation', 'entities', 'detail_rows'],
    },
    prop_s10_2_analyze: {
      was: ['comparison', 'detail_rows', 'secondary_rows'],
      now: ['reconciliation', 'detail_rows', 'secondary_rows'],
    },
  }

  /** The text delta such a move is allowed to produce: the notes gained, and nothing lost but the
   *  slot's own title. Asserted per object rather than waved through. */
  const notesOf = (d) => (d.proposal.comparison ?? []).map((r) => r.note).filter(Boolean)

  /**
   * THE ONE HEADING THAT CHANGED — same discipline as ALLOWED_SLOT_MOVE above: one named slot, one
   * exact string pair, and a companion test proving it still happens, so this never decays into a
   * standing licence to reword the product.
   *
   * Blocks used to title themselves `humanizeSlotName(slotName)`, which restates an internal key.
   * On `trigger` the reference says "What raised this" — 11 of the 14 stories carrying the slot
   * title the card exactly that (S10.2-1-reason.dc.html:324 wraps `{{ trigger }}` in it), and
   * slotVocabulary's own note plus TimelineBlock's header had both quoted the string for three
   * phases while the screen printed "Trigger". The heading is now declared on the slot and read by
   * blocks/slotLabel.js.
   *
   * THIS IS A COPY CHANGE AND IT IS MEANT TO BE CAUGHT HERE. What makes it admissible is that the
   * delta is exactly one string out and one string in, on exactly the objects that render the slot:
   * no figure, label, note or sentence moves, which is what the guard is actually protecting.
   */
  const RENAMED_SLOT_HEADING = Object.freeze({ slot: 'trigger', was: 'Trigger', now: 'What raised this', objects: 14 })

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
    const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    let n
    while ((n = walk.nextNode())) {
      const t = (n.textContent || '').replace(/\s+/g, ' ').trim()
      if (t) strings.push(t)
    }
    act(() => root.unmount())
    container.remove()
    return { slots, text: strings.sort() }
  }

  it('measures the whole corpus, so this cannot pass vacuously', () => {
    expect(Object.keys(before)).toHaveLength(105)
  })

  it('every object renders the same block set', () => {
    const changed = []
    for (const d of dataset) {
      const now = render(d)
      const was = before[d.proposal_id]
      // PHASE 9's shape blocks are removed before comparing. This guard is about whether the
      // Phase 6 RE-SKIN moved or dropped a block; a pane additionally gaining a `measures` block
      // is a different phase's change and would otherwise mask the one being watched for.
      const core = now.slots.filter((s) => !PHASE9_SHAPE_SLOTS.has(s))
      if (JSON.stringify(core) === JSON.stringify(was.slots)) continue

      const allowed = ALLOWED_SLOT_MOVE[d.proposal_id]
      if (allowed
        && JSON.stringify(was.slots) === JSON.stringify(allowed.was)
        && JSON.stringify(core) === JSON.stringify(allowed.now)) continue

      changed.push(`${d.proposal_id}: ${JSON.stringify(was.slots)} -> ${JSON.stringify(core)}`)
    }
    expect(changed).toEqual([])
  })

  it('and the three allowed moves all actually happened — the allowance cannot rot', () => {
    // An allow-list entry whose move stopped happening is a permission left lying around, the same
    // failure shapeLedger.test.js's unused-ignore-entry guard exists for.
    for (const [id, move] of Object.entries(ALLOWED_SLOT_MOVE)) {
      const d = dataset.find((x) => x.proposal_id === id)
      expect(d, `${id} is no longer in the corpus`).toBeTruthy()
      // Compared with Phase 9's shape blocks filtered out: the allowance is about WHICH slot the
      // barChart data moved to, and a pane also gaining a `measures` block says nothing about that.
      const slots = render(d).slots.filter((sl) => !PHASE9_SHAPE_SLOTS.has(sl))
      expect(slots, `${id} no longer makes its allowed move`).toEqual(move.now)
    }
  })

  it('and the same rendered TEXT, to the character', () => {
    const changed = []
    for (const d of dataset) {
      const now = render(d)
      const was = before[d.proposal_id]
      if (JSON.stringify(now.text) === JSON.stringify(was.text)) continue

      const gone = was.text.filter((s) => !now.text.includes(s))
      const added = now.text.filter((s) => !was.text.includes(s))

      // The three allowed moves change the text, and exactly how is the point. What ARRIVES is the
      // row data — every label, every figure, every note — because on these three the barChart
      // rendered none of it: S10.2 refused the series outright ("Not enough evidence to chart — 2
      // points") and the other two fell to the block error boundary in this environment, which has
      // no ResizeObserver for recharts. What LEAVES is the slot's own title and those failure
      // strings, and nothing else: a label, figure or note going missing is the regression this
      // guard is for, and still fails.
      if (ALLOWED_SLOT_MOVE[d.proposal_id]) {
        const rows = d.proposal.comparison
        expect(rows.length, `${d.proposal_id} has no rows to render`).toBeGreaterThan(0)
        for (const row of rows) {
          for (const field of ['label', 'value', 'note']) {
            expect(now.text, `${d.proposal_id} does not render ${field} "${row[field]}"`).toContain(row[field])
          }
        }
        expect(notesOf(d), `${d.proposal_id} carries no notes`).toHaveLength(rows.length)

        const LOST_BY_DESIGN = /^(Comparison|Not enough evidence to chart —|points|\d+|\.|This card couldn’t be displayed\.)/
        expect(gone.filter((s) => !LOST_BY_DESIGN.test(s)), `${d.proposal_id} lost real content`).toEqual([])
        expect(added, `${d.proposal_id} did not gain the new title`).toContain('Reconciliation')
        continue
      }

      // The renamed heading: admissible ONLY as an exact one-out/one-in swap, on an object that
      // really renders the slot. Anything else on the same object still lands in `changed`.
      // PHASE 9 loosened the ADDITIONS side of this and nothing else. `gone` is still compared
      // exactly — losing anything but the old heading still fails, which is the whole point — but a
      // pane that also gained a shape block gained its text too, so "exactly one string arrived" is
      // no longer the right shape of the claim. Every addition beyond the new heading must come
      // from a shape slot the pane actually renders.
      const otherAdded = added.filter((t) => t !== RENAMED_SLOT_HEADING.now)
      if (now.slots.includes(RENAMED_SLOT_HEADING.slot)
        && JSON.stringify(gone) === JSON.stringify([RENAMED_SLOT_HEADING.was])
        && added.includes(RENAMED_SLOT_HEADING.now)
        && (otherAdded.length === 0 || now.slots.some((sl) => PHASE9_SHAPE_SLOTS.has(sl)))) continue

      // PHASE 9. A pane that gained a shape block gains its text with it. Only LOSSES are a
      // re-skin regression, which is what this guard was written to catch — so the additions are
      // permitted here and the losses are still compared exactly as before.
      if (gone.length === 0 && now.slots.some((sl) => PHASE9_SHAPE_SLOTS.has(sl))) continue

      changed.push(`${d.proposal_id}: -${JSON.stringify(gone.slice(0, 3))} +${JSON.stringify(added.slice(0, 3))}`)
    }
    expect(changed, 'a re-skin changed what the page says').toEqual([])
  })

  it('and the renamed heading reached EVERY object that renders the slot — the allowance cannot rot', () => {
    // The permission above is scoped to objects rendering `trigger`. If the rename ever stopped
    // reaching one of them, that object would simply stop being compared on this axis and the gap
    // would be invisible. So the carriers are counted and checked directly.
    const { slot, was, now: heading, objects } = RENAMED_SLOT_HEADING
    const carriers = dataset
      .map((d) => ({ id: d.proposal_id, ...render(d) }))
      .filter((r) => r.slots.includes(slot))

    expect(carriers).toHaveLength(objects)
    for (const r of carriers) {
      expect(r.text, `${r.id} does not print the reference heading`).toContain(heading)
      expect(r.text, `${r.id} still prints the slot name as its heading`).not.toContain(was)
    }
  })
})

describe('T109 — statusTone is still the only semantic-to-token module (I5)', () => {
  it('THE TONE LAYER IS EXACTLY FOUR MODULES, and no component is in it', () => {
    // THE RULE IS ABOUT WHO DECIDES, NOT WHO MENTIONS. The first draft of this test flagged
    // deltaTone.js — which is not a defect: deltaTone maps a leading SIGN to a token and has done
    // since 5B, and Phase 5E's T86 never saw it because that scan was .jsx-only. A test that fires
    // on the tone layer for being the tone layer is measuring the wrong thing.
    //
    // So it is asserted two ways. The set of modules allowed to name a status token at all is
    // closed and listed; and no COMPONENT may pick one conditionally, which is the actual defect
    // T86 was written for — a block deciding for itself what colour a verdict is.
    const TONE_LAYER = ['blocks/statusTone.js', 'blocks/deltaTone.js', 'blocks/chartPalette.js', 'blocks/lensAccent.js']
    const namesAStatusToken = FILES.filter((f) => /rf-status-/.test(
      codeLines(fs.readFileSync(f, 'utf8')).map(([, l]) => l).join('\n'),
    ))
    const outside = namesAStatusToken.map(rel).filter((r) => !TONE_LAYER.includes(r) && !r.endsWith('.jsx'))
    expect(outside, 'a module outside the tone layer names a status token').toEqual([])

    // A COMPONENT CHOOSING BETWEEN TWO DIFFERENT TONES is the defect. A component that always
    // uses one is not: an ErrorState is critical, unconditionally, and the ternary next to it picks
    // a LAYOUT. The first version of this check flagged AsyncState, BlockStates and
    // BlockErrorBoundary for exactly that — and Phase 5E's T86 had to carry a two-file exemption
    // list for the same reason. Naming the defect precisely removes the need for the list, which is
    // better than growing one (invariant I2 forbids growing it anyway).
    const deciding = []
    for (const file of FILES) {
      if (!file.endsWith('.jsx')) continue
      for (const [n, line] of codeLines(fs.readFileSync(file, 'utf8'))) {
        if (!/[?:]/.test(line)) continue
        const tones = new Set([...line.matchAll(/rf-status-([a-z]+)/g)].map((m) => m[1]))
        if (tones.size > 1) deciding.push(`${rel(file)}:${n} chooses between ${[...tones].join(' and ')}`)
      }
    }
    expect(deciding, 'a component is deciding a status colour for itself').toEqual([])
  })

  it('R72\'s no-colour verdicts and R88\'s deletion both stand — re-skinning revisits neither', () => {
    const deltaTone = fs.readFileSync(path.join(HERE, 'blocks/deltaTone.js'), 'utf8')
    const code = codeLines(deltaTone).map(([, l]) => l).join('\n')
    expect(code, 'the prose word-matching R88 deleted is back').not.toMatch(/increas|decreas|rising|fell|declin|worsen/i)
    const statusTone = fs.readFileSync(path.join(HERE, 'blocks/statusTone.js'), 'utf8')
    expect(statusTone, 'limitTone started taking an argument again — R72/R73').toMatch(/limitTone\(\s*\)/)
  })

  it('status text clears AA and status icons keep the product hue (R93)', () => {
    // THE DIVERGENCE FROM THE BRIEF, PINNED. Measured, not asserted: the brief's success #16A34A is
    // 3.30:1 on white and its warning #F59E0B is 2.15:1 — neither is a text colour. They stay as
    // the icon/dot hue, which is what a status dot is for, and text takes a derived darker step.
    const contrast = (hex) => {
      const c = hex.replace('#', '').match(/../g).map((h) => {
        const v = parseInt(h, 16) / 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      })
      const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
      return 1.05 / (L + 0.05)
    }
    expect(contrast('#16A34A')).toBeLessThan(4.5)
    expect(contrast('#F59E0B')).toBeLessThan(4.5)
    expect(contrast('#98A2B3'), 'the brief\'s muted grey is not a text colour').toBeLessThan(4.5)
    for (const [token, value] of [['--rf-status-success-text', '#15803D'], ['--rf-status-warning-text', '#B45309']]) {
      expect(TOKENS.toUpperCase(), `${token} is not the derived AA step`).toContain(value)
      expect(contrast(value)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
