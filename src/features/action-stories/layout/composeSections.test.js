import { describe, it, expect } from 'vitest';
import { composeSections } from './composeSections';

function item(slotName, blockType, extra = {}) {
  return {
    slotName,
    blockType,
    value: extra.value,
    layout: extra.layout,
    section: extra.section,
    region: extra.region,
    forceFullWidth: extra.forceFullWidth,
  };
}

describe('composeSections — legacy manifest (no sections, no layout, no region) is a pure passthrough of the old heuristic', () => {
  it('produces exactly one implicit, untitled main-region section for a manifest with no `sections` field; rail is empty', () => {
    const items = [item('a', 'text'), item('b', 'table')];
    const { main, rail } = composeSections(items, undefined);
    expect(rail).toEqual([]);
    expect(main).toHaveLength(1);
    expect(main[0].id).toBeNull();
    expect(main[0].title).toBeNull();
  });

  it('groups consecutive scalar blocks into one grid row, exactly like the old isGridEligible heuristic', () => {
    const items = [item('a', 'text'), item('b', 'number'), item('c', 'flag')];
    const { main } = composeSections(items, undefined);
    expect(main[0].rows).toEqual([
      { type: 'grid', explicit: false, items: [{ slotName: 'a', span: 1 }, { slotName: 'b', span: 1 }, { slotName: 'c', span: 1 }] },
    ]);
  });

  it('a table/itemQueue/chart never joins a grid row and always gets a single row', () => {
    const items = [item('t', 'table'), item('q', 'itemQueue'), item('c', 'barChart')];
    const { main } = composeSections(items, undefined);
    expect(main[0].rows).toEqual([
      { type: 'single', slotName: 't' },
      { type: 'single', slotName: 'q' },
      { type: 'single', slotName: 'c' },
    ]);
  });

  it('closes a grid run when a non-eligible block interrupts it, starting a new one after', () => {
    const items = [item('a', 'text'), item('b', 'text'), item('tbl', 'table'), item('c', 'text'), item('d', 'text')];
    const { main } = composeSections(items, undefined);
    expect(main[0].rows).toEqual([
      { type: 'grid', explicit: false, items: [{ slotName: 'a', span: 1 }, { slotName: 'b', span: 1 }] },
      { type: 'single', slotName: 'tbl' },
      { type: 'grid', explicit: false, items: [{ slotName: 'c', span: 1 }, { slotName: 'd', span: 1 }] },
    ]);
  });

  it('treats an object block as grid-eligible only when it has 3 or fewer keys', () => {
    const items = [
      item('small', 'object', { value: { a: 1, b: 2 } }),
      item('large', 'object', { value: { a: 1, b: 2, c: 3, d: 4 } }),
    ];
    const { main } = composeSections(items, undefined);
    expect(main[0].rows).toEqual([
      { type: 'grid', explicit: false, items: [{ slotName: 'small', span: 1 }] },
      { type: 'single', slotName: 'large' },
    ]);
  });

  it('a block that failed to resolve/validate always gets a full-width single row, never joins a grid', () => {
    const items = [item('a', 'text'), item('broken', 'text', { forceFullWidth: true }), item('b', 'text')];
    const { main } = composeSections(items, undefined);
    // "a" and "b" are each still heuristically grid-eligible on their own (a lone eligible item
    // still forms its own 1-item grid row, same as every other test in this suite) — the property
    // under test is that "broken" itself never joins either of their rows despite being adjacent.
    expect(main[0].rows).toEqual([
      { type: 'grid', explicit: false, items: [{ slotName: 'a', span: 1 }] },
      { type: 'single', slotName: 'broken' },
      { type: 'grid', explicit: false, items: [{ slotName: 'b', span: 1 }] },
    ]);
  });
});

