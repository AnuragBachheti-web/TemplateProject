import { describe, it, expect } from 'vitest';
import {
  GUARDRAIL_VERDICT_VALUES,
  EXECUTION_LANE_VALUES,
  isRealGuardrailVerdict,
  deriveExecutionLane,
} from './proposalFieldMapping';
import { classifyBlockType, planSlotNames } from '../../extraction/classifyBlocks.js';

describe('proposalFieldMapping — real API contract', () => {
  it('exposes exactly the 4 real guardrail_verdict values, no more, no less', () => {
    expect(GUARDRAIL_VERDICT_VALUES).toEqual(['within_limits', 'beyond_limits', 'not_applicable', 'undetermined']);
  });

  it('exposes exactly the 2 real execution_lane values', () => {
    expect(EXECUTION_LANE_VALUES).toEqual(['agent', 'human']);
  });

  it('isRealGuardrailVerdict accepts only the real enum values', () => {
    for (const v of GUARDRAIL_VERDICT_VALUES) expect(isRealGuardrailVerdict(v)).toBe(true);
    expect(isRealGuardrailVerdict('Suggest')).toBe(false); // the OLD, wrongly-collided mockup value
    expect(isRealGuardrailVerdict('Assist')).toBe(false);
    expect(isRealGuardrailVerdict(undefined)).toBe(false);
    expect(isRealGuardrailVerdict(['a', 'checklist', 'array'])).toBe(false); // the checklist shape, not the enum
  });

  it('deriveExecutionLane matches the real backend rule: "agent" only for within_limits', () => {
    expect(deriveExecutionLane('within_limits')).toBe('agent');
    expect(deriveExecutionLane('beyond_limits')).toBe('human');
    expect(deriveExecutionLane('not_applicable')).toBe('human');
    expect(deriveExecutionLane('undetermined')).toBe('human');
  });
});

describe('regression: execution_lane/guardrail_verdict cannot silently cross-map (AUDIT_REPORT.md §12)', () => {
  it('the manifest classifier never assigns the real vocabulary slot names to the mockup UI fields', () => {
    // execLabel ("Suggest"/"Assist" — a UI display-mode prop) must NOT land on slotName
    // "execution_lane" (the real, server-derived field with an unrelated meaning).
    const { slotNames: slots1 } = planSlotNames({ execLabel: 'Suggest' });
    expect(slots1.get('execLabel')).not.toBe('execution_lane');
    expect(slots1.get('execLabel')).toBe('display_mode');

    // checks (a governance checklist array) must NOT land on slotName "guardrail_verdict" (the
    // real 4-value enum, a completely different shape).
    const { slotNames: slots2 } = planSlotNames({ checks: [{ label: 'x', value: '1' }] });
    expect(slots2.get('checks')).not.toBe('guardrail_verdict');
    expect(slots2.get('checks')).toBe('guardrail_checks');
  });

  it('a real guardrail_verdict-shaped value (the enum string) would never validate as this UI\'s checklist slot', () => {
    // Defense in depth: even if some future code accidentally bound the real enum string into the
    // old checklist-shaped slot, classifyBlockType would not call a plain enum string a
    // "guardrail_checks"-worthy array — it would classify as plain text, not silently succeed as
    // if it were a checklist.
    expect(classifyBlockType('within_limits')).toBe('text');
    expect(classifyBlockType('within_limits')).not.toBe('labelValueList');
  });

  it('no shipped manifest binds a block to the literal real vocabulary slot names', async () => {
    // Real end-to-end guard over every generated manifest on disk — see also
    // src/features/action-stories/manifests/manifestFieldMapping.test.js for the full sweep. Kept
    // here too as a fast, colocated check on the two specific names this module is about.
    const glob = import.meta.glob('/src/features/action-stories/manifests/*.json', { eager: true });
    const offenders = [];
    for (const [path, mod] of Object.entries(glob)) {
      const manifests = mod.default;
      for (const manifest of manifests) {
        for (const block of manifest.blocks) {
          if (block.slotName === 'execution_lane' || block.slotName === 'guardrail_verdict') {
            offenders.push(`${path}: ${block.slotName}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
