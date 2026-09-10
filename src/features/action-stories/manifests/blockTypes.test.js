import { describe, it, expect } from 'vitest'
import { validateBlockData } from './blockTypes'

describe('validateBlockData', () => {
  it('accepts undefined for every type (an optional/missing field is not a problem)', () => {
    const types = [
      'text', 'number', 'flag', 'labelValueList', 'table', 'itemQueue',
      'lineChart', 'barChart', 'scatterChart', 'waterfallChart', 'heatmapGrid',
      'object', 'slider',
    ]
    for (const type of types) {
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

  it('validates lineChart accepts an SVG path string or an array of {path} series', () => {
    expect(validateBlockData('lineChart', 'M0 0 L10 10')).toEqual([])
    expect(validateBlockData('lineChart', [{ path: 'M0 0 L10 10' }, { name: 'b', path: 'M0 5 L10 15' }])).toEqual([])
    expect(validateBlockData('lineChart', [{ name: 'no path' }]).length).toBeGreaterThan(0)
    expect(validateBlockData('lineChart', 42).length).toBeGreaterThan(0)
  })

  it('validates barChart accepts a bare numeric array or an array of {label, value|h|height|pct|amount}', () => {
    expect(validateBlockData('barChart', [1, 2, 3])).toEqual([])
    expect(validateBlockData('barChart', [{ label: 'W1', value: '$26.3K' }])).toEqual([])
    expect(validateBlockData('barChart', [{ label: 'W1', h: '74px' }])).toEqual([])
    expect(validateBlockData('barChart', [{ label: 'no magnitude' }]).length).toBeGreaterThan(0)
    expect(validateBlockData('barChart', [{ value: 1 }])).toEqual([]) // label is optional — falls back to a bare index
    expect(validateBlockData('barChart', 'not an array').length).toBeGreaterThan(0)
  })

  it('validates scatterChart requires numeric x/cx and y/cy per point', () => {
    expect(validateBlockData('scatterChart', [{ x: 1, y: 2 }])).toEqual([])
    expect(validateBlockData('scatterChart', [{ cx: 1, cy: 2, r: 4 }])).toEqual([])
    expect(validateBlockData('scatterChart', [{ x: 1 }]).length).toBeGreaterThan(0) // missing y
    expect(validateBlockData('scatterChart', 'not an array').length).toBeGreaterThan(0)
  })

  it('validates waterfallChart requires top/height/value per row and at least one anchor row', () => {
    const rows = [
      { label: 'Baseline', value: '$12,480', top: 19.5, height: 80.5, anchor: true },
      { label: 'FBA fee', value: '−$2,210', top: 19.5, height: 59.7 },
    ]
    expect(validateBlockData('waterfallChart', rows)).toEqual([])
    expect(validateBlockData('waterfallChart', rows.map((r) => ({ ...r, anchor: false }))).length).toBeGreaterThan(0) // no anchor row
    expect(validateBlockData('waterfallChart', [{ label: 'only one row', value: 1, top: 1, height: 1, anchor: true }]).length).toBeGreaterThan(0)
    expect(validateBlockData('waterfallChart', 'not an array').length).toBeGreaterThan(0)
  })

  it('validates heatmapGrid requires a labeled row with a non-empty cells array', () => {
    expect(validateBlockData('heatmapGrid', [{ label: 'Row 1', cells: [{ count: 5 }] }])).toEqual([])
    expect(validateBlockData('heatmapGrid', [{ label: 'Row 1', cells: [] }]).length).toBeGreaterThan(0)
    expect(validateBlockData('heatmapGrid', [{ cells: [{ count: 5 }] }]).length).toBeGreaterThan(0) // missing label
    expect(validateBlockData('heatmapGrid', 'not an array').length).toBeGreaterThan(0)
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
