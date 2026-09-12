import { describe, it, expect } from 'vitest'
import { extractControlElements } from './parseMockup.js'

describe('extractControlElements — P0 fix (DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §2/§9)', () => {
  it('recovers a real range input\'s min/max/step and its two-way-bound state key', () => {
    const html = `
      <div>
        <input type="range" min="1" max="8" step="0.5" value="{{ tol }}" onChange="{{ onTol }}" onInput="{{ onTol }}" />
      </div>
    `
    expect(extractControlElements(html)).toEqual([{ type: 'range', stateKey: 'tol', min: 1, max: 8, step: 0.5 }])
  })

  it('finds multiple range inputs across a whole document, independent of a workflow name', () => {
    const html = `
      <input type="range" min="0" max="4" step="1" value="{{ notchVal }}" onChange="{{ onNotch }}">
      <input type="range" min="6" max="24" step="1" value="{{ rlThreshold }}" onChange="{{ onRlSlide }}" />
    `
    expect(extractControlElements(html)).toEqual([
      { type: 'range', stateKey: 'notchVal', min: 0, max: 4, step: 1 },
      { type: 'range', stateKey: 'rlThreshold', min: 6, max: 24, step: 1 },
    ])
  })

  it('defaults step to 1 when absent', () => {
    const html = `<input type="range" min="0" max="10" value="{{ x }}">`
    expect(extractControlElements(html)).toEqual([{ type: 'range', stateKey: 'x', min: 0, max: 10, step: 1 }])
  })

  it('never fabricates bounds — skips a range input missing min/max entirely', () => {
    const html = `<input type="range" value="{{ x }}">`
    expect(extractControlElements(html)).toEqual([])
  })

  it('skips a value binding that is not a bare identifier (a computed expression, never guessed at)', () => {
    const html = `<input type="range" min="0" max="10" value="{{ this.state.x + 1 }}">`
    expect(extractControlElements(html)).toEqual([])
  })

  it('ignores a literal (non-templated) value attribute', () => {
    const html = `<input type="range" min="0" max="10" value="5">`
    expect(extractControlElements(html)).toEqual([])
  })

  it('ignores non-range inputs entirely', () => {
    const html = `<input type="text" value="{{ name }}"><input type="checkbox" checked="{{ flag }}">`
    expect(extractControlElements(html)).toEqual([])
  })

  it('rejects a malformed range whose min is not less than max', () => {
    const html = `<input type="range" min="10" max="5" value="{{ x }}">`
    expect(extractControlElements(html)).toEqual([])
  })

  it('returns an empty list for markup with no controls at all', () => {
    expect(extractControlElements('<div><p>Hello</p></div>')).toEqual([])
  })
})