describe('composeSections — declarative sections (no region declared: falls back to the legacy name-based guess)', () => {
  it('groups blocks into their declared sections, in declared order, and both land in "main" (neither name is a legacy rail id)', () => {
    const items = [
      item('a', 'text', { section: 'summary-like' }),
      item('b', 'text', { section: 'detail' }),
      item('c', 'text', { section: 'summary-like' }),
    ];
    const { main, rail } = composeSections(items, [
      { id: 'summary-like', title: 'Summary-like' },
      { id: 'detail', title: 'Detail' },
    ]);
    expect(rail).toEqual([]);
    expect(main.map((s) => s.id)).toEqual(['summary-like', 'detail']);
    expect(main[0].title).toBe('Summary-like');
    // block order within a section follows the manifest's own array order (a, then c) — sections
    // group, they don't reorder.
    expect(main[0].rows.flatMap((r) => (r.type === 'grid' || r.type === 'flow' ? r.items.map((i) => i.slotName) : [r.slotName]))).toEqual(['a', 'c']);
  });

  it('legacy name-based fallback still routes "guardrails"/"summary" (undeclared region) to rail, everything else to main', () => {
    const items = [
      item('g', 'text', { section: 'guardrails' }),
      item('s', 'text', { section: 'summary' }),
      item('d', 'text', { section: 'details' }),
    ];
    const { main, rail } = composeSections(items, [
      { id: 'guardrails', title: 'Guardrails' },
      { id: 'summary', title: 'Summary' },
      { id: 'details', title: 'Details' },
    ]);
    expect(rail.map((s) => s.id)).toEqual(['guardrails', 'summary']);
    expect(main.map((s) => s.id)).toEqual(['details']);
  });

  it('puts every unsectioned block into one trailing implicit main-region section, after all declared main sections', () => {
    const items = [item('a', 'text', { section: 'details' }), item('b', 'text')];
    const { main } = composeSections(items, [{ id: 'details', title: 'Details' }]);
    expect(main).toHaveLength(2);
    expect(main[0].id).toBe('details');
    expect(main[1].id).toBeNull();
  });

  it('drops an empty declared section entirely (every block moved elsewhere, or none ever used it)', () => {
    const items = [item('a', 'text', { section: 'details' })];
    const { main } = composeSections(items, [
      { id: 'details', title: 'Details' },
      { id: 'unused', title: 'Never referenced' },
    ]);
    expect(main.map((s) => s.id)).toEqual(['details']);
  });

  it('treats a block whose section id does not match any declared section as unsectioned (main, by default)', () => {
    const items = [item('a', 'text', { section: 'nonexistent-section' })];
    const { main, rail } = composeSections(items, [{ id: 'summary', title: 'Summary' }]);
    expect(rail).toEqual([]);
    expect(main).toHaveLength(1);
    expect(main[0].id).toBeNull();
  });
});

describe('composeSections — declarative region (FORENSIC_AUDIT_S9.1.md fix: "scalar/text" ≠ "rail")', () => {
  it('a section that declares region:"rail" places its blocks in `rail`, even if its id is not a legacy rail name', () => {
    const items = [item('a', 'text', { section: 'recommendation' })];
    const { main, rail } = composeSections(items, [{ id: 'recommendation', title: null, region: 'rail' }]);
    expect(main).toEqual([]);
    expect(rail.map((s) => s.id)).toEqual(['recommendation']);
  });

  it('a section named "summary" that explicitly declares region:"main" overrides the legacy name-based rail guess', () => {
    const items = [item('a', 'text', { section: 'summary' })];
    const { main, rail } = composeSections(items, [{ id: 'summary', title: 'Summary', region: 'main' }]);
    expect(rail).toEqual([]);
    expect(main.map((s) => s.id)).toEqual(['summary']);
  });

  it('a block-level `region` override wins over its own section\'s declared region', () => {
    const items = [
      item('heroTitle', 'text', { section: 'summary', region: 'main' }),
      item('other', 'text', { section: 'summary' }),
    ];
    const { main, rail } = composeSections(items, [{ id: 'summary', title: 'Summary', region: 'rail' }]);
    // "summary" section itself is declared rail — but heroTitle overrides to main individually,
    // so it's pulled into main's own "summary" bucket while "other" stays in rail's "summary" bucket.
    expect(main.map((s) => s.id)).toEqual(['summary']);
    expect(main[0].rows.flatMap((r) => (r.type === 'grid' || r.type === 'flow' ? r.items.map((i) => i.slotName) : [r.slotName]))).toEqual(['heroTitle']);
    expect(rail.map((s) => s.id)).toEqual(['summary']);
    expect(rail[0].rows.flatMap((r) => (r.type === 'grid' || r.type === 'flow' ? r.items.map((i) => i.slotName) : [r.slotName]))).toEqual(['other']);
  });

  it('an unsectioned block always defaults to main, regardless of any section-level regions declared elsewhere', () => {
    const items = [item('a', 'text', { section: 'guardrails' }), item('loose', 'text')];
    const { main, rail } = composeSections(items, [{ id: 'guardrails', title: 'Guardrails', region: 'rail' }]);
    expect(rail.map((s) => s.id)).toEqual(['guardrails']);
    expect(main.map((s) => s.id)).toEqual([null]);
  });
});

