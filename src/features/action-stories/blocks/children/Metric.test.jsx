// @vitest-environment jsdom
//
// THE DEFECT: `deltaTone()` returns an OBJECT — `{text, dot, color}` — and `Metric` passed the whole
// object where `typeRole` takes a className STRING. Template-interpolated, that becomes the literal
// class `[object Object]`, which matches no rule in any stylesheet, so every signed figure a
// `statList` or a `cardSet` rendered came out in the default ink with no error anywhere.
//
// WHY NOTHING CAUGHT IT. deltaTone.test.js asserts the tokens the function RETURNS, and
// designSystem.test.jsx asserts those tokens exist in tokens.css at AA-clearing values. Both were
// green throughout: each end of the wire was tested and the wire was not. The corpus render tests
// compare TEXT, and this bug changes no text. Every other consumer — TableBlock.jsx:312,
// LabelValueListBlock.jsx:111, ItemQueueBlock, ObjectBlock — reads `tone.text`; `Metric` was the one
// that did not, so the defect was invisible in exactly one component.
//
// So the second test below is deliberately not about tone at all. It renders the whole corpus and
// fails on `[object Object]` appearing in ANY className, because "an object was interpolated into a
// class string" is the general shape of this mistake and it can land anywhere a component composes
// classes. A test for the specific bug would not have caught it in the first place.

import { describe, it, expect, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

import Metric from './Metric'
import StageRenderer from '../../components/StageRenderer'
import { resolveTemplate } from '../../templates/templateRegistry'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

let container
let root

function mount(element) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(element))
  return container
}

afterEach(() => {
  if (root) act(() => root.unmount())
  container?.remove()
  root = undefined
  container = undefined
})

/** The class on the element that actually renders the figure. */
const figureClass = (c) => c.querySelector('[data-metric] > div:nth-child(2)')?.className ?? ''

describe('Metric — a signed figure takes its tone token, not the tone object', () => {
  it('a negative figure renders the critical TEXT token', () => {
    const cls = figureClass(mount(<Metric label="Attributed" value="−$1,970" meta="five drivers" />))
    expect(cls).toContain('text-rf-status-critical-text')
  })

  it('a positive figure renders the success TEXT token', () => {
    const cls = figureClass(mount(<Metric label="Residual" value="+$130" meta="1.0% of the move" />))
    expect(cls).toContain('text-rf-status-success-text')
  })

  it('an UNSIGNED figure stays in the default ink — deltaTone colours a direction, not a quantity', () => {
    // Guards the fix from overreaching: `$12,480` is a level, not a delta, and deltaTone.js is
    // deliberate that a bare positive gets no colour. Colouring every figure would be the noise
    // that module's header rejects.
    const cls = figureClass(mount(<Metric label="Baseline" value="$12,480" meta="trailing 7-day mean CM" />))
    expect(cls).toContain('text-rf-text-primary')
    expect(cls).not.toContain('rf-status')
  })

  it('never emits the stringified tone object as a class', () => {
    for (const value of ['−$1,970', '+$130', '$12,480']) {
      expect(figureClass(mount(<Metric label="x" value={value} />)), value).not.toContain('[object Object]')
      if (root) act(() => root.unmount())
      container?.remove()
      root = undefined
    }
  })
})

describe('no component interpolates an object into a className, on any of the 105', () => {
  it('renders the whole corpus and finds no "[object Object]" class', () => {
    const offenders = []
    for (const decision of dataset) {
      const resolved = resolveTemplate(decision)
      if (!resolved) continue

      mount(<StageRenderer manifest={resolved.manifest} fixture={decision} />)
      for (const node of container.querySelectorAll('[class*="[object"]')) {
        offenders.push(`${decision.proposal_id}: <${node.tagName.toLowerCase()} class="${node.className}">`)
      }
      act(() => root.unmount())
      container.remove()
      root = undefined
      container = undefined
    }
    expect(offenders.slice(0, 5), 'an object reached a class string').toEqual([])
  })
})
