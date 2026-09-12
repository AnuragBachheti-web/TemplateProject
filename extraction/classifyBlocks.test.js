import { describe, it, expect } from 'vitest'
import {
  classifyBlockType,
  planSections,
  findMetadataDescriptorSlots,
  findNestedControlColumns,
  orderBlocksSemantically,
} from './classifyBlocks.js'

describe('classifyBlockType — orphaned rich field disqualifies table promotion (S9.1/execute.dests regression)', () => {
  it('does not promote a row set to table when a row has a genuinely rich, non-control nested array (would render blank in a table cell)', () => {
    const dests = [
      { name: 'Markdown & recovery', meta: '12 exit SKUs', statusLabel: 'staged', btnLabel: 'Push', items: [{ name: 'A', before: 'x', after: 'y' }] },
      { name: 'Channel sync', meta: '30 edits', statusLabel: 'staged', btnLabel: 'Push', items: [{ name: 'B', before: 'p', after: 'q' }] },
    ]
    expect(classifyBlockType(dests, 'dests')).toBe('itemQueue')
  })

  it('__raw (the extraction-time raw-record companion) never counts as an orphaned field', () => {
    const rows = [
      { sku: 'A', name: 'Alpha', price: 10, qty: 2, __raw: { sku: 'A', old: 9 } },
      { sku: 'B', name: 'Beta', price: 20, qty: 4, __raw: { sku: 'B', old: 18 } },
    ]
    expect(classifyBlockType(rows, 'rows')).toBe('table')
  })

  it('a genuinely empty array field does not disqualify table promotion', () => {
    const rows = [
      { sku: 'A', name: 'Alpha', price: 10, qty: 2, notes: [] },
      { sku: 'B', name: 'Beta', price: 20, qty: 4, notes: [] },
    ]
    expect(classifyBlockType(rows, 'rows')).toBe('table')
  })
})


describe('classifyBlockType — identity-field generalization (DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §3/§7/§8)', () => {
  it('classifies a rich, uniform, sku-identified record as table — the S9.11 Decide canonical shape', () => {
    const slate = [
      { sku: 'NW-KNF-0480', name: 'Alder chef knife', prices: '$68.00 -> $71.99', pct: '+5.9%', vol: '-3.4%', cm: '+$1,240', conf: '88%', tag: 'Buy Box sensitive' },
      { sku: 'NW-CER-1120', name: 'Ridgeline bowl', prices: '$24.00 -> $26.99', pct: '+12.5%', vol: '-2.2%', cm: '+$1,080', conf: '84%', tag: '' },
    ]
    expect(classifyBlockType(slate, 'slate')).toBe('table')
  })

  it('classifies a rich, uniform, id-identified record as table too — the rule is shape-driven, not one extra key name', () => {
    const rows = [
      { id: 'C1', title: 'Claim one', value: '$120', due: '3d', state: 'open' },
      { id: 'C2', title: 'Claim two', value: '$80', due: '5d', state: 'open' },
    ]
    expect(classifyBlockType(rows, 'claims')).toBe('table')
  })

  it('a generalized identity field with too few columns falls back to itemQueue, not labelValueList (no literal "label" to satisfy that block type\'s own validator)', () => {
    const rows = [{ sku: 'A', qty: 3 }, { sku: 'B', qty: 5 }]
    expect(classifyBlockType(rows)).toBe('itemQueue')
  })

  it('falls back to a fully-unique-string fallback identity when none of the named candidates match', () => {
    const rows = [
      { ref: 'R-1', a: 'x', b: 1, c: true },
      { ref: 'R-2', a: 'y', b: 2, c: false },
    ]
    expect(classifyBlockType(rows)).toBe('table')
  })

  it('does not invent an identity from a single-row array (no uniqueness to confirm against)', () => {
    const rows = [{ ref: 'R-1', a: 'x', b: 1 }]
    expect(classifyBlockType(rows)).toBe('itemQueue')
  })

  it('still prefers a real scatter/bar chart over table promotion when the only meaningful columns beyond identity are plot coordinates', () => {
    const points = [
      { label: 'P1', x: 10, y: 20 },
      { label: 'P2', x: 30, y: 40 },
    ]
    expect(classifyBlockType(points)).toBe('scatterChart')
  })
})

