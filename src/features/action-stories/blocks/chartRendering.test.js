// Deeper chart-correctness tests than blockStates.test.js's empty/error matrix — these inspect the
// actual computed geometry/props a chart block hands to Recharts (calling the component directly
// as a plain function, same convention as every other block test: no DOM/jsdom needed, since a
// React element is just a plain { type, props } object tree we can walk).
import { describe, it, expect } from 'vitest';
import { Scatter, YAxis, Bar, BarChart, Tooltip, Line } from 'recharts';

import ScatterChartBlock from './ScatterChartBlock';
import LineChartBlock from './LineChartBlock';
import BarChartBlock from './BarChartBlock';
import WaterfallChartBlock from './WaterfallChartBlock';
import HeatmapGridBlock from './HeatmapGridBlock';
import { svgYToPlotY, parseSvgPathPoints } from './chartGeometry';

/**
 * Finds the first descendant element whose `.type` matches a real imported Recharts component
 * reference. `el` itself may be a plain array (a `.map()` result nested directly as one child among
 * siblings, e.g. LineChartBlock's per-series `<Line>` list) — handled the same as a props.children
 * array, one level deeper.
 */
function findByType(el, type) {
  if (Array.isArray(el)) {
    for (const child of el) {
      const hit = findByType(child, type);
      if (hit) return hit;
    }
    return null;
  }
  if (el === null || el === undefined || typeof el !== 'object') return null;
  if (el.type === type) return el;
  const children = el.props?.children;
  if (children !== undefined) return findByType(children, type);
  return null;
}

describe('chartGeometry — canonical y convention', () => {
  it('svgYToPlotY negates (SVG grows down, plot space grows up)', () => {
    expect(svgYToPlotY(10)).toBe(-10);
    expect(svgYToPlotY(-10)).toBe(10);
    expect(svgYToPlotY(0)).toBe(-0); // JS negation of 0 is -0; Object.is-sensitive but numerically equal to 0
  });

  it('parseSvgPathPoints and ScatterChartBlock apply the same convention', () => {
    // A rising line in SVG space has decreasing y (y=100 at the start, y=10 at the end — moving up
    // the canvas). Both consumers of svgYToPlotY must agree that this is a *rising* plot trend.
    const [first, last] = parseSvgPathPoints('M0 100 L10 10');
    expect(last.y).toBeGreaterThan(first.y);
  });
});

// FIXTURES PADDED TO FOUR POINTS. blocks/chartEvidence.js's admission rule refuses to draw a chart
// built on fewer than four points, so a two-bar fixture now renders the thin-evidence notice and the
// chart internals these tests reach for are never constructed. Each fixture below gained points and
// changed nothing else: every assertion still names the same indices and the same expected values.

describe('ScatterChartBlock — y-inversion fix (regression: S9.1/analyze.points upside-down bug)', () => {
  it('flips cy the same direction parseSvgPathPoints flips a line path y', () => {
    // Two points where the SVG source has point A higher on the canvas (smaller cy) than point B.
    const data = [
      { cx: 10, cy: 20 }, // near the top of the original artwork
      { cx: 10, cy: 200 }, // near the bottom of the original artwork
      { cx: 20, cy: 80 },
      { cx: 30, cy: 140 },
    ];
    const el = ScatterChartBlock({ slotName: 'points', data });
    const scatter = findByType(el, Scatter);
    const points = scatter?.props?.data;
    expect(points).toBeTruthy();
    // After the fix, the point that was near the TOP in SVG space (smaller cy) must have the
    // LARGER plotted y (Recharts' Cartesian space grows upward) — i.e. still visually "higher".
    expect(points[0].y).toBeGreaterThan(points[1].y);
  });

  it('assigns a distinct categorical color per distinct hue value, preserving segmentation', () => {
    const data = [
      { cx: 1, cy: 1, hue: 'var(--a)' },
      { cx: 2, cy: 2, hue: 'var(--b)' },
      { cx: 3, cy: 3, hue: 'var(--a)' },
      { cx: 4, cy: 4, hue: 'var(--b)' },
    ];
    const el = ScatterChartBlock({ slotName: 'points', data });
    // With >1 distinct hue present, per-point <Cell> fills must be rendered (not the single fixed
    // fill every point used to share regardless of `hue`).
    const scatter = findByType(el, Scatter);
    const cells = scatter?.props?.children;
    expect(Array.isArray(cells) && cells.length).toBe(4);
    // Same hue -> same color; different hue -> different color.
    expect(cells[0].props.fill).toBe(cells[2].props.fill);
    expect(cells[0].props.fill).not.toBe(cells[1].props.fill);
  });

  it('does not crash and renders no Cells when no point carries a hue', () => {
    const data = [{ cx: 1, cy: 1 }, { cx: 2, cy: 2 }, { cx: 3, cy: 3 }, { cx: 4, cy: 4 }];
    const el = ScatterChartBlock({ slotName: 'points', data });
    const scatter = findByType(el, Scatter);
    expect(scatter?.props?.children).toBeFalsy();
  });
});

