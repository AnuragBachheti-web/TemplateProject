// The single highest-value missing test per AUDIT_REPORT.md §20/§24 P1 #6 and
// extraction/audit-report.md's own recommendation: loop every manifest in manifests/*.json against
// its matching fixture in data/raw/, resolve every block's binding, validate it against its
// declared blockType, and assert zero blocks fall through to "orphaned" (an undefined resolution or
// a validation failure) — exactly the class of bug that let 9 confirmed misclassified charts and a
// unit-scale bug ship silently before this suite existed. Mirrors extraction/validateAllStages.js's
// own check, but as a real `npm test` assertion (so it fails CI, not just a separately-run script)
// and with per-workflow test grouping so a regression names exactly which stage broke.
import { describe, it, expect } from 'vitest';
import { resolveBinding } from '../manifests/resolveBinding';
import { validateBlockData } from '../manifests/blockTypes';
import { validateManifest } from '../manifests/validateManifest';
import { composeSections } from '@/features/action-stories/layout/composeSections';

const manifestModules = import.meta.glob('./manifests/*.json', { eager: true });
const fixtureModules = import.meta.glob('/src/features/action-stories/__corpus__/fixtures/raw/*/*.json', { eager: true });

function fixtureFor(code, stageKey) {
  const path = `/src/features/action-stories/__corpus__/fixtures/raw/${code}/${stageKey}.json`;
  return fixtureModules[path]?.default;
}

const manifestsByCode = Object.entries(manifestModules)
  .filter(([path]) => /\/S\d+(\.\d+)?\.json$/.test(path))
  .map(([path, mod]) => ({ code: path.match(/([^/]+)\.json$/)[1], stageManifests: mod.default }));

describe('manifest + fixture sweep — zero orphaned blocks across every real workflow', () => {
  it('sanity: the glob actually found real manifests (guards against a silently-empty sweep)', () => {
    expect(manifestsByCode.length).toBeGreaterThan(20); // 26 real workflows as of this writing
  });

  describe.each(manifestsByCode)('$code', ({ code, stageManifests }) => {
    it.each(stageManifests.map((m) => [m.stageKey, m]))('%s: every block resolves and validates cleanly', (stageKey, manifest) => {
      const manifestProblems = validateManifest(manifest);
      expect(manifestProblems).toEqual([]);

      const fixture = fixtureFor(code, stageKey);
      expect(fixture, `no fixture found at __corpus__/fixtures/raw/${code}/${stageKey}.json`).toBeTruthy();

      const orphaned = [];
      for (const block of manifest.blocks) {
        const value = resolveBinding(block.binding, fixture);
        if (value === undefined) {
          orphaned.push(`"${block.slotName}" (${block.binding}): resolved to undefined`);
          continue;
        }
        const problems = validateBlockData(block.blockType, value);
        if (problems.length > 0) {
          orphaned.push(`"${block.slotName}" (${block.binding}, ${block.blockType}): ${problems.join('; ')}`);
        }
      }
      expect(orphaned).toEqual([]);
    });
  });
});