describe('classifyBlockType — nested row-level control (S9.11/decide.slate.modes)', () => {
  const slateWithModes = [
    {
      sku: 'A', name: 'Alpha', prices: '$1', pct: '+1%', cm: '$1', conf: '88%',
      modes: [{ label: 'Roll' }, { label: 'Test' }],
    },
    {
      sku: 'B', name: 'Beta', prices: '$2', pct: '+2%', cm: '$2', conf: '84%',
      modes: [{ label: 'Roll' }, { label: 'Test' }],
    },
  ]

  it('a nested {label,...} option array does not disqualify the row set from becoming a table', () => {
    expect(classifyBlockType(slateWithModes, 'slate')).toBe('table')
  })

  it('findNestedControlColumns reports exactly the nested-control column(s), not the scalar ones', () => {
    expect(findNestedControlColumns(slateWithModes)).toEqual(['modes'])
  })

  it('findNestedControlColumns returns nothing for a plain scalar table', () => {
    const rows = [{ sku: 'A', qty: 1 }, { sku: 'B', qty: 2 }]
    expect(findNestedControlColumns(rows)).toEqual([])
  })
})

describe('classifyBlockType — gauge/threshold detection', () => {
  it('classifies a magnitude + threshold-sibling row set as gauge, not table or barChart', () => {
    const bars = [
      { label: 'Spend cap', value: '62%', limitPct: '80%' },
      { label: 'Service floor', value: '91%', limitPct: '95%' },
    ]
    expect(classifyBlockType(bars, 'bars')).toBe('gauge')
  })

  it('does not misclassify an ordinary magnitude row (no threshold-shaped sibling) as gauge', () => {
    const rows = [{ label: 'W1', value: '$26.3K' }, { label: 'W2', value: '$24.1K' }]
    expect(classifyBlockType(rows)).toBe('barChart')
  })
})

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
  it('classifies a uniform >=4-scalar-column, generalized-identity record as table', () => {
    const rows = [
      { name: 'A', sku: 'X-1', qty: 3, price: 10 },
      { name: 'B', sku: 'X-2', qty: 5, price: 20 },
    ]
    expect(classifyBlockType(rows)).toBe('table')
  })

  it('a generalized-identity row set with only 3 scalar columns stays itemQueue, not table (DYNAMIC_COMPOSITION_PHASE2_REPORT.md: the >=3 threshold over-promoted short bordered cards to table across ~40% of the reference corpus)', () => {
    const rows = [
      { name: 'A', sku: 'X-1', qty: 3 },
      { name: 'B', sku: 'X-2', qty: 5 },
    ]
    expect(classifyBlockType(rows)).toBe('itemQueue')
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

describe('classifyBlockType — barChart unit compatibility (regression: S9.1/decide.checks/totals)', () => {
  it('does NOT classify a ratio + currency + percent checklist as barChart (confirmed guardrail_verdict bug)', () => {
    const checks = [
      { label: 'GMROI target ≥ 2.4', value: '2.31', pct: '96' },
      { label: 'Capital ceiling $480K', value: '$440K', pct: '92' },
      { label: 'Exit-rate cap 8% per quarter', value: '5.6%', pct: '70' },
    ]
    expect(classifyBlockType(checks)).toBe('labelValueList')
  })

  it('does NOT classify dollars mixed with a bare count as barChart (confirmed totals bug)', () => {
    const totals = [
      { label: '90-day revenue', value: '+$41K' },
      { label: '90-day CM$', value: '+$25K' },
      { label: 'Capital freed', value: '$28K' },
      { label: 'SKUs touched', value: '56' },
    ]
    expect(classifyBlockType(totals)).toBe('labelValueList')
  })

  it('DOES classify same-unit currency rows as barChart, even at very different magnitudes', () => {
    const recurrence = [
      { label: 'Daily', value: '−$2,210' },
      { label: 'Rest of the month', value: '−$26.5K' },
      { label: 'Addressed by the cards', value: '−$2,210' },
    ]
    expect(classifyBlockType(recurrence)).toBe('barChart')
  })

  it('DOES classify a same-unit bare-count breakdown as barChart', () => {
    const movement = [
      { label: 'Promoted to Hero', value: '+3' },
      { label: 'Fell to Supporting', value: '−7' },
      { label: 'Held their role', value: '199' },
    ]
    expect(classifyBlockType(movement)).toBe('barChart')
  })

  it('treats a blank primary value with a pixel-height fallback as "no opinion", not a unit conflict', () => {
    // S9.2/decide.weeks-style: some weeks have no revenue ("value": ""), drawn as a 2px sliver via
    // "h" instead — that fallback must not be compared against the dollar unit of the other weeks.
    const weeks = [
      { label: 'W1', value: '$26.3K', h: '74px' },
      { label: 'W2', value: '', h: '2px' },
      { label: 'W3', value: '$11.5K', h: '32px' },
    ]
    expect(classifyBlockType(weeks)).toBe('barChart')
  })

  it('rejects a bare array mixing currency and percent strings', () => {
    expect(classifyBlockType(['$5', '10%', '$8'])).toBe('itemQueue')
  })

  it('still accepts a bare array of consistently-unformatted numeric strings', () => {
    expect(classifyBlockType(['12', '18', '32'])).toBe('barChart')
  })
})

describe('classifyBlockType — multi-series lineChart via per-row `path` (regression: S9.3/analyze.curves)', () => {
  it('classifies an array of {path, label} rows as lineChart, not labelValueList', () => {
    const curves = [
      { path: 'M38.0 24.8 L63.5 35.5 L89.0 44.5', label: 'DTC · $18.40' },
      { path: 'M38.0 44.6 L63.5 61.5 L89.0 73.6', label: 'FBA-West · next unit $13.60' },
    ]
    expect(classifyBlockType(curves)).toBe('lineChart')
  })
})

describe('classifyBlockType — labeled scatter/bubble points (regression: S9.4/analyze.points, S9.9/analyze.ladders)', () => {
  it('classifies labeled x/y rows as scatterChart instead of falling into labelValueList', () => {
    const points = [
      { x: '827.5', y: '213.3', r: 4.5, label: 'Amazon Ads · $52K · 0.95' },
      { x: '435.7', y: '196.1', r: 4.5, label: 'Google · $26K · 1.26' },
    ]
    expect(classifyBlockType(points)).toBe('scatterChart')
  })

  it('classifies labeled bubble rows (x/y/r) the same way', () => {
    const ladders = [
      { x: '96.8', y: '134.6', r: 13, label: '50% single cut · $61.6K · 3.1pp' },
      { x: '156.5', y: '111.3', r: 11, label: '40% single cut · $66.2K · 2.4pp' },
    ]
    expect(classifyBlockType(ladders)).toBe('scatterChart')
  })

  it('still prefers a bar-shaped magnitude over treating a labeled row as a scatter point', () => {
    const bar = [{ label: 'A', value: '$5', x: 1, y: 2 }]
    expect(classifyBlockType(bar)).toBe('barChart')
  })
})

describe('classifyBlockType — rich labeled records promote to table (density fix: S9.1/reason.policy)', () => {
  const policy = [
    { label: 'GMROI target', value: '≥ 2.4', current: 'portfolio 1.9', why: 'Gross margin return on inventory investment.' },
    { label: 'Capital ceiling', value: '$520K', current: '$468K committed', why: 'Total assortment capital.' },
  ]

  it('classifies a uniform >=4-meaningful-column labeled row set as table, not labelValueList', () => {
    expect(classifyBlockType(policy, 'policy')).toBe('table')
  })

  it('decorative columns (tint/tone) do not count toward the 4-column threshold', () => {
    const withDecoration = policy.map((row) => ({ ...row, tint: 'var(--amber-50)', tone: 'var(--amber-700)' }))
    expect(classifyBlockType(withDecoration, 'policy')).toBe('table')
  })

  it('a plain 2-3-column labeled checklist stays labelValueList (not force-promoted)', () => {
    const simple = [{ label: 'Orders · 90 days', meta: '18,402 rows' }, { label: 'Returns', meta: '90 days' }]
    expect(classifyBlockType(simple, 'inputs')).toBe('labelValueList')
  })

  it('the explicit CHECKLIST_RAW_KEYS exemption keeps a rich guardrail checklist as labelValueList, not table', () => {
    const checks = [
      { label: 'GMROI target ≥ 2.4', value: '2.31', pct: '96', tone: 'var(--green-700)', note: 'Short by 0.09.' },
      { label: 'Capital ceiling $480K', value: '$440K', pct: '92', tone: 'var(--green-700)', note: 'On track.' },
    ]
    // Same shape as `policy` above (4 meaningful columns: label/value/pct/note) — would promote to
    // table by shape alone, but the raw key "checks" is explicitly exempted (a live pass/fail
    // guardrail gate reads better as a compact rail checklist than a table — see the exemption's
    // own doc comment in classifyBlocks.js).
    expect(classifyBlockType(checks, 'checks')).toBe('labelValueList')
  })

  it('a different raw key with the identical shape as `checks` is NOT exempted (the rule is keyed by name, not by shape)', () => {
    const notChecks = [
      { label: 'GMROI target ≥ 2.4', value: '2.31', pct: '96', tone: 'var(--green-700)', note: 'Short by 0.09.' },
      { label: 'Capital ceiling $480K', value: '$440K', pct: '92', tone: 'var(--green-700)', note: 'On track.' },
    ]
    expect(classifyBlockType(notChecks, 'someOtherKey')).toBe('table')
  })
})

describe('planSections — generic, vocabulary/shape-driven section grouping (Phase 2)', () => {
  function block(slotName, blockType) {
    return { slotName, blockType, binding: `data.${slotName}` }
  }

  it('emits no sections for a small stage (below the block-count threshold)', () => {
    const blocks = [block('a', 'text'), block('b', 'table'), block('c', 'text')]
    const { sections } = planSections(blocks, {})
    expect(sections).toBeUndefined()
  })

  it('groups scalar blocks into "summary", charts into "analysis", everything else into "details"', () => {
    const blocks = [
      block('a', 'text'), block('b', 'number'), block('c', 'flag'),
      block('chart1', 'barChart'), block('chart2', 'lineChart'),
      block('tbl', 'table'), block('q', 'itemQueue'), block('list', 'labelValueList'),
      block('extra', 'text'),
    ]
    const { sections, sectionBySlot } = planSections(blocks, {})
    expect(sections.map((s) => s.id)).toEqual(['summary', 'analysis', 'details'])
    expect(sectionBySlot.get('a')).toBe('summary')
    expect(sectionBySlot.get('chart1')).toBe('analysis')
    expect(sectionBySlot.get('tbl')).toBe('details')
  })

  it('routes every guardrail_* slot into "guardrails" regardless of its blockType', () => {
    const blocks = [
      block('guardrail_blocked', 'flag'),
      block('guardrail_checks', 'labelValueList'),
      block('guardrail_cta_label', 'text'),
      block('a', 'text'), block('b', 'number'), block('c', 'flag'),
      block('tbl', 'table'), block('q', 'itemQueue'), block('list', 'labelValueList'),
    ]
    const { sections, sectionBySlot } = planSections(blocks, {})
    expect(sections[0].id).toBe('guardrails')
    expect(sectionBySlot.get('guardrail_blocked')).toBe('guardrails')
    expect(sectionBySlot.get('guardrail_checks')).toBe('guardrails') // a labelValueList, still routed by name not shape
  })

  it('treats a small object (<=3 keys) as summary-eligible, a large one as details', () => {
    const blocks = [
      block('small', 'object'), block('large', 'object'),
      block('a', 'text'), block('b', 'number'), block('c', 'flag'),
      block('tbl', 'table'), block('q', 'itemQueue'), block('list', 'labelValueList'),
      block('extra', 'text'),
    ]
    const data = { small: { a: 1, b: 2 }, large: { a: 1, b: 2, c: 3, d: 4 } }
    const { sectionBySlot } = planSections(blocks, data)
    expect(sectionBySlot.get('small')).toBe('summary')
    expect(sectionBySlot.get('large')).toBe('details')
  })

  it('emits no sections when every block lands in the same single bucket, even above the threshold', () => {
    const blocks = Array.from({ length: 10 }, (_, i) => block(`t${i}`, 'text'))
    const { sections } = planSections(blocks, {})
    expect(sections).toBeUndefined()
  })

  it('never throws on an empty or malformed data object', () => {
    const blocks = Array.from({ length: 10 }, (_, i) => block(`t${i}`, i % 2 ? 'text' : 'table'))
    expect(() => planSections(blocks, undefined)).not.toThrow()
    expect(() => planSections(blocks, null)).not.toThrow()
  })
})

describe('planSections — semantic placement (FORENSIC_AUDIT_S9.1.md fix: "scalar/text" ≠ "rail")', () => {
  function block(slotName, blockType) {
    return { slotName, blockType, binding: `data.${slotName}` }
  }

  it('routes a hero-named scalar into the "recommendation" section (region: main), never "summary" (region: rail)', () => {
    const blocks = [
      block('heroTitle', 'text'), block('heroSub', 'text'),
      block('a', 'text'), block('b', 'number'), block('c', 'flag'),
      block('tbl', 'table'), block('q', 'itemQueue'), block('list', 'labelValueList'),
      block('extra', 'text'),
    ]
    const { sections, sectionBySlot, roleBySlot } = planSections(blocks, {})
    expect(sectionBySlot.get('heroTitle')).toBe('recommendation')
    expect(sectionBySlot.get('heroSub')).toBe('recommendation')
    expect(sectionBySlot.get('a')).toBe('summary') // an ordinary scalar is untouched by this rule
    expect(roleBySlot.get('heroTitle')).toBe('hero')
    expect(roleBySlot.get('a')).toBeUndefined()
    const recommendation = sections.find((s) => s.id === 'recommendation')
    expect(recommendation.region).toBe('main')
    const summary = sections.find((s) => s.id === 'summary')
    expect(summary.region).toBe('rail')
  })

  it('pulls a hero companion (heroMetrics/moveBar) into "recommendation" too, but only when a hero slot is present in the same stage', () => {
    const withHero = [block('heroTitle', 'text'), block('heroMetrics', 'barChart'), block('moveBar', 'labelValueList'), block('a', 'text'), block('b', 'number'), block('c', 'flag'), block('tbl', 'table'), block('q', 'itemQueue'), block('list', 'labelValueList')]
    const { sectionBySlot: withHeroSlots, layoutBySlot } = planSections(withHero, {})
    expect(withHeroSlots.get('heroMetrics')).toBe('recommendation')
    expect(withHeroSlots.get('moveBar')).toBe('recommendation')
    // Every recommendation member shares one explicit group + a full-width span.
    expect(layoutBySlot.get('heroTitle')).toEqual({ group: 'recommendation', span: 12 })
    expect(layoutBySlot.get('heroMetrics')).toEqual({ group: 'recommendation', span: 12 })

    const withoutHero = [block('heroMetrics', 'barChart'), block('moveBar', 'labelValueList'), block('a', 'text'), block('b', 'number'), block('c', 'flag'), block('tbl', 'table'), block('q', 'itemQueue'), block('list', 'labelValueList'), block('extra', 'text')]
    const { sectionBySlot: withoutHeroSlots } = planSections(withoutHero, {})
    // No hero slot in this stage at all — heroMetrics/moveBar fall back to ordinary shape rules
    // (heroMetrics is a chart -> analysis; moveBar is a labelValueList, not a scalar -> details).
    expect(withoutHeroSlots.get('heroMetrics')).toBe('analysis')
    expect(withoutHeroSlots.get('moveBar')).toBe('details')
  })

  it('routes "totals" to a "rollup" rail section and "basis" to a "provenance" rail section, by raw key', () => {
    const blocks = [
      block('totals', 'labelValueList'), block('basis', 'labelValueList'),
      block('a', 'text'), block('b', 'number'), block('c', 'flag'),
      block('tbl', 'table'), block('q', 'itemQueue'), block('list', 'labelValueList'),
      block('extra', 'text'),
    ]
    const { sections, sectionBySlot } = planSections(blocks, {})
    expect(sectionBySlot.get('totals')).toBe('rollup')
    expect(sectionBySlot.get('basis')).toBe('provenance')
    expect(sections.find((s) => s.id === 'rollup').region).toBe('rail')
    expect(sections.find((s) => s.id === 'provenance').region).toBe('rail')
  })

  it('every SECTION_ORDER entry declares a region, and guardrails/summary/rollup/provenance are rail while recommendation/analysis/details are main', () => {
    const blocks = [
      block('guardrail_blocked', 'flag'), block('heroTitle', 'text'), block('totals', 'labelValueList'), block('basis', 'labelValueList'),
      // Two charts (not one) so the chart+table pairing (an unambiguous-1-of-each rule) never
      // fires here — this test is only about section/region vocabulary completeness, not pairing.
      block('chart1', 'barChart'), block('chart2', 'lineChart'), block('tbl', 'table'), block('q', 'itemQueue'),
      block('a', 'text'), block('b', 'number'), block('c', 'flag'),
    ]
    const { sections } = planSections(blocks, {})
    const regionOf = (id) => sections.find((s) => s.id === id)?.region
    expect(regionOf('guardrails')).toBe('rail')
    expect(regionOf('summary')).toBe('rail')
    expect(regionOf('rollup')).toBe('rail')
    expect(regionOf('provenance')).toBe('rail')
    expect(regionOf('recommendation')).toBe('main')
    expect(regionOf('analysis')).toBe('main')
    expect(regionOf('details')).toBe('main') // "tbl"/"q" land here, and details is main too
  })
})

describe('planSections — control-dependency composition (DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §7/§9/§11)', () => {
  function block(slotName, blockType, binding) {
    return { slotName, blockType, binding: binding ?? `data.${slotName}` }
  }

  it('fuses a slider block and every block its own measured dependencies name into one "decision" section + shared layout.group', () => {
    const blocks = [
      block('tol', 'slider'),
      block('slate', 'table'),
      block('liveStats', 'labelValueList'),
      block('unrelatedA', 'text'),
      block('unrelatedB', 'number'),
      block('unrelatedC', 'flag'),
      block('unrelatedD', 'text'),
      block('unrelatedE', 'text'),
      block('unrelatedF', 'text'),
    ]
    const dataObject = {
      tol: { min: 1, max: 8, value: 4, dependencies: ['slate', 'liveStats'] },
      slate: [],
      liveStats: [],
    }
    const { sectionBySlot, layoutBySlot } = planSections(blocks, dataObject)
    expect(sectionBySlot.get('tol')).toBe('decision')
    expect(sectionBySlot.get('slate')).toBe('decision')
    expect(sectionBySlot.get('liveStats')).toBe('decision')
    expect(sectionBySlot.get('unrelatedA')).not.toBe('decision')
    expect(layoutBySlot.get('tol').group).toBe(layoutBySlot.get('slate').group)
    expect(layoutBySlot.get('tol').group).toBe(layoutBySlot.get('liveStats').group)
  })

  it('does not create a "decision" section for a slider with no measured dependencies', () => {
    const blocks = [
      block('tol', 'slider'), block('a', 'text'), block('b', 'number'), block('c', 'flag'),
      block('d', 'text'), block('e', 'text'), block('f', 'text'), block('g', 'text'), block('h', 'text'),
    ]
    const dataObject = { tol: { min: 1, max: 8, value: 4, dependencies: [] } }
    const { sectionBySlot } = planSections(blocks, dataObject)
    expect(sectionBySlot.get('tol')).not.toBe('decision')
  })

  it('only groups a dependency that is a real slotName-resolvable raw key present in this same stage\'s blocks', () => {
    const blocks = [
      block('tol', 'slider'), block('slate', 'table'), block('a', 'text'), block('b', 'number'),
      block('c', 'flag'), block('d', 'text'), block('e', 'text'), block('f', 'text'), block('g', 'text'),
    ]
    const dataObject = { tol: { min: 1, max: 8, value: 4, dependencies: ['slate', 'somethingNotAedBlock'] } }
    const { sectionBySlot } = planSections(blocks, dataObject)
    expect(sectionBySlot.get('slate')).toBe('decision')
    expect(sectionBySlot.get('a')).not.toBe('decision')
  })
})

describe('planSections — execution/diff composition (Pattern E: destination + before/after)', () => {
  function block(slotName, blockType, binding) {
    return { slotName, blockType, binding: binding ?? `data.${slotName}` }
  }

  it('routes an itemQueue block whose items carry a direct before/after pair into "execution"', () => {
    const blocks = [
      block('dests', 'itemQueue'), block('a', 'text'), block('b', 'number'), block('c', 'flag'),
      block('d', 'text'), block('e', 'text'), block('f', 'text'), block('g', 'text'), block('h', 'text'),
    ]
    const dataObject = { dests: [{ name: 'X', before: 'old', after: 'new' }] }
    const { sectionBySlot, sections } = planSections(blocks, dataObject)
    expect(sectionBySlot.get('dests')).toBe('execution')
    expect(sections.find((s) => s.id === 'execution').region).toBe('main')
  })

  it('routes an itemQueue block whose items carry a NESTED before/after diff list (a destination card\'s own line items) into "execution"', () => {
    const blocks = [
      block('dests', 'itemQueue'), block('a', 'text'), block('b', 'number'), block('c', 'flag'),
      block('d', 'text'), block('e', 'text'), block('f', 'text'), block('g', 'text'), block('h', 'text'),
    ]
    const dataObject = {
      dests: [{ name: 'Markdown & recovery', items: [{ name: 'Stop-buy flags', before: 'auto', after: 'locked' }] }],
    }
    const { sectionBySlot } = planSections(blocks, dataObject)
    expect(sectionBySlot.get('dests')).toBe('execution')
  })

  it('does NOT route a plain itemQueue with no diff shape into "execution"', () => {
    const blocks = [
      block('feed', 'itemQueue'), block('a', 'text'), block('b', 'number'), block('c', 'flag'),
      block('d', 'text'), block('e', 'text'), block('f', 'text'), block('g', 'text'), block('h', 'text'),
    ]
    const dataObject = { feed: [{ title: 'Event one', detail: 'Something happened' }] }
    const { sectionBySlot } = planSections(blocks, dataObject)
    expect(sectionBySlot.get('feed')).not.toBe('execution')
  })
})

describe('planSections — chart+table pairing was tried and removed (regression guard)', () => {
  function block(slotName, blockType, binding) {
    return { slotName, blockType, binding: binding ?? `data.${slotName}` }
  }

  // A full 105-screen validation against the reference corpus found this heuristic fabricated a
  // relationship in 4 of 5 real occurrences (only 1 was a genuine chart+table pairing; the other 3
  // "charts" were plain label/value summary lists with no chart geometry at all). Removed rather
  // than patched — see classifyBlocks.js's own doc comment above findControlDependencyGroups.
  // This guard confirms an unambiguous single-chart/single-table stage no longer gets a fabricated
  // `pair:` group — each keeps its own independently-assigned section instead.
  it('does not invent a chart+table pairing group for an otherwise-unrelated chart and table', () => {
    const blocks = [
      block('chart1', 'barChart'), block('rows', 'table'), block('a', 'text'), block('b', 'number'),
      block('c', 'flag'), block('d', 'text'), block('e', 'text'), block('f', 'text'), block('g', 'text'),
    ]
    const { layoutBySlot } = planSections(blocks, {})
    expect(layoutBySlot.get('chart1')).toBeUndefined()
    expect(layoutBySlot.get('rows')).toBeUndefined()
  })
})

describe('orderBlocksSemantically — L3 dynamic ordering (DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §5)', () => {
  function block(slotName, blockType, binding) {
    return { slotName, blockType, binding: binding ?? `data.${slotName}` }
  }

  it('moves a hero-vocabulary block to the front, regardless of its original position', () => {
    const blocks = [block('a', 'text'), block('b', 'table'), block('heroTitle', 'text'), block('c', 'number')]
    const ordered = orderBlocksSemantically(blocks, {})
    expect(ordered[0].slotName).toBe('heroTitle')
  })

  it('moves a control (slider) with real measured dependencies to the front, ahead of unrelated content', () => {
    const blocks = [block('a', 'text'), block('tol', 'slider'), block('b', 'table')]
    const dataObject = { tol: { min: 1, max: 8, value: 4, dependencies: ['b'] } }
    const ordered = orderBlocksSemantically(blocks, dataObject)
    expect(ordered[0].slotName).toBe('tol')
  })

  it('orders a control\'s dependents as metrics-first, then table/chart — regardless of their original order', () => {
    const blocks = [
      block('slate', 'table'), block('liveStats', 'labelValueList'), block('tol', 'slider'), block('unrelated', 'text'),
    ]
    const dataObject = { tol: { min: 1, max: 8, value: 4, dependencies: ['slate', 'liveStats'] } }
    const ordered = orderBlocksSemantically(blocks, dataObject)
    const names = ordered.map((b) => b.slotName)
    expect(names.indexOf('tol')).toBeLessThan(names.indexOf('liveStats'))
    expect(names.indexOf('liveStats')).toBeLessThan(names.indexOf('slate'))
  })

  it('preserves original relative order for blocks the signals do not distinguish (stable sort)', () => {
    const blocks = [block('a', 'text'), block('b', 'table'), block('c', 'itemQueue'), block('d', 'number')]
    const ordered = orderBlocksSemantically(blocks, {})
    expect(ordered.map((b) => b.slotName)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('never mutates the input array', () => {
    const blocks = [block('heroTitle', 'text'), block('a', 'number')]
    const copy = [...blocks]
    orderBlocksSemantically(blocks, {})
    expect(blocks).toEqual(copy)
  })

  it('works even for a stage below the sectioning threshold (does not depend on planSections)', () => {
    const blocks = [block('a', 'text'), block('heroTitle', 'text')]
    const ordered = orderBlocksSemantically(blocks, {})
    expect(ordered[0].slotName).toBe('heroTitle')
  })
})

describe('findMetadataDescriptorSlots — suppress column/row metadata that describes a sibling table (RENDERED_UI_FORENSIC_AUDIT.md §3.1/§5)', () => {
  function block(slotName, blockType, rawKey) {
    return { slotName, blockType, binding: `data.${rawKey ?? slotName}` }
  }

  it('suppresses a matching cols + sibling table (the exact S9.1/analyze shape)', () => {
    const blocks = [block('cols', 'labelValueList'), block('rows', 'table')]
    const dataObject = {
      cols: [
        { key: 'product', label: 'Product' },
        { key: 'gmroi', label: 'GMROI', numeric: true },
      ],
      rows: [{ product: 'Widget', gmroi: 3.6 }],
    }
    const suppressed = findMetadataDescriptorSlots(blocks, dataObject)
    expect(suppressed.has('cols')).toBe(true)
    expect(suppressed.has('rows')).toBe(false)
  })

  it('does NOT suppress an unrelated array (not descriptor-shaped: no key/label pair on every item)', () => {
    const blocks = [block('inputs', 'labelValueList'), block('rows', 'table')]
    const dataObject = {
      inputs: [{ label: 'Orders · 90 days', meta: '18,402 rows' }], // has `label` but no `key`
      rows: [{ product: 'Widget' }],
    }
    const suppressed = findMetadataDescriptorSlots(blocks, dataObject)
    expect(suppressed.size).toBe(0)
  })

  it('does NOT suppress a malformed descriptor array (missing key or label on some items) — preserved safely', () => {
    const blocks = [block('cols', 'labelValueList'), block('rows', 'table')]
    const dataObject = {
      cols: [{ key: 'product', label: 'Product' }, { key: 'gmroi' /* no label */ }],
      rows: [{ product: 'Widget', gmroi: 3.6 }],
    }
    const suppressed = findMetadataDescriptorSlots(blocks, dataObject)
    expect(suppressed.size).toBe(0)
  })

  it('does NOT suppress when no sibling table exists at all', () => {
    const blocks = [block('cols', 'labelValueList')]
    const dataObject = {
      cols: [{ key: 'product', label: 'Product' }, { key: 'gmroi', label: 'GMROI' }],
    }
    const suppressed = findMetadataDescriptorSlots(blocks, dataObject)
    expect(suppressed.size).toBe(0)
  })

  it('does NOT suppress when the sibling table\'s own columns do not actually match the descriptor keys', () => {
    const blocks = [block('cols', 'labelValueList'), block('unrelatedRows', 'table')]
    const dataObject = {
      cols: [{ key: 'product', label: 'Product' }, { key: 'gmroi', label: 'GMROI' }],
      unrelatedRows: [{ name: 'x', status: 'y' }], // no overlap with cols' own keys at all
    }
    const suppressed = findMetadataDescriptorSlots(blocks, dataObject)
    expect(suppressed.size).toBe(0)
  })

  it('never throws on empty/malformed inputs', () => {
    expect(() => findMetadataDescriptorSlots([], {})).not.toThrow()
    expect(() => findMetadataDescriptorSlots([block('cols', 'labelValueList')], {})).not.toThrow()
    expect(() => findMetadataDescriptorSlots([block('cols', 'labelValueList')], { cols: null })).not.toThrow()
  })
})