describe('composeSections — declarative layout (explicit group/span) composes a panel regardless of blockType', () => {
  it('merges adjacent blocks sharing an explicit layout.group, even if their blockType would not be heuristically eligible', () => {
    const items = [item('a', 'table', { layout: { group: 'hero' } }), item('b', 'itemQueue', { layout: { group: 'hero' } })];
    const { main } = composeSections(items, undefined);
    expect(main[0].rows).toEqual([{ type: 'grid', explicit: true, items: [{ slotName: 'a', span: 12 }, { slotName: 'b', span: 12 }] }]);
  });

  it('does NOT merge two adjacent blocks with different explicit group keys', () => {
    const items = [item('a', 'text', { layout: { group: 'g1' } }), item('b', 'text', { layout: { group: 'g2' } })];
    const { main } = composeSections(items, undefined);
    expect(main[0].rows).toEqual([
      { type: 'grid', explicit: true, items: [{ slotName: 'a', span: 12 }] },
      { type: 'grid', explicit: true, items: [{ slotName: 'b', span: 12 }] },
    ]);
  });

  it('an explicit group does NOT merge with an adjacent heuristically-eligible scalar with no explicit group', () => {
    const items = [item('a', 'text', { layout: { group: 'g1' } }), item('b', 'text')];
    const { main } = composeSections(items, undefined);
    expect(main[0].rows).toEqual([
      { type: 'grid', explicit: true, items: [{ slotName: 'a', span: 12 }] },
      { type: 'grid', explicit: false, items: [{ slotName: 'b', span: 1 }] },
    ]);
  });

  it('an explicit group member with no declared span defaults to a full-width 12 (not the heuristic\'s span:1)', () => {
    const items = [item('a', 'text', { layout: { group: 'g' } }), item('b', 'barChart', { layout: { group: 'g' } })];
    const { main } = composeSections(items, undefined);
    expect(main[0].rows[0].items).toEqual([{ slotName: 'a', span: 12 }, { slotName: 'b', span: 12 }]);
  });

  it('fuses two blocks sharing an explicit layout.group even when NOT adjacent in the input (DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §7/§11: a control and its dependents are almost never already adjacent in raw fixture-key order)', () => {
    const items = [
      item('tol', 'slider', { layout: { group: 'control:tol' } }),
      item('unrelated', 'text'),
      item('slate', 'table', { layout: { group: 'control:tol' } }),
    ];
    const { main } = composeSections(items, undefined);
    // The fused group takes the position of its first member; the unrelated item is displaced
    // after it, keeping its own relative order intact (never dropped, never duplicated).
    expect(main[0].rows).toEqual([
      { type: 'grid', explicit: true, items: [{ slotName: 'tol', span: 12 }, { slotName: 'slate', span: 12 }] },
      { type: 'grid', explicit: false, items: [{ slotName: 'unrelated', span: 1 }] },
    ]);
  });

  it('non-adjacent grouping never disturbs the relative order of items with NO explicit group at all', () => {
    const items = [
      item('a', 'text'),
      item('tol', 'slider', { layout: { group: 'g' } }),
      item('b', 'text'),
      item('slate', 'table', { layout: { group: 'g' } }),
      item('c', 'text'),
    ];
    const { main } = composeSections(items, undefined);
    // a, b, c stay in their own original relative order (all still heuristically grid-eligible
    // singletons except slate/tol which are explicit) — only tol/slate move to sit together.
    const order = main[0].rows.flatMap((r) => (r.type === 'grid' ? r.items.map((i) => i.slotName) : [r.slotName]));
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
    expect(order.indexOf('tol') + 1).toBe(order.indexOf('slate'));
  });

  it('respects explicit span values of 12, 6, and 4 (a 12-column grid)', () => {
    const items = [
      item('a', 'table', { layout: { group: 'g', span: 12 } }),
      item('b', 'table', { layout: { group: 'g', span: 6 } }),
      item('c', 'table', { layout: { group: 'g', span: 4 } }),
    ];
    const { main } = composeSections(items, undefined);
    expect(main[0].rows[0].items).toEqual([
      { slotName: 'a', span: 12 },
      { slotName: 'b', span: 6 },
      { slotName: 'c', span: 4 },
    ]);
  });

  it('composes a real S9.1-Decide-shaped recommendation group: a hero text + a chart + a labelValueList, one panel, full-width', () => {
    const items = [
      item('heroTitle', 'text', { section: 'recommendation', layout: { group: 'recommendation', span: 12 } }),
      item('heroSub', 'text', { section: 'recommendation', layout: { group: 'recommendation', span: 12 } }),
      item('heroMetrics', 'barChart', { section: 'recommendation', layout: { group: 'recommendation', span: 12 } }),
      item('moveBar', 'labelValueList', { section: 'recommendation', layout: { group: 'recommendation', span: 12 } }),
    ];
    const { main } = composeSections(items, [{ id: 'recommendation', title: null, region: 'main' }]);
    expect(main).toHaveLength(1);
    expect(main[0].rows).toEqual([
      {
        type: 'grid',
        explicit: true,
        items: [
          { slotName: 'heroTitle', span: 12 },
          { slotName: 'heroSub', span: 12 },
          { slotName: 'heroMetrics', span: 12 },
          { slotName: 'moveBar', span: 12 },
        ],
      },
    ]);
  });
});

