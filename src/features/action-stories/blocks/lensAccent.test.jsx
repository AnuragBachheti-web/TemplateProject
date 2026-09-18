// @vitest-environment jsdom
// Phase 5E Part 2 — T96. The lens accent (R86) and the branches deltaTone no longer has (R88).
//
// Both halves are about the same thing: colour that means something must be derivable, and colour
// that means the WRONG thing is worse than no colour at all.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { LENS_ACCENTS, LENS_NAMES, lensAccent } from './lensAccent'
import { deltaTone } from './deltaTone'
import { MemoryRouter } from 'react-router-dom'
import StageRenderer from '../components/StageRenderer'
import PaneEyebrow from '../components/PaneEyebrow'
import { resolveTemplate } from '../templates/templateRegistry'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'

const HERE = path.dirname(fileURLToPath(import.meta.url))
// HISTORICAL REFERENCE, READ ON PURPOSE (Phase 6). docs/design-system/05-color.html is no longer
// this product's design system — the shipping product is, and where the two disagree the product
// wins. It is still the document that DECLARED the --mod-* module hues, which is the one thing this
// test needs from it: that a lens accent is a real module hue and not a colour someone liked. The
// file is not deleted and nothing else reads it.
const DS_COLOR = fs.readFileSync(path.resolve(HERE, '../../../../docs/design-system/05-color.html'), 'utf8')
const CORPUS_LENSES = [...new Set(dataset.map((d) => d.lens))].sort()

describe('T96a — the lens accent is the DS\'s own module hue, and only an accent (R86)', () => {
  it('covers every lens the corpus actually carries, and invents none', () => {
    expect(Object.keys(LENS_ACCENTS).sort()).toEqual(CORPUS_LENSES)
    expect(CORPUS_LENSES).toEqual(['ads', 'cash', 'inventory', 'margin', 'sales'])
  })

  it('every accent is a --mod-* hue the design system declares', () => {
    // Not a colour picked to look right. Four map onto their namesake module; `sales` has no module
    // hue in the DS at all and takes --mod-intel, the brand graphite — the largest lens (49 of 105
    // objects) wearing the quietest colour.
    for (const [lens, accent] of Object.entries(LENS_ACCENTS)) {
      expect(accent.mod, `${lens} names no DS module hue`).toMatch(/^--mod-[a-z]+$/)
      expect(DS_COLOR, `${accent.mod} is not declared in 05-color.html`).toContain(`${accent.mod}:`)
    }
    expect(LENS_ACCENTS.sales.mod).toBe('--mod-intel')
    expect(LENS_ACCENTS.margin.mod).toBe('--mod-margin')
    expect(LENS_ACCENTS.inventory.mod).toBe('--mod-inventory')
    expect(LENS_ACCENTS.ads.mod).toBe('--mod-ads')
    expect(LENS_ACCENTS.cash.mod).toBe('--mod-cash')
  })

  it('records the two collisions rather than pretending they are not there', () => {
    // --mod-cash is byte-identical to rose-500 (rf-status-critical) and --mod-inventory to
    // violet-500 (rf-status-purple). That is the DS's doing, not a mistake here, and it is exactly
    // why the separation below has to be enforced rather than noted.
    expect(LENS_ACCENTS.cash.collidesWith).toBe('critical')
    expect(LENS_ACCENTS.inventory.collidesWith).toBe('purple')
    for (const lens of ['sales', 'margin', 'ads']) {
      expect(LENS_ACCENTS[lens].collidesWith ?? null).toBeNull()
    }
  })

  it('refuses a lens it does not know, rather than falling back to a colour', () => {
    expect(() => lensAccent('logistics')).toThrow(/unknown lens/)
  })
})

