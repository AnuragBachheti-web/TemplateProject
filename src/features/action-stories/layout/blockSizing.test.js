import { describe, it, expect } from 'vitest';
import { inferSpan } from './blockSizing';

describe('inferSpan — table', () => {
  it('a 2-3 meaningful-column table gets half width', () => {
    const rows = [{ name: 'a', count: 1 }, { name: 'b', count: 2 }];
    expect(inferSpan('table', rows)).toBe(6);
  });

  it('a 4-5 meaningful-column table gets a wide (but not full) span', () => {
    const rows = [{ a: 1, b: 2, c: 3, d: 4 }];
    expect(inferSpan('table', rows)).toBe(8);
  });

  it('a 6+ meaningful-column table gets full width (an operational table)', () => {
    const rows = [{ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }];
    expect(inferSpan('table', rows)).toBe(12);
  });

  it('decorative columns (hue/tint/...) never count toward the column threshold', () => {
    const rows = [{ name: 'a', count: 1, hue: 'var(--x)', tint: 'var(--y)', dotBg: 'var(--z)' }];
    // Only 2 meaningful columns (name, count) once hue/tint/dotBg are excluded — still half width.
    expect(inferSpan('table', rows)).toBe(6);
  });

  it('an empty/malformed table falls back to full width safely', () => {
    expect(inferSpan('table', [])).toBe(12);
    expect(inferSpan('table', null)).toBe(12);
  });
});

describe('inferSpan — itemQueue', () => {
  it('a short list (<=6 items) of small items gets half width (option-picker shaped)', () => {
    const items = [{ name: 'Conservative', flag: 'Lowest risk' }, { name: 'Balanced', flag: 'Recommended' }];
    expect(inferSpan('itemQueue', items)).toBe(6);
  });

  it('6 compact items (confirmed real shape: S9.9/analyze.candidates) still gets half width, not forced full', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ name: `Item ${i}`, recovery: '$1.2K' }));
    expect(inferSpan('itemQueue', items)).toBe(6);
  });

  it('more than 6 items gets full width regardless of individual size', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ name: `Item ${i}` }));
    expect(inferSpan('itemQueue', items)).toBe(12);
  });

  it('a short list of RICH items (long narrative per item) gets full width', () => {
    const items = [
      { name: 'Markdown & recovery', meta: 'A'.repeat(100) },
      { name: 'Planner', meta: 'B'.repeat(100) },
    ];
    expect(inferSpan('itemQueue', items)).toBe(12);
  });
});

describe('inferSpan — labelValueList', () => {
  it('a very short list (<=3) of compact values gets a third-width span', () => {
    const rows = [{ label: 'A', value: '1' }, { label: 'B', value: '2' }];
    expect(inferSpan('labelValueList', rows)).toBe(4);
  });

  it('a moderate list (4-6) of compact values gets half width', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ label: `L${i}`, value: `${i}` }));
    expect(inferSpan('labelValueList', rows)).toBe(6);
  });

  it('a list carrying real prose in a secondary field gets full width regardless of count', () => {
    const rows = [{ label: 'GMROI target', value: '2.4', why: 'A'.repeat(100) }];
    expect(inferSpan('labelValueList', rows)).toBe(12);
  });

  it('more than 6 items gets full width', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ label: `L${i}`, value: `${i}` }));
    expect(inferSpan('labelValueList', rows)).toBe(12);
  });
});

describe('inferSpan — charts', () => {
  it('a small chart (<=12 points/bars) gets half width — compact enough to share a row', () => {
    expect(inferSpan('barChart', [1, 2, 3, 4])).toBe(6);
  });

  it('a rich chart (>12 points) gets full width — this stage\'s own featured analysis', () => {
    const points = Array.from({ length: 50 }, (_, i) => ({ x: i, y: i }));
    expect(inferSpan('scatterChart', points)).toBe(12);
  });

  it('every chart type uses the same density rule', () => {
    const small = [1, 2, 3];
    const large = Array.from({ length: 20 }, (_, i) => i);
    for (const type of ['barChart', 'lineChart', 'scatterChart', 'waterfallChart', 'heatmapGrid']) {
      expect(inferSpan(type, small)).toBe(6);
      expect(inferSpan(type, large)).toBe(12);
    }
  });
});

describe('inferSpan — object and unknown types', () => {
  it('a small-ish object (a rich descriptor, never scalar-eligible) gets a medium half-width span', () => {
    expect(inferSpan('object', { a: 1, b: 2, c: 3, d: 4, e: 5 })).toBe(6);
  });

  it('a large, prose-heavy object (e.g. a "selected record" detail panel) gets full width', () => {
    const rich = Object.fromEntries(
      Array.from({ length: 15 }, (_, i) => [`field${i}`, `A prose-ish value for field ${i}`]),
    );
    expect(inferSpan('object', rich)).toBe(12);
  });

  it('a compact object with many short fields still gets full width once it exceeds 12 keys', () => {
    const wide = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i]));
    expect(inferSpan('object', wide)).toBe(12);
  });

  it('an unrecognized/slider blockType stays full width — the always-safe default', () => {
    expect(inferSpan('slider', { min: 0, max: 10, value: 5 })).toBe(12);
    expect(inferSpan('somethingNew', {})).toBe(12);
  });
});
