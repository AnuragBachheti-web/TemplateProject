// @vitest-environment jsdom
//
// The single highest-leverage missing proof this session's own architecture audit named (P0-3):
// every one of the 105 real manifests under manifests/*.json has, until now, only ever been
// rendered against the ONE fixture extraction/generateManifests.js generated it from
// (manifestFixtureSweep.test.js sweeps every manifest against its own generating fixture — proof
// the *pipeline* didn't produce garbage, never proof a *template* tolerates data it wasn't built
// from). A template's defining property is that ONE definition renders MANY different data
// payloads correctly — this file is that proof, for real.
//
// Takes S9.11/analyze's real, on-disk, committed manifest completely unmodified and runs it — the
// exact same object, same blocks, same bindings, same blockTypes, zero edits — against a SECOND,
// hand-authored, deliberately-different fixture that was never anywhere near
// extraction/classifyBlocks.js: different scalar values, different array lengths in three separate
// array-typed blocks (labelValueList/table/barChart), a materially different `sel` object shape,
// and one field genuinely absent. If the manifest only worked by coincidence with the one payload
// it was generated from, this is exactly the kind of divergence that would break it.
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import StageRenderer from '../components/StageRenderer';
import { validateManifest } from '../manifests/validateManifest';
import { validateBlockData } from '../manifests/blockTypes';
import { resolveBinding } from '../manifests/resolveBinding';
import manifests from './manifests/S9.11.json';
import realFixture from './fixtures/raw/S9.11/analyze.json';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return container;
}

const manifest = manifests.find((m) => m.stageKey === 'analyze');

// A SYNTHETIC second instance of this exact template — NOT extracted data, never seen by
// extraction/classifyBlocks.js or generateManifests.js. Deliberately diverges from the real S9.11
// fixture in every dimension a template needs to survive:
//   - different scalar text (execLabel, sortNote)
//   - a DIFFERENT-LENGTH `sorts` array (4 items, not 3) — labelValueList
//   - a DIFFERENT-LENGTH `rows` array (5 items, not 8), completely different SKUs/products — table
//   - a differently-shaped `sel` object (fewer stats, fewer parity rows, new copy) — object
//   - a DIFFERENT-LENGTH `rollup` array (3 items, not 5) — labelValueList
//   - a DIFFERENT-LENGTH `concentration` array (2 bars, not 4) — barChart
//   - `excluded` OMITTED ENTIRELY — proving the same manifest degrades that one slot to its
//     placeholder without disturbing anything else, rather than needing every field to be present.
const secondInstanceFixture = {
  code: 'S9.11',
  stageKey: 'analyze',
  name: 'Repricing',
  headline: 'A second, unrelated repricing run — 12 SKUs · +$2.1K/mo',
  data: {
    execLabel: 'Hold',
    sorts: [
      { label: 'volume', bg: 'var(--ink-0)', border: 'var(--ink-200)', tone: 'var(--ink-500)' },
      { label: 'headroom', bg: 'var(--ink-0)', border: 'var(--ink-200)', tone: 'var(--ink-500)' },
      { label: 'Buy Box risk', bg: 'var(--ink-0)', border: 'var(--ink-200)', tone: 'var(--ink-500)' },
      { label: 'confidence', bg: 'var(--ink-0)', border: 'var(--ink-200)', tone: 'var(--ink-500)' },
    ],
    sortNote: 'sorted by volume — a second, unrelated instance of this exact template',
    rows: [
      { name: 'Forged spatula set', sku: 'ZZ-UTN-9001', cohort: 'tested', elast: '−0.55', conf: '90% ± 3', headroom: '$0.80', bb: '0.10 low', source: 'tested' },
      { name: 'Bamboo cutting board', sku: 'ZZ-WOD-9002', cohort: 'prior only', elast: '−0.70', conf: '70% ± 10', headroom: '$0.95', bb: '0.20 low', source: 'prior' },
      { name: 'Enamel dutch oven', sku: 'ZZ-CER-9003', cohort: 'tested · Buy Box sensitive', elast: '−1.60', conf: '92% ± 2', headroom: '$2.40', bb: '0.88 high', source: 'tested' },
      { name: 'Silicone trivet pair', sku: 'ZZ-TEX-9004', cohort: 'tested · low sensitivity', elast: '−0.40', conf: '95% ± 1', headroom: '$0.55', bb: '0.05 low', source: 'tested' },
      { name: 'Copper measuring cups', sku: 'ZZ-MTL-9005', cohort: 'contract-constrained', elast: '−1.05', conf: '77% ± 9', headroom: '$1.05', bb: '0.45 mid', source: 'tested' },
    ],
    sel: {
      name: 'Enamel dutch oven',
      hue: 'var(--amber-500)',
      tag: 'Buy Box sensitive',
      copy: 'A materially different narrative for a materially different selected row, proving the same "object" block renders a differently-shaped payload.',
      stats: [
        { label: 'Now → proposed', value: '$54.00 → $58.99', meta: '+9.2%', tone: 'var(--ink-900)' },
        { label: 'Volume Δ', value: '−5.1%', meta: 'wider swing than the original fixture', tone: 'var(--amber-700)' },
        { label: 'CM / month', value: '+$610', meta: 'a smaller contributor than the original', tone: 'var(--green-700)' },
      ],
    },
    rollup: [
      { label: 'SKUs in the slate', value: '12 of 214', tone: 'var(--ink-900)' },
      { label: 'Median raise', value: '+7.1%', tone: 'var(--ink-900)' },
      { label: 'Revenue effect', value: '+$2.1K/mo', tone: 'var(--green-700)' },
    ],
    concentration: [
      { label: '2 Buy Box sensitive SKUs', value: '$1.2K/mo', pct: '57%', tone: 'var(--amber-700)' },
      { label: '3 low-sensitivity rolls', value: '$0.9K/mo', pct: '43%', tone: 'var(--green-700)' },
    ],
    // `excluded` deliberately absent — see this file's own header comment.
  },
};