describe('T96b — A LENS ACCENT NEVER SHARES A SURFACE WITH A STATUS COLOUR (R86)', () => {
  // THE CONSTRAINT THAT MAKES THE COLLISIONS SURVIVABLE, asserted rather than promised. A cash-lens
  // object wears #e11d48, which is also what "critical" wears. That is tolerable only while the two
  // can never appear on the same element — otherwise a lens accent reads as a verdict about the
  // data, and a careless slot declaration turns wayfinding into a claim.
  //
  // Two halves, because the two things live in two places and a test that rendered only one would
  // be the adjacency failure this phase keeps finding: the accent is drawn in the pane eyebrow, and
  // status colour is drawn inside the blocks.
  let container
  let root

  const mount = (element) => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(element))
    return container
  }
  const unmount = () => {
    act(() => root.unmount())
    container.remove()
  }

  it('the eyebrow carries an accent for every lens, and no status colour with it', () => {
    for (const lens of LENS_NAMES) {
      const el = mount(
        <MemoryRouter>
          <PaneEyebrow lens={lens} storyCode="S9.1" stage="decide" />
        </MemoryRouter>,
      )
      const accented = [...el.querySelectorAll('*')].filter((n) => /\brf-lens-/.test(n.getAttribute('class') || ''))
      expect(accented.length, `${lens} renders no accent`).toBe(1)
      for (const node of el.querySelectorAll('*')) {
        const cls = node.getAttribute('class') || ''
        expect(/\brf-lens-/.test(cls) && /\brf-status-/.test(cls), `${lens}: an element carries both`).toBe(false)
      }
      unmount()
    }
  })

  it('and a lens accent never leaks into a block, where status colour lives', () => {
    // The whole corpus. If an accent ever reaches a block surface it can land on the same element
    // as a verdict, which is the hazard.
    const offenders = []
    for (const d of dataset) {
      const resolved = resolveTemplate(d)
      const el = mount(<StageRenderer manifest={resolved.manifest} fixture={d} />)
      for (const node of el.querySelectorAll('*')) {
        if (/\brf-lens-/.test(node.getAttribute('class') || '')) offenders.push(`${d.proposal_id}`)
      }
      unmount()
    }
    expect(offenders, 'a lens accent is being drawn inside a block').toEqual([])
  })
})

describe('T96c — deltaTone no longer reads English (R88)', () => {
  // CODE ONLY — the module documents the branches it removed, and a removal notice naming them is
  // not the branch. Same distinction designSystem.test.jsx and figureShape.test.js both draw.
  const src = fs.readFileSync(path.join(HERE, 'deltaTone.js'), 'utf8')
    .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

  it('the word-matching branches are gone from the source, not merely unused', () => {
    expect(src).not.toContain('POSITIVE_WORDS')
    expect(src).not.toContain('NEGATIVE_WORDS')
    // The shape of the thing, not just its names: no word-boundary alternation over English verbs.
    expect(src, 'a prose classifier is still in here under another name')
      .not.toMatch(/increas|decreas|rising|fell|declin|worsen/i)
  })

  it('every one of the 30 prose matches that was wrong is now null', () => {
    // These are the real corpus values the survey found painted. Not invented examples.
    for (const v of [
      'Ridgeline mug top-up → FBA-East',
      'The base of the range. Buffer sized to P75 demand, topped up on the weekly cycle.',
      'CM gain > 1.5× cost',
      'Defect rate 640 PPM above the Tier 3 ceiling and rising for six quarters.',
      'Max volume loss',
      'Ignore · accept the share loss',
      'Drop',
      'High CM per unit, so a small CVR gain pays for a lot of studio time.',
    ]) {
      expect(deltaTone(v), `${JSON.stringify(v.slice(0, 44))} is still being coloured`).toBeNull()
    }
  })

  it('and every one of the 245 legitimate sign-based tones survives', () => {
    expect(deltaTone('−$4.6K')?.text).toMatch(/critical/)
    expect(deltaTone('+12.4%')?.text).toMatch(/success/)
    expect(deltaTone('-$0.8K')?.text).toMatch(/critical/)
    expect(deltaTone(-5)?.text).toMatch(/critical/)
    expect(deltaTone('42'), 'a bare positive number is not news').toBeNull()
  })

  it('a signed value that is NOT a figure gets no tone (R88\'s gate on R87\'s role)', () => {
    // The sign rule and the type role now answer to one definition, so they cannot drift — the same
    // move that fixed Part 1's column rule. A sentence opening with a dash is prose.
    expect(deltaTone('— the supplier withdrew the quote entirely and reissued it')).toBeNull()
  })
})
