import { describe, it, expect } from 'vitest';
import { flattenNestedEntry } from './nestedEntryText';

describe('flattenNestedEntry — primitives (unchanged behavior)', () => {
  it('renders a plain string/number/boolean', () => {
    expect(flattenNestedEntry('hello')).toBe('hello');
    expect(flattenNestedEntry(42)).toBe('42');
    expect(flattenNestedEntry(true)).toBe('Yes');
  });

  it('renders null/undefined as empty (invisible, not broken)', () => {
    expect(flattenNestedEntry(null)).toBe('');
    expect(flattenNestedEntry(undefined)).toBe('');
  });

  it('renders a captured JSX/DOM-node descriptor via its inner text', () => {
    const node = { type: 'span', props: { children: 'inner text' } };
    expect(flattenNestedEntry(node)).toBe('inner text');
  });
});

describe('flattenNestedEntry — known shapes (unchanged behavior)', () => {
  it('renders a diff row as "field: before → after"', () => {
    expect(flattenNestedEntry({ field: 'Price', before: '$10', after: '$12' })).toBe('Price: $10 → $12');
  });

  it('renders a {label, value} row as "label value"', () => {
    expect(flattenNestedEntry({ label: 'Confidence', value: '88%' })).toBe('Confidence 88%');
  });

  it('renders a {label} row with no value as just the label', () => {
    expect(flattenNestedEntry({ label: 'Reviewed' })).toBe('Reviewed');
  });
});

describe('flattenNestedEntry — nested array (regression: previously flattened to \'\')', () => {
  it('summarizes an array of {label, value} rows, joined', () => {
    const arr = [{ label: 'A', value: 1 }, { label: 'B', value: 2 }];
    expect(flattenNestedEntry(arr)).toBe('A 1, B 2');
  });

  it('summarizes an array of plain strings/numbers', () => {
    expect(flattenNestedEntry(['a', 'b', 'c'])).toBe('a, b, c');
  });

  it('drops empty entries but keeps the rest', () => {
    expect(flattenNestedEntry(['a', null, '', 'b'])).toBe('a, b');
  });
});

describe('flattenNestedEntry — nested plain object (regression: previously always flattened to \'\')', () => {
  it('summarizes a nested object as "key: value, key: value"', () => {
    const obj = { before: '$10', after: '$12' };
    expect(flattenNestedEntry(obj)).toBe('Before: $10, After: $12');
  });

  it('recurses into a magnitude-only object with no label (e.g. a sparkline point)', () => {
    // S10.3/analyze.gauges' own `spark: [{h, fill}]` shape — no label, just a magnitude plus a
    // decorative fill; this must show the magnitude, not drop the whole point.
    expect(flattenNestedEntry({ h: '12', fill: 'var(--amber-500)' })).toBe('12');
  });
});

describe('flattenNestedEntry — nested object inside an array (regression: S9.6/decide.focus-style before/after)', () => {
  it('recovers a nested object embedded inside each array item', () => {
    const rows = [
      { name: 'Title rewrite', before: { text: 'Old title', chars: 48 }, after: { text: 'New title', chars: 96 } },
    ];
    const text = flattenNestedEntry(rows);
    expect(text).toContain('Title rewrite');
    expect(text).toContain('Old title');
    expect(text).toContain('New title');
  });
});

describe('flattenNestedEntry — array inside an object (regression: S9.17/execute.brief-style sections/ladder)', () => {
  it('recovers a nested array embedded inside an object field', () => {
    const brief = {
      title: 'Counter Kessler',
      sections: [{ label: 'Ask', value: '+3.0%' }, { label: 'Should-cost', value: '+2.9%' }],
    };
    const text = flattenNestedEntry(brief);
    expect(text).toContain('Counter Kessler');
    expect(text).toContain('Ask');
    expect(text).toContain('+3.0%');
  });
});

describe('flattenNestedEntry — deeply nested data', () => {
  it('recovers content nested several levels deep', () => {
    const deep = { a: { b: { c: { label: 'Deep value', value: 42 } } } };
    const text = flattenNestedEntry(deep);
    expect(text).toContain('Deep value');
    expect(text).toContain('42');
  });

  it('degrades to an ellipsis instead of hanging on a pathologically deep structure', () => {
    let node = { label: 'leaf' };
    for (let i = 0; i < 20; i++) node = { wrap: node };
    expect(() => flattenNestedEntry(node)).not.toThrow();
    expect(typeof flattenNestedEntry(node)).toBe('string');
  });

  it('terminates on a self-referential (circular) structure instead of infinite-looping', () => {
    const node = { label: 'cyclical' };
    node.self = node;
    expect(() => flattenNestedEntry(node)).not.toThrow();
  });
});

describe('flattenNestedEntry — null values within a structure', () => {
  it('skips null/undefined fields inside a nested object rather than rendering "null"', () => {
    const obj = { keep: 'yes', drop: null, alsoDrop: undefined };
    const text = flattenNestedEntry(obj);
    expect(text).toContain('yes');
    expect(text).not.toContain('null');
    expect(text).not.toContain('undefined');
  });

  it('renders an entirely-empty nested object as empty text, not a broken row', () => {
    expect(flattenNestedEntry({})).toBe('');
    expect(flattenNestedEntry({ tone: 'var(--rose-500)' })).toBe('');
  });
});

describe('flattenNestedEntry — malformed / unexpected structures', () => {
  it('never throws on a mixed-type array', () => {
    expect(() => flattenNestedEntry([1, 'two', { label: 'three' }, null, [4, 5]])).not.toThrow();
  });

  it('renders a readable fallback for an array of arrays', () => {
    const text = flattenNestedEntry([[1, 2], [3, 4]]);
    expect(text).toContain('1');
    expect(text).toContain('4');
  });

  it('never throws on a Date, RegExp, or function-valued field', () => {
    expect(() => flattenNestedEntry({ when: new Date('2024-01-01'), re: /x/, fn: () => {} })).not.toThrow();
  });
});