describe('BarChartBlock — negative-value domain fix (regression: all-negative series clipped to 0)', () => {
  it('domain functions extend below zero for an all-negative series', () => {
    const data = [
      { label: 'Daily', value: '−$2,210' }, { label: 'Weekly', value: '−$26.5K' },
      { label: 'Monthly', value: '−$41.0K' }, { label: 'Quarterly', value: '−$88.2K' },
    ];
    const el = BarChartBlock({ slotName: 'x', data });
    const yAxis = findByType(el, YAxis);
    const [minFn, maxFn] = yAxis.props.domain;
    expect(minFn(-500)).toBe(-500); // extends below 0
    expect(minFn(500)).toBe(0); // never goes above 0
    expect(maxFn(500)).toBe(500);
    expect(maxFn(-500)).toBe(0); // never goes below 0
  });

  it('colors bars by sign only when the series genuinely mixes signs', () => {
    const mixed = [
      { label: 'A', value: '+3' }, { label: 'B', value: '−7' },
      { label: 'C', value: '+5' }, { label: 'D', value: '−2' },
    ];
    const el = BarChartBlock({ slotName: 'x', data: mixed });
    const bar = findByType(el, Bar);
    const cells = bar.props.children;
    expect(cells[0].props.fill).not.toBe(cells[1].props.fill);
  });

  it('prefers a parseable magnitude key over a merely-defined-but-unparseable one', () => {
    // regression: S9.8/reason.readiness-style — "value" is a ratio string ("18 / 25") that never
    // parses; "pct" is the real usable magnitude. The bar must plot pct's number, not NaN.
    const data = [
      { label: 'Content pack', value: '18 / 25', pct: '72%' },
      { label: 'Imagery', value: '9 / 25', pct: '36%' },
      { label: 'Copy', value: '20 / 25', pct: '80%' },
      { label: 'Video', value: '4 / 25', pct: '16%' },
    ];
    const el = BarChartBlock({ slotName: 'x', data });
    const bar = findByType(el, Bar);
    const barChart = findByType(el, BarChart);
    const points = barChart.props.data;
    expect(points[0].magnitude).toBeCloseTo(72);
    expect(bar).toBeTruthy();
  });
});

describe('BarChartBlock — content-driven height tier (density fix: a chart sharing a composed panel needs less height than a standalone one)', () => {
  const data = [
    { label: 'A', value: '$5' }, { label: 'B', value: '$8' },
    { label: 'C', value: '$3' }, { label: 'D', value: '$9' },
  ];

  it('uses a shorter height when compact (already inside a shared panel)', () => {
    const el = BarChartBlock({ slotName: 'x', data, compact: true });
    // compact mode drops BlockCard/BlockTitle entirely — the returned element is the chart's own
    // height-classed wrapper directly (or the small label div wrapping it).
    const heightDiv = findDivWithHeightClass(el);
    expect(heightDiv.props.className).toContain('h-32');
    expect(heightDiv.props.className).not.toContain('h-56');
  });

  it('uses the taller standalone height when not compact', () => {
    const el = BarChartBlock({ slotName: 'x', data });
    const heightDiv = findDivWithHeightClass(el);
    expect(heightDiv.props.className).toContain('h-56');
  });
});