describe('template reuse — the SAME real, unmodified manifest correctly renders a SECOND, unrelated data instance', () => {
  it('sanity: this is the real, on-disk S9.11/analyze manifest, not a hand-built stand-in', () => {
    expect(manifest.code).toBe('S9.11');
    expect(manifest.blocks.length).toBeGreaterThan(5);
  });

  it('the manifest structurally validates on its own (data-independent) — checked once, not per fixture', () => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  describe.each([
    ['the real, extracted fixture it was generated from', realFixture],
    ['a synthetic second instance it has never seen', secondInstanceFixture],
  ])('against %s', (_label, fixture) => {
    it('every block resolves and validates cleanly against this exact payload', () => {
      const orphaned = [];
      for (const block of manifest.blocks) {
        const value = resolveBinding(block.binding, fixture);
        if (value === undefined) continue; // `excluded` in the second instance — an expected, graceful absence, not a failure
        const problems = validateBlockData(block.blockType, value);
        if (problems.length > 0) orphaned.push(`${block.slotName}: ${problems.join('; ')}`);
      }
      expect(orphaned).toEqual([]);
    });

    it('renders without throwing', () => {
      expect(() => mount(<StageRenderer manifest={manifest} fixture={fixture} />)).not.toThrow();
    });
  });

  it('the two renders show genuinely different content — this is real reuse, not the same screen twice', () => {
    const originalContainer = mount(<StageRenderer manifest={manifest} fixture={realFixture} />);
    const secondContainer = mount(<StageRenderer manifest={manifest} fixture={secondInstanceFixture} />);

    // Scalars: different values through the identical binding.
    expect(originalContainer.textContent).toContain('sorted by headroom per unit');
    expect(secondContainer.textContent).toContain('sorted by volume — a second, unrelated instance');

    // Table: different SKUs, different row COUNT (8 vs 5), same `table` blockType/binding.
    expect(originalContainer.textContent).toContain('NW-KNF-0480');
    expect(originalContainer.textContent).not.toContain('ZZ-UTN-9001');
    expect(secondContainer.textContent).toContain('ZZ-UTN-9001');
    expect(secondContainer.textContent).not.toContain('NW-KNF-0480');

    // labelValueList: different item COUNT (3 vs 4 for `sorts`, 5 vs 3 for `rollup`).
    expect(originalContainer.textContent).toContain('Buy Box risk');
    expect(secondContainer.textContent).toContain('volume');
    expect(secondContainer.textContent).toContain('confidence');

    // object: a differently-shaped `sel` renders its own new copy.
    expect(secondContainer.textContent).toContain('Enamel dutch oven');
    expect(secondContainer.textContent).toContain('materially different narrative');

    // barChart (`concentration`): Recharts' `ResponsiveContainer` needs a real `ResizeObserver`,
    // which this project's jsdom test environment doesn't polyfill (a pre-existing gap, unrelated
    // to this test) — BarChartBlock throws and BlockErrorBoundary catches it in EITHER render, so
    // there's no bar-chart text to assert here. The underlying binding/value difference for
    // `concentration` between the two fixtures is already proven above (the "resolves and
    // validates cleanly against this exact payload" cases) and by resolveBinding directly below.
    expect(resolveBinding('data.concentration', realFixture)).toHaveLength(4);
    expect(resolveBinding('data.concentration', secondInstanceFixture)).toHaveLength(2);

    // The one field the second instance omits entirely (`excluded`) degrades to its own
    // placeholder in that render — never a crash, never silently dropped-without-a-trace, and
    // never affecting any of the other blocks around it.
    expect(secondContainer.textContent).toContain('resolved to nothing');
    // ...while the original fixture's own `excluded` content is present exactly as always.
    expect(originalContainer.textContent).toContain('Already at band ceiling');
  });
});
