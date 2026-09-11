// The canonical composition-tree regression test: S9.1 Decide, run through the REAL generated
// manifest (not a synthetic fixture) end to end through composeSections. This is the single
// strongest proof that the semantic-placement/grouping/density fixes hold for the actual shipped
// data, not just for hand-built test fixtures — see FORENSIC_AUDIT_S9.1.md and
// S9.1_ARCHITECTURE_FIX_REPORT.md for the full trace this asserts against.
import { describe, it, expect } from 'vitest';
import { composeSections } from './composeSections';
import manifest from '../manifests/S9.1.json';

const decide = manifest.find((m) => m.stageKey === 'decide');

function itemsFor(stageManifest) {
  return stageManifest.blocks.map((b) => ({
    slotName: b.slotName,
    blockType: b.blockType,
    layout: b.layout,
    section: b.section,
    region: b.region,
  }));
}

describe('S9.1 Decide — composition tree (canonical reference-fidelity test)', () => {
  const { main, rail } = composeSections(itemsFor(decide), decide.sections);

  it('main region\'s first section is the composed "recommendation" panel with the whole hero story fused into one row', () => {
    const recommendation = main.find((s) => s.id === 'recommendation');
    expect(recommendation).toBeTruthy();
    expect(recommendation.title).toBeNull(); // no redundant section header above the hero card
    expect(recommendation.rows).toHaveLength(1);
    const row = recommendation.rows[0];
    expect(row.type).toBe('grid');
    expect(row.explicit).toBe(true); // an authored `layout.group`, not the scalar heuristic
    expect(row.items.map((i) => i.slotName)).toEqual(['heroTitle', 'heroSub', 'heroMetrics', 'moveBar']);
    // Every member spans the full 12-column panel (a vertical narrative stack, not a metric strip).
    expect(row.items.every((i) => i.span === 12)).toBe(true);
  });

  it('main region also has an independent "details" section for genuinely unrelated content (tables stay tables, not fused into the hero panel)', () => {
    const details = main.find((s) => s.id === 'details');
    expect(details).toBeTruthy();
    const slots = details.rows.map((r) => (r.type === 'single' ? r.slotName : null)).filter(Boolean);
    expect(slots).toEqual(['slates', 'groups', 'focusRows']);
  });

  it('none of the hero/recommendation content is anywhere in the rail', () => {
    const railSlots = new Set(rail.flatMap((s) => s.rows.flatMap((r) => (r.type === 'grid' || r.type === 'flow' ? r.items.map((i) => i.slotName) : [r.slotName]))));
    for (const slot of ['heroTitle', 'heroSub', 'heroMetrics', 'moveBar']) {
      expect(railSlots.has(slot)).toBe(false);
    }
  });

  it('rail is composed of 4 independent, distinctly-titled sections (not 2 undifferentiated ones)', () => {
    expect(rail.map((s) => s.id)).toEqual(['guardrails', 'summary', 'rollup', 'provenance']);
    expect(rail.map((s) => s.title)).toEqual(['Guardrails', 'Summary', 'Totals', 'Basis']);
  });

  it('every block in the manifest is accounted for exactly once across both regions (no drops, no duplicates)', () => {
    const placed = [...main, ...rail].flatMap((s) => s.rows.flatMap((r) => (r.type === 'grid' || r.type === 'flow' ? r.items.map((i) => i.slotName) : [r.slotName])));
    expect(new Set(placed).size).toBe(placed.length);
    expect(placed.sort()).toEqual(decide.blocks.map((b) => b.slotName).sort());
  });
});

describe('S9.1 Reason/Analyze/Execute — structural regression guard (unaffected stages stay unaffected)', () => {
  it('Reason has no rail at all (below the sectioning threshold) and fuses its two scalar fields into one row', () => {
    const reason = manifest.find((m) => m.stageKey === 'reason');
    const { main, rail } = composeSections(itemsFor(reason), reason.sections);
    expect(rail).toEqual([]);
    expect(main).toHaveLength(1);
    const gridRow = main[0].rows.find((r) => r.type === 'grid');
    expect(gridRow.items.map((i) => i.slotName)).toEqual(['rationale', 'display_mode']);
    expect(gridRow.explicit).toBe(false); // the scalar heuristic, not an authored group
  });

  it('Execute has no "recommendation" section (no hero-vocabulary slot in this stage)', () => {
    const execute = manifest.find((m) => m.stageKey === 'execute');
    const { main } = composeSections(itemsFor(execute), execute.sections);
    expect(main.some((s) => s.id === 'recommendation')).toBe(false);
  });
});