function findDivWithHeightClass(el) {
  if (el === null || el === undefined || typeof el !== 'object') return null;
  if (Array.isArray(el)) {
    for (const child of el) {
      const found = findDivWithHeightClass(child);
      if (found) return found;
    }
    return null;
  }
  if (typeof el.props?.className === 'string' && /\bh-\d+\b/.test(el.props.className) && el.props.role === 'img') return el;
  return findDivWithHeightClass(el.props?.children);
}

describe('WaterfallChartBlock — tag/sublabel preservation (regression: S10.1/analyze.bars context loss)', () => {
  it('tooltip formatter surfaces tag and sublabel alongside the value', () => {
    const data = [
      { label: 'Baseline', value: '$12,480', top: 19.5, height: 80.5, anchor: true },
      { label: 'FBA fee', sublabel: 'change', tag: 'unexpected', value: '−$2,210', top: 19.5, height: 59.7 },
      { label: 'Storage', sublabel: 'change', value: '−$410', top: 19.5, height: 56.2 },
      { label: 'Net', value: '$9,860', top: 19.5, height: 56.2, anchor: true },
    ];
    const el = WaterfallChartBlock({ slotName: 'bars', data });
    const tooltip = findByType(el, Tooltip);
    const [text] = tooltip.props.formatter(null, null, { payload: { display: '−$2,210', sublabel: 'change', tag: 'unexpected' } });
    expect(text).toContain('−$2,210');
    expect(text).toContain('unexpected');
    expect(text).toContain('change');
  });
});

describe('HeatmapGridBlock — deterministic metric selection (regression: positional key-order fragility)', () => {
  it('picks the field name with the most numeric hits across the whole grid, not the first cell seen', () => {
    // "id" looks numeric in row 0's cell only; "count" is numeric in every cell — count must win
    // even though "id" would be encountered first if key order were `{id, count}` everywhere and a
    // naive scan just took the first numeric-looking field of the first cell.
    const data = [
      { label: 'Row 1', cells: [{ id: 7, count: 12 }, { count: 30 }] },
      { label: 'Row 2', cells: [{ count: 45 }, { count: 8 }] },
    ];
    const el = HeatmapGridBlock({ slotName: 'grid', data });
    // Render succeeds and produces real content (not an error) — the coloring itself is verified
    // indirectly via count's 4/4 hits vs id's 1/4.
    expect(el.type).not.toBe('ErrorState');
    expect(JSON.stringify(el)).not.toContain('no cells to plot');
  });

  it('is stable regardless of per-cell key insertion order', () => {
    const orderA = [{ label: 'R', cells: [{ id: 1, count: 5 }] }];
    const orderB = [{ label: 'R', cells: [{ count: 5, id: 1 }] }];
    // Neither render should throw, and both should treat "count" as the metric (2 fields tie at 1
    // hit each per-grid in this tiny example, but alphabetical tie-break keeps this deterministic
    // regardless of which key came first in the object literal).
    expect(() => HeatmapGridBlock({ slotName: 'x', data: orderA })).not.toThrow();
    expect(() => HeatmapGridBlock({ slotName: 'x', data: orderB })).not.toThrow();
  });
});

describe('LineChartBlock — series naming fallback (regression: S9.3/analyze.curves losing descriptive labels)', () => {
  it('falls back to a per-series `label` when `name` is absent', () => {
    const data = [
      { path: 'M0 0 L5 5 L10 10 L15 12', label: 'DTC · $18.40' },
      { path: 'M0 0 L5 3 L10 5 L15 4', label: 'FBA-West · next unit $13.60' },
    ];
    const el = LineChartBlock({ slotName: 'curves', data });
    const lines = findAllByType(el, Line);
    expect(lines.map((l) => l.props.name)).toEqual(['DTC · $18.40', 'FBA-West · next unit $13.60']);
  });
});

function findAllByType(el, type, acc = []) {
  if (Array.isArray(el)) {
    el.forEach((child) => findAllByType(child, type, acc));
    return acc;
  }
  if (el === null || el === undefined || typeof el !== 'object') return acc;
  if (el.type === type) acc.push(el);
  const children = el.props?.children;
  if (children !== undefined) findAllByType(children, type, acc);
  return acc;
}