describe('manifest + fixture sweep — Phase 2/3 layout composition at full scale', () => {
  it('every real manifest composes without throwing and accounts for every block exactly once across BOTH regions (no drops, no duplicates)', () => {
    for (const { code, stageManifests } of manifestsByCode) {
      for (const manifest of stageManifests) {
        const items = manifest.blocks.map((b) => ({
          slotName: b.slotName,
          blockType: b.blockType,
          layout: b.layout,
          section: b.section,
          region: b.region,
        }));
        let sections;
        expect(() => {
          sections = composeSections(items, manifest.sections);
        }, `${code}/${manifest.stageKey} threw during layout composition`).not.toThrow();
        const allSections = [...sections.main, ...sections.rail];
        const placedSlots = allSections.flatMap((s) => s.rows.flatMap((r) => (r.type === 'grid' || r.type === 'flow' ? r.items.map((i) => i.slotName) : [r.slotName])));
        expect(new Set(placedSlots).size, `${code}/${manifest.stageKey}: duplicate slot in layout output`).toBe(placedSlots.length);
        expect(placedSlots.sort(), `${code}/${manifest.stageKey}: block dropped or added by layout composition`).toEqual(
          manifest.blocks.map((b) => b.slotName).sort(),
        );
      }
    }
  });

  it('a manifest below the sectioning threshold has no `sections` field and composes to exactly one unsectioned main-region bucket, empty rail', () => {
    for (const { code, stageManifests } of manifestsByCode) {
      for (const manifest of stageManifests) {
        if (manifest.sections !== undefined) continue; // only checking the still-unsectioned ones here
        const items = manifest.blocks.map((b) => ({ slotName: b.slotName, blockType: b.blockType }));
        const { main, rail } = composeSections(items, manifest.sections);
        expect(rail, `${code}/${manifest.stageKey}`).toEqual([]);
        expect(main, `${code}/${manifest.stageKey}`).toHaveLength(1);
        expect(main[0].id, `${code}/${manifest.stageKey}`).toBeNull();
      }
    }
  });

  it('every declared section is genuinely non-empty, named from the fixed, reviewable section vocabulary, and declares a region', () => {
    // The full vocabulary classifyBlocks.js's `planSections` can emit — see its own SECTION_ORDER.
    // "recommendation"/"rollup"/"provenance" are the FORENSIC_AUDIT_S9.1.md semantic-placement
    // additions (a stage's own headline group, a metrics rollup, a provenance/basis footnote list).
    // "decision" is the DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §7/§11 addition: a control block
    // (blockType 'slider') fused with every block its own measured `dependencies` names.
    // "execution" is this pass's own addition (Pattern E: destination + before/after diff).
    const allowedIds = new Set(['guardrails', 'recommendation', 'decision', 'summary', 'rollup', 'provenance', 'analysis', 'execution', 'details']);
    let sectionedStageCount = 0;
    for (const { code, stageManifests } of manifestsByCode) {
      for (const manifest of stageManifests) {
        if (!manifest.sections) continue;
        sectionedStageCount++;
        expect(manifest.sections.length, `${code}/${manifest.stageKey}`).toBeGreaterThanOrEqual(2);
        for (const s of manifest.sections) {
          expect(allowedIds.has(s.id), `${code}/${manifest.stageKey}: unexpected section id "${s.id}"`).toBe(true);
          expect(['main', 'rail'].includes(s.region), `${code}/${manifest.stageKey}: section "${s.id}" missing a valid region`).toBe(true);
        }
      }
    }
    // Sanity: the feature is actually exercised by real data, not dead code nobody's manifest uses.
    expect(sectionedStageCount).toBeGreaterThan(0);
  });

  it('a "role: hero" block is never placed in the rail region (regression guard for the exact bug the forensic audit traced)', () => {
    for (const { code, stageManifests } of manifestsByCode) {
      for (const manifest of stageManifests) {
        if (!manifest.sections) continue;
        const items = manifest.blocks.map((b) => ({ slotName: b.slotName, blockType: b.blockType, layout: b.layout, section: b.section, region: b.region }));
        const { rail } = composeSections(items, manifest.sections);
        const railSlots = new Set(rail.flatMap((s) => s.rows.flatMap((r) => (r.type === 'grid' || r.type === 'flow' ? r.items.map((i) => i.slotName) : [r.slotName]))));
        for (const block of manifest.blocks) {
          if (block.role === 'hero') {
            expect(railSlots.has(block.slotName), `${code}/${manifest.stageKey}: hero block "${block.slotName}" ended up in the rail`).toBe(false);
          }
        }
      }
    }
  });
});

describe('manifest + fixture sweep — no manifest binds the two reserved real-vocabulary slot names', () => {
  it('execution_lane and guardrail_verdict never appear as a slotName anywhere (regression: field-semantic collision)', () => {
    const offenders = [];
    for (const { code, stageManifests } of manifestsByCode) {
      for (const manifest of stageManifests) {
        for (const block of manifest.blocks) {
          if (block.slotName === 'execution_lane' || block.slotName === 'guardrail_verdict') {
            offenders.push(`${code}/${manifest.stageKey}: ${block.slotName}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
