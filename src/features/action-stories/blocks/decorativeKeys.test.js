// Regression guard for the confirmed geometry leak TEMPLATE_ARCHITECTURE_AUDIT.md §5 names: mockup
// CSS offsets surviving extraction into `data.rows[]` and rendering as real, user-visible table
// columns ("Band Left: 30%"). `dotLeft` was already covered by the `dot` word; `bandLeft`,
// `bandWidth` and `newLeft` had no rule at all.
import { describe, it, expect } from 'vitest'
import { isDecorativeKey, isHiddenKey, isInternalKey } from './decorativeKeys'

describe('decorativeKeys — mockup geometry never reaches a rendered column', () => {
  // Every geometry key that actually occurs in the corpus, with its occurrence count at the time
  // this guard was written — not a hypothetical list.
  const GEOMETRY_KEYS = [
    'bandLeft', 'bandWidth', 'newLeft', 'dotLeft', 'colLeft', 'colRight',
    'barLeft', 'barWidth', 'footLeft', 'footRight', 'left', 'right', 'width',
  ]

  it.each(GEOMETRY_KEYS)('hides %s', (key) => {
    expect(isHiddenKey(key)).toBe(true)
  })

  // The other half of the rule: widening the decorative vocabulary must not start swallowing real
  // business columns. These are genuine content fields from the corpus.
  const BUSINESS_KEYS = [
    'label', 'name', 'value', 'sku', 'current', 'why', 'recovery', 'grade', 'note',
    'gross', 'net', 'status', 'count', 'meta', 'sub', 'pct', 'amount',
  ]

  it.each(BUSINESS_KEYS)('keeps %s visible', (key) => {
    expect(isHiddenKey(key)).toBe(false)
  })

  // `top` and `height` are deliberately NOT decorative — waterfallChart requires both as real row
  // inputs, and "top" carries business meaning in this domain. See decorativeKeys.js's own note.
  it('leaves waterfallChart row inputs alone', () => {
    expect(isDecorativeKey('top')).toBe(false)
    expect(isDecorativeKey('height')).toBe(false)
  })

  it('still treats __-prefixed extraction companions as internal', () => {
    expect(isInternalKey('__raw')).toBe(true)
    expect(isHiddenKey('__raw')).toBe(true)
  })
})
