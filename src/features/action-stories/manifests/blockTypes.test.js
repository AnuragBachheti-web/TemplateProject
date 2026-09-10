import { describe, it, expect } from 'vitest'
import { validateBlockData } from './blockTypes'

describe('validateBlockData', () => {
  it('accepts undefined for every type (an optional/missing field is not a problem)', () => {
    for (const type of ['text', 'number', 'flag', 'labelValueList', 'table', 'itemQueue', 'series', 'object', 'slider']) {
      expect(validateBlockData(type, undefined)).toEqual([])
    }
  })

  it('validates text', () => {
    expect(validateBlockData('text', 'hello')).toEqual([])
    expect(validateBlockData('text', 42).length).toBeGreaterThan(0)
  })

  it('validates number', () => {
    expect(validateBlockData('number', 42)).toEqual([])
    expect(validateBlockData('number', NaN).length).toBeGreaterThan(0)
    expect(validateBlockData('number', '42').length).toBeGreaterThan(0)
  })

  it('validates flag', () => {
    expect(validateBlockData('flag', true)).toEqual([])
    expect(validateBlockData('flag', 'true').length).toBeGreaterThan(0)
  })

  it('validates labelValueList requires a string label per item', () => {
    expect(validateBlockData('labelValueList', [{ label: 'ok' }])).toEqual([])
    expect(validateBlockData('labelValueList', [{ note: 'no label here' }]).length).toBeGreaterThan(0)
  })

  it('validates itemQueue accepts an array of objects or plain values (ItemQueueBlock renders either)', () => {
    expect(validateBlockData('itemQueue', [{ anything: 1 }, { else: 2 }])).toEqual([])
    expect(validateBlockData('itemQueue', ['M1', 'M3', 'Yr 1'])).toEqual([])
    expect(validateBlockData('itemQueue', 'not an array').length).toBeGreaterThan(0)
  })

  it('validates table strictly requires an array of objects (unlike itemQueue)', () => {
    expect(validateBlockData('table', [{ a: 1 }, { a: 2 }])).toEqual([])
    expect(validateBlockData('table', ['not an object']).length).toBeGreaterThan(0)
  })

  it('validates series accepts an array or an SVG path string', () => {
    expect(validateBlockData('series', [1, 2, 3])).toEqual([])
    expect(validateBlockData('series', 'M0 0 L10 10')).toEqual([])
    expect(validateBlockData('series', 42).length).toBeGreaterThan(0)
  })

  it('validates slider requires min < max and value inside that range', () => {
    expect(validateBlockData('slider', { min: 1, max: 8, value: 4 })).toEqual([])
    expect(validateBlockData('slider', { min: 1, max: 8, value: 4, step: 0.5, steps: [{ at: 4, x: 1 }] })).toEqual([])
    expect(validateBlockData('slider', { min: 8, max: 1, value: 4 }).length).toBeGreaterThan(0)
    expect(validateBlockData('slider', { min: 1, max: 8, value: 20 }).length).toBeGreaterThan(0)
    expect(validateBlockData('slider', { min: 1, max: 8 }).length).toBeGreaterThan(0)
    expect(validateBlockData('slider', { min: 1, max: 8, value: 4, steps: 'nope' }).length).toBeGreaterThan(0)
    expect(validateBlockData('slider', [1, 2, 3]).length).toBeGreaterThan(0)
  })

  it('reports an unknown block type instead of throwing', () => {
    expect(() => validateBlockData('notAType', {})).not.toThrow()
    expect(validateBlockData('notAType', {}).length).toBeGreaterThan(0)
  })
})