describe('composeSections — malformed/unknown layout, section, and region metadata degrades gracefully', () => {
  it('ignores a non-array `sections` value entirely (falls back to unsectioned/main)', () => {
    const items = [item('a', 'text')];
    expect(() => composeSections(items, 'not-an-array')).not.toThrow();
    expect(() => composeSections(items, {})).not.toThrow();
    expect(() => composeSections(items, null)).not.toThrow();
    const { main, rail } = composeSections(items, 'not-an-array');
    expect(rail).toEqual([]);
    expect(main).toHaveLength(1);
    expect(main[0].id).toBeNull();
  });

  it('ignores a section declaration missing a valid string id', () => {
    const items = [item('a', 'text', { section: 'x' })];
    const { main } = composeSections(items, [{ title: 'No id' }, { id: '', title: 'Empty id' }, { id: 42, title: 'Numeric id' }]);
    expect(main).toHaveLength(1);
    expect(main[0].id).toBeNull(); // "x" section never validly declared, so item stays unsectioned
  });

  it('ignores an invalid block-level `region` value (falls back to section/legacy resolution)', () => {
    const items = [item('a', 'text', { region: 'sidebar' })];
    expect(() => composeSections(items, undefined)).not.toThrow();
    const { main, rail } = composeSections(items, undefined);
    expect(rail).toEqual([]);
    expect(main).toHaveLength(1);
  });

  it('ignores an invalid section-level `region` value (falls back to the legacy name-based guess)', () => {
    const items = [item('a', 'text', { section: 'summary' })];
    const { main, rail } = composeSections(items, [{ id: 'summary', title: 'Summary', region: 'sidebar' }]);
    expect(rail.map((s) => s.id)).toEqual(['summary']); // "summary" still legacy-inferred as rail
    expect(main).toEqual([]);
  });

  it('ignores a non-string/empty layout.group (falls back to the heuristic or single-row)', () => {
    const items = [item('a', 'text', { layout: { group: 123 } }), item('b', 'text', { layout: { group: '' } })];
    expect(() => composeSections(items, undefined)).not.toThrow();
    const { main } = composeSections(items, undefined);
    // Both fall back to the heuristic (text is grid-eligible) and merge with each other normally.
    expect(main[0].rows).toEqual([{ type: 'grid', explicit: false, items: [{ slotName: 'a', span: 1 }, { slotName: 'b', span: 1 }] }]);
  });

  it('clamps an out-of-range or non-numeric span instead of crashing or producing an invalid layout', () => {
    const items = [
      item('a', 'table', { layout: { group: 'g', span: 999 } }),
      item('b', 'table', { layout: { group: 'g', span: -5 } }),
      item('c', 'table', { layout: { group: 'g', span: 'two' } }),
    ];
    expect(() => composeSections(items, undefined)).not.toThrow();
    const { main } = composeSections(items, undefined);
    expect(main[0].rows[0].items).toEqual([
      { slotName: 'a', span: 12 }, // clamped to the new MAX_SPAN
      { slotName: 'b', span: 1 }, // clamped to MIN_SPAN
      { slotName: 'c', span: 12 }, // unparseable -> the explicit-group default (full width), not the old span:1
    ]);
  });

  it('never throws on a block with no layout/section/region fields at all (undefined)', () => {
    const items = [{ slotName: 'a', blockType: 'text' }];
    expect(() => composeSections(items, undefined)).not.toThrow();
  });
});

