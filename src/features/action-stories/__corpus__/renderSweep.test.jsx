// @vitest-environment jsdom
//
// The render-level counterpart to manifests/manifestFixtureSweep.test.js.
//
// That sweep proves every block's binding *resolves* and its value *validates* across all 26
// workflows × 4 stages — a data-level guarantee. It never renders anything, so the one thing it
// cannot catch is a block that passes validation and then still produces nothing a user can see:
// a registry lookup that fails, a component that throws on a shape its own validator accepted (the
// exact BlockErrorBoundary case AUDIT_REPORT.md §14/§24 P0 #1 describes), or a block that quietly
// falls through to its EmptyState because the resolved value was structurally valid but carried no
// rows. StageRenderer.test.jsx does render, but only against hand-written 3-block manifests, and
// routeLevel.test.jsx renders exactly one workflow (S9.1) end to end — 103 of the 104 real stages
// have never been rendered by any test.
//
// This file closes that gap: mount every real manifest against its real fixture through the actual
// StageRenderer pipeline (same component App.jsx routes to, no mocking), and fail if any stage
// leaves a block as a placeholder or crashes one into its error boundary. Both signals are read
// from the console lines StageRenderer.jsx and BlockErrorBoundary.jsx already emit for exactly this
// purpose, rather than from markup — no source change needed, and a class-name refactor can't
// silently blind the sweep.
//
// The second (isolated) pass is reporting detail, not an assertion: a block's EmptyState is a
// legitimate outcome for genuinely empty data (see BlockStates.jsx's own note), so it's counted and
// printed, never failed on. Charts are excluded from the blank-DOM check because Recharts'
// ResponsiveContainer measures a parent box jsdom has no layout engine to give it — "no chart SVG
// in jsdom" means nothing about the real browser.
//
// `npm run test:render` runs just this file and prints the per-stage table.
import { describe, it, expect, afterAll, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import StageRenderer from '../components/StageRenderer';
import { resolveBinding } from '../manifests/resolveBinding';
import { BLOCK_REGISTRY } from '../blocks';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Recharts' ResponsiveContainer observes its parent box; jsdom ships no ResizeObserver, and without
// this every chart block on every stage would crash into its own error boundary and this sweep
// would report 104 false failures. A no-op observer is correct here: the container falls back to
// its zero measurement and renders nothing, which is precisely why charts are exempt from the
// blank-DOM check below.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const manifestModules = import.meta.glob('./manifests/S*.json', { eager: true });
const fixtureModules = import.meta.glob('./fixtures/raw/*/*.json', { eager: true });

const stages = Object.entries(manifestModules)
  .filter(([path]) => /\/S\d+(\.\d+)?\.json$/.test(path))
  .flatMap(([path, mod]) => {
    const code = path.match(/([^/]+)\.json$/)[1];
    return mod.default.map((manifest) => ({
      code,
      stageKey: manifest.stageKey,
      manifest,
      fixture: fixtureModules[`./fixtures/raw/${code}/${manifest.stageKey}.json`]?.default,
    }));
  })
  .sort((a, b) => a.code.localeCompare(b.code) || a.stageKey.localeCompare(b.stageKey));

const CHART_TYPES = new Set(['lineChart', 'barChart', 'scatterChart', 'waterfallChart', 'heatmapGrid']);

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return { container, unmount: () => act(() => root.unmount()) };
}

/**
 * Renders one block on its own, exactly as StageRenderer would hand it to the registry, and
 * classifies what came out. EmptyState and ErrorState (BlockStates.jsx) are the only things a block
 * component can return with a dashed border, so an isolated render's root border style is an
 * unambiguous signal of which of the two the block chose — and the rose variant distinguishes the
 * error case from the empty one.
 */
function classifyBlock(block, fixture) {
  const Component = BLOCK_REGISTRY[block.blockType];
  const value = resolveBinding(block.binding, fixture);
  if (!Component || value === undefined) return 'placeholder'; // already counted via pass 1's warning

  const { container, unmount } = mount(<Component slotName={block.slotName} data={value} role={block.role} />);
  const root = container.firstElementChild;
  const className = root?.getAttribute('class') ?? '';
  const text = container.textContent.trim();
  unmount();

  if (className.includes('border-dashed')) return className.includes('rose') ? 'errorState' : 'empty';
  if (!text && !CHART_TYPES.has(block.blockType)) return 'blank';
  return 'ok';
}

const results = [];

