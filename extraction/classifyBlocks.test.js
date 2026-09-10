import { describe, it, expect } from 'vitest'
import { classifyBlockType } from './classifyBlocks.js'

describe('classifyBlockType — scalars', () => {
  it('classifies plain scalars', () => {
    expect(classifyBlockType('hello')).toBe('text')
    expect(classifyBlockType('')).toBeNull()
    expect(classifyBlockType(42)).toBe('number')
    expect(classifyBlockType(true)).toBe('flag')
    expect(classifyBlockType(undefined)).toBeNull()
    expect(classifyBlockType(null)).toBeNull()
  })

  it('classifies a raw SVG line path string as lineChart instead of text', () => {
    expect(classifyBlockType('M44.0 230.0 L74.1 228.4 L104.3 226.6')).toBe('lineChart')
    // a single M+L pair still counts as a path
    expect(classifyBlockType('M0 0 L10 10')).toBe('lineChart')
    // ordinary prose that happens to start with a capital letter must not be swept up
    expect(classifyBlockType('Merge the L1 and L2 caches')).toBe('text')
  })
})

describe('classifyBlockType — waterfallChart', () => {
  const rows = [
    { label: 'Baseline', value: '$12,480', top: 19.5, height: 80.5, anchor: true },
    { label: 'FBA fee', value: '−$2,210', top: 19.5, height: 59.7, tag: 'unexpected' },
    { label: 'Price effect', value: '+$610', top: 62.7, height: 16.5 },
  ]

  it('classifies a top/height/value/anchor shape as waterfallChart', () => {
    expect(classifyBlockType(rows)).toBe('waterfallChart')
  })

  it('requires at least one anchor row — otherwise it is not a bridge, just bar-shaped', () => {
    const noAnchor = rows.map((r) => ({ ...r, anchor: undefined }))
    expect(classifyBlockType(noAnchor)).toBe('barChart')
  })

  it('requires both top and height on every row', () => {
    const missingTop = rows.map((row) => {
      const copy = { ...row }
      delete copy.top
      return copy
    })
    expect(classifyBlockType(missingTop)).not.toBe('waterfallChart')
  })
})

describe('classifyBlockType — heatmapGrid', () => {
  const rfmGrid = [
    { label: 'Top decile', note: '$310 median', cells: [{ count: '1,940', ltv: '$318' }, { count: '1,120', ltv: '$304' }] },
    { label: 'Second decile', cells: [{ count: '520', ltv: '$288' }, { count: '280', ltv: '$262' }] },
  ]

  it('classifies a labeled array of {cells: [...]} rows as heatmapGrid', () => {
    expect(classifyBlockType(rfmGrid)).toBe('heatmapGrid')
  })

  it('tolerates pre-formatted cell values ("$318", "1,940"), not just bare numbers', () => {
    // regression: isNumericLike alone (strict Number()) rejects both of these — heatmap
    // classification must use the more tolerant looksLikeMagnitude check instead.
    expect(classifyBlockType(rfmGrid)).toBe('heatmapGrid')
  })

  it('is not fooled by a cell that is really a labeled sub-item (that is an itemQueue nested list, not a matrix cell)', () => {
    const notAGrid = [{ label: 'Row', cells: [{ name: 'Real item', count: 5 }] }]
    expect(classifyBlockType(notAGrid)).not.toBe('heatmapGrid')
  })
})

describe('classifyBlockType — barChart', () => {
  it('classifies labeled rows with a magnitude, even formatted ("$26.3K", "74px")', () => {
    const weeks = [
      { label: 'W1', value: '$26.3K', h: '74px', bar: 'var(--mod-inventory)' },
      { label: 'W2', value: '$24.1K', h: '68px', bar: 'var(--mod-inventory)' },
    ]
    expect(classifyBlockType(weeks)).toBe('barChart')
  })

  it('classifies an unlabeled array of {h} magnitudes, even alongside raw x/y layout fields', () => {
    // S9.15/analyze.bars-style: a magnitude wins over treating the row as a bare coordinate.
    const bars = [{ x: 25.1, y: 14.0, h: 146.0, op: 0.3 }, { x: 79.4, y: 14.0, h: 64.2, op: 0.3 }]
    expect(classifyBlockType(bars)).toBe('barChart')
  })

  it('classifies a bare array of numbers/numeric strings as barChart, not an ambiguous "series"', () => {
    expect(classifyBlockType([12, 18, 32])).toBe('barChart')
    expect(classifyBlockType(['12', '18', '32'])).toBe('barChart')
  })

  it('does NOT promote an ordinary labeled metric row to barChart just because label is a string', () => {
    // e.g. S9.1/decide.basis-style: real content, but not a plottable magnitude.
    const basis = [
      { label: 'SKUs with a full 4-quarter history', value: '187 of 214' },
      { label: 'Gap-fill demand estimates', value: '±34%' },
    ]
    expect(classifyBlockType(basis)).toBe('labelValueList')
  })
})

describe('classifyBlockType — scatterChart', () => {
  it('classifies coordinate-only rows (no label) as scatterChart', () => {
    const points = [{ hue: 'var(--mod-discover)', r: 4, cx: '764.1', cy: '78.6' }]
    expect(classifyBlockType(points)).toBe('scatterChart')
  })

  it('never wins over a bar-shaped row that also has coordinates (magnitude takes priority)', () => {
    const mixed = [{ x: 1, y: 2, h: 10 }]
    expect(classifyBlockType(mixed)).toBe('barChart')
  })
})

describe('classifyBlockType — precedence ordering', () => {
  it('waterfall beats bar when a row matches both (top+height+anchor is a superset of bar’s own fields)', () => {
    const rows = [
      { label: 'Baseline', value: '$1', top: 0, height: 10, anchor: true },
      { label: 'Delta', value: '$2', top: 10, height: 5 },
    ]
    expect(classifyBlockType(rows)).toBe('waterfallChart')
  })

  it('a plain {label, ...} list stays labelValueList when nothing more specific matches', () => {
    expect(classifyBlockType([{ label: 'Order rows', value: '18,402' }, { label: 'Accuracy', value: 'n/a' }])).toBe(
      'labelValueList',
    )
  })
})

describe('classifyBlockType — untouched shapes (regression guard)', () => {
  it('still classifies uniform >=3-scalar-column rows as table', () => {
    const rows = [
      { name: 'A', sku: 'X-1', qty: 3 },
      { name: 'B', sku: 'X-2', qty: 5 },
    ]
    expect(classifyBlockType(rows)).toBe('table')
  })

  it('still classifies variable-shape rich rows as itemQueue', () => {
    const rows = [{ title: 'a', detail: 'x' }, { title: 'b', history: [{ label: 'e1' }] }]
    expect(classifyBlockType(rows)).toBe('itemQueue')
  })

  it('still applies the *Ticks/*Cols axis-label override regardless of numeric-looking content', () => {
    expect(classifyBlockType(['116', '110', '104', '98'], 'yTicks')).toBe('itemQueue')
    expect(classifyBlockType(['$12', '$9', '$6', '$3'], 'yTicks')).toBe('itemQueue')
  })

  it('still classifies a {min, max, value} object as slider', () => {
    expect(classifyBlockType({ min: 1, max: 8, value: 4 })).toBe('slider')
  })

  it('still returns object for a lone descriptor', () => {
    expect(classifyBlockType({ title: 'a' })).toBe('object')
  })
})