describe('composeSections — order is always authoritative from manifest.blocks[] order', () => {
  it('never reorders blocks within a section or the unsectioned bucket', () => {
    const items = [item('z', 'text'), item('a', 'text'), item('m', 'text')];
    const { main } = composeSections(items, undefined);
    const order = main[0].rows[0].items.map((i) => i.slotName);
    expect(order).toEqual(['z', 'a', 'm']);
  });
});

describe('composeSections — flow packing from DECLARED spans (main-region only)', () => {
  // REWRITTEN IN PHASE 5C. These cases used to exercise `blockSizing.js`'s inferSpan: a table's
  // width came from counting its columns, and the packer greedily bin-packed four widths
  // (12/8/6/4) into a 12-column row — so "two compact tables pack" and "8 + 4 pack" and
  // "4 + 4 + 4 pack" were all statements about a measurement. Ruling R58 deleted that module: a
  // width is now DECLARED on the slot (templates/slotVocabulary.js) and there are two of them.
  //
  // So the cases change shape. A slot pairs because its VOCABULARY ENTRY says `span: 'half'` and
  // its neighbour's does too — never because of what its data happens to look like. The tests below
  // use real vocabulary slots for that reason: a fabricated slot name has no declaration, which is
  // itself the correct outcome (undeclared means full width).

  it('two slots DECLARING half pack into one flow row', () => {
    // `policy` and `constraints` both declare `span: 'half'` — 5 and 10 reference screens
    // respectively pair them in a `grid-template-columns:1fr 1fr` row.
    const items = [
      item('policy', 'table', { value: [{ a: 1, b: 2 }] }),
      item('constraints', 'labelValueList', { value: [{ label: 'x' }] }),
    ];
    const { main } = composeSections(items, undefined);
    expect(main[0].rows).toEqual([
      { type: 'flow', items: [{ slotName: 'policy', span: 6 }, { slotName: 'constraints', span: 6 }] },
    ]);
  });

  it('a half whose neighbour is full does not pair — both take their own full-width row', () => {
    // `trigger` declares nothing, so it is full. This is the unpaired-half rule: the half widens
    // rather than rendering as a narrow cell with empty space beside it.
    const items = [
      item('policy', 'table', { value: [{ a: 1, b: 2 }] }),
      item('trigger', 'timeline', { value: [{ what: 'x' }] }),
    ];
    const { main } = composeSections(items, undefined);
    expect(main[0].rows).toEqual([
      { type: 'single', slotName: 'policy' },
      { type: 'single', slotName: 'trigger' },
    ]);
  });

  it('three consecutive halves pair the first two and widen the third', () => {
    const items = [
      item('policy', 'table', { value: [{ a: 1 }] }),
      item('constraints', 'labelValueList', { value: [{ label: 'x' }] }),
      item('roles', 'table', { value: [{ name: 'r' }] }),
    ];
    const { main } = composeSections(items, undefined);
    expect(main[0].rows).toEqual([
      { type: 'flow', items: [{ slotName: 'policy', span: 6 }, { slotName: 'constraints', span: 6 }] },
      { type: 'single', slotName: 'roles' },
    ]);
  });

  it('a slot with no declared span is full width, whatever its data looks like', () => {
    // The inference this phase removed would have sized both of these from their column counts and
    // packed them. `detail_rows` declares no span (ruling R59 held it out: one file of reference
    // evidence against 25 objects), so a two-column table and a six-column table are now treated
    // identically — which is the point.
    const narrow = [{ a: 1, b: 2 }];
    const wide = [{ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }];
    const { main } = composeSections(
      [item('detail_rows', 'table', { value: narrow }), item('ledger', 'table', { value: wide })],
      undefined,
    );
    expect(main[0].rows).toEqual([
      { type: 'single', slotName: 'detail_rows' },
      { type: 'single', slotName: 'ledger' },
    ]);
  });

  it('two undeclared tables never pack together — each stays its own full-width single row', () => {
    const wideRow = [{ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }];
    const items = [item('t1', 'table', { value: wideRow }), item('t2', 'table', { value: wideRow })];
    const { main } = composeSections(items, undefined);
    expect(main[0].rows).toEqual([
      { type: 'single', slotName: 't1' },
      { type: 'single', slotName: 't2' },
    ]);
  });

  it('a lone flowable item renders as a full-width single row, never a 1-item flow row', () => {
    const items = [item('policy', 'table', { value: [{ a: 1, b: 2 }] })]; // declares half, but alone
    const { main } = composeSections(items, undefined);
    expect(main[0].rows).toEqual([{ type: 'single', slotName: 'policy' }]);
  });

  it('flow packing never applies inside the RAIL region — rail keeps its existing single-shared-panel composition', () => {
    const items = [
      item('policy', 'table', { value: [{ x: 1, y: 2 }], section: 'guardrails', region: 'rail' }),
      item('constraints', 'labelValueList', { value: [{ label: 'x' }], section: 'guardrails', region: 'rail' }),
    ];
    const { rail } = composeSections(items, [{ id: 'guardrails', title: 'Guardrails', region: 'rail' }]);
    // Both land as independent `single` rows inside the one shared rail panel — never a `flow` row.
    expect(rail[0].rows.every((r) => r.type === 'single')).toBe(true);
  });

  it('an explicit layout.group still takes priority over flow packing (an authored group never gets swept into a flow row)', () => {
    const items = [
      item('a', 'table', { value: [{ x: 1, y: 2 }], layout: { group: 'g', span: 6 } }),
      item('b', 'table', { value: [{ x: 1, y: 2 }], layout: { group: 'g', span: 6 } }),
    ];
    const { main } = composeSections(items, undefined);
    expect(main[0].rows).toEqual([{ type: 'grid', explicit: true, items: [{ slotName: 'a', span: 6 }, { slotName: 'b', span: 6 }] }]);
  });

  it('a run of flowable items adjacent to a heuristic scalar run does not mix the two mechanisms', () => {
    const items = [
      item('scalar1', 'text'),
      item('scalar2', 'number'),
      item('policy', 'table', { value: [{ a: 1, b: 2 }] }),
      item('constraints', 'labelValueList', { value: [{ label: 'x' }] }),
    ];
    const { main } = composeSections(items, undefined);
    expect(main[0].rows).toEqual([
      { type: 'grid', explicit: false, items: [{ slotName: 'scalar1', span: 1 }, { slotName: 'scalar2', span: 1 }] },
      { type: 'flow', items: [{ slotName: 'policy', span: 6 }, { slotName: 'constraints', span: 6 }] },
    ]);
  });
});