describe('render sweep — every real workflow stage renders through the real StageRenderer pipeline', () => {
  it('sanity: the glob found every stage of every workflow (guards against a silently-empty sweep)', () => {
    expect(stages.length).toBeGreaterThan(100); // 26 workflows × 4 stages as of this writing
  });

  it.each(stages.map((s) => [`${s.code}/${s.stageKey}`, s]))(
    '%s renders with no placeholder and no crashed block',
    (_label, { code, stageKey, manifest, fixture }) => {
      expect(fixture, `no fixture at data/raw/${code}/${stageKey}.json`).toBeTruthy();

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { container, unmount } = mount(<StageRenderer manifest={manifest} fixture={fixture} />);
      const text = container.textContent.trim();
      unmount();

      // React logs the caught exception itself alongside BlockErrorBoundary's own line, so match on
      // the prefixes those two files emit rather than counting console calls.
      const lineOf = (call) => (typeof call[0] === 'string' ? call[0] : '');
      const placeholders = warn.mock.calls.map(lineOf).filter((l) => l.startsWith('[StageRenderer]'));
      const crashed = error.mock.calls.map(lineOf).filter((l) => l.startsWith('[BlockErrorBoundary]'));

      // Spies stay installed through the isolated pass too — it re-renders the same chart blocks,
      // and Recharts' "width(0) and height(0)" complaint about the box jsdom can't lay out would
      // otherwise bury the table below under ~100 stderr blocks.
      const counts = { ok: 0, empty: 0, errorState: 0, blank: 0, placeholder: 0 };
      const notable = [];
      for (const block of manifest.blocks) {
        const verdict = classifyBlock(block, fixture);
        counts[verdict]++;
        if (verdict !== 'ok') notable.push(`${verdict}: "${block.slotName}" (${block.binding}, ${block.blockType})`);
      }
      warn.mockRestore();
      error.mockRestore();

      results.push({ code, stageKey, blocks: manifest.blocks.length, placeholders, crashed, counts, notable });

      expect(placeholders, `${code}/${stageKey}: block(s) fell through to a placeholder`).toEqual([]);
      expect(crashed, `${code}/${stageKey}: block(s) threw during render`).toEqual([]);
      expect(text, `${code}/${stageKey}: the stage rendered no visible text at all`).not.toBe('');
    },
  );
});

// Same table shape as extraction/validateAllStages.js, so the two read alike at a glance.
afterAll(() => {
  if (results.length === 0) return;
  results.sort((a, b) => a.code.localeCompare(b.code) || a.stageKey.localeCompare(b.stageKey));

  const codeW = Math.max(4, ...results.map((r) => r.code.length));
  const stageW = Math.max(5, ...results.map((r) => r.stageKey.length));
  const lines = [];

  lines.push('');
  lines.push('RENDER SWEEP');
  lines.push('CODE'.padEnd(codeW) + '  ' + 'STAGE'.padEnd(stageW) + '  STATUS  BLOCKS  OK  EMPTY  BLANK');
  lines.push('-'.repeat(codeW + stageW + 36));

  let passed = 0;
  let failed = 0;
  let totalBlocks = 0;
  let totalEmpty = 0;
  let totalBlank = 0;

  for (const r of results) {
    const ok = r.placeholders.length === 0 && r.crashed.length === 0;
    ok ? passed++ : failed++;
    totalBlocks += r.blocks;
    totalEmpty += r.counts.empty + r.counts.errorState;
    totalBlank += r.counts.blank;

    lines.push(
      `${r.code.padEnd(codeW)}  ${r.stageKey.padEnd(stageW)}  ${(ok ? 'PASS' : 'FAIL').padEnd(6)}  ` +
        `${String(r.blocks).padStart(6)}  ${String(r.counts.ok).padStart(2)}  ` +
        `${String(r.counts.empty + r.counts.errorState).padStart(5)}  ${String(r.counts.blank).padStart(5)}`,
    );
    for (const p of r.placeholders) lines.push(`    placeholder: ${p}`);
    for (const c of r.crashed) lines.push(`    crashed    : ${c}`);
    for (const n of r.notable) lines.push(`    ${n}`);
  }

  lines.push('-'.repeat(codeW + stageW + 36));
  lines.push(`${passed} passed, ${failed} failed, ${results.length} stages, ${totalBlocks} blocks rendered`);
  // Not failures — an empty block is legitimate for genuinely empty data, and a blank one is worth
  // a look but may just be a block whose whole content is non-text (BlockStates.jsx's own note).
  lines.push(`${totalEmpty} block(s) showed an empty/error state, ${totalBlank} rendered no text`);
  lines.push('');

  console.log(lines.join('\n'));
});
