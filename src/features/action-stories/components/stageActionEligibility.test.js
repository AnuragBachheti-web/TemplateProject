import { describe, it, expect } from 'vitest';
import { resolveStageActionEligibility } from './stageActionEligibility';

function manifestWith(blocks) {
  return { blocks };
}

describe('resolveStageActionEligibility — the real, current corpus shapes', () => {
  it('defaults to canConfirm: true when a stage has no guardrail data at all (82 of 105 real stages)', () => {
    const manifest = manifestWith([{ slotName: 'rationale', blockType: 'text', binding: 'data.rationale' }]);
    const fixture = { data: { rationale: 'Realify will propose the move set.' } };
    expect(resolveStageActionEligibility(manifest, fixture)).toEqual({
      canConfirm: true,
      blockedReason: null,
      ctaLabel: null,
    });
  });

  it('blocks when guardrail_blocked is true (S9.16/decide\'s real shape)', () => {
    const manifest = manifestWith([
      { slotName: 'guardrail_blocked', blockType: 'flag', binding: 'data.blocked' },
      { slotName: 'guardrail_can_approve', blockType: 'flag', binding: 'data.canApprove' },
      { slotName: 'guardrail_reason', blockType: 'text', binding: 'data.blockReason' },
      { slotName: 'guardrail_cta_label', blockType: 'text', binding: 'data.ctaLabel' },
    ]);
    const fixture = {
      data: {
        blocked: true,
        canApprove: false,
        blockReason: 'Full-launch exposure of $92.5K breaks the $75K appetite set in Reason',
        ctaLabel: 'Approve pilot & continue',
      },
    };
    expect(resolveStageActionEligibility(manifest, fixture)).toEqual({
      canConfirm: false,
      blockedReason: 'Full-launch exposure of $92.5K breaks the $75K appetite set in Reason',
      ctaLabel: 'Approve pilot & continue',
    });
  });

  it('blocks on guardrail_can_approve: false alone, even without an explicit guardrail_blocked flag', () => {
    const manifest = manifestWith([{ slotName: 'guardrail_can_approve', blockType: 'flag', binding: 'data.canApprove' }]);
    const fixture = { data: { canApprove: false } };
    expect(resolveStageActionEligibility(manifest, fixture).canConfirm).toBe(false);
  });

  it('does NOT block when guardrail_blocked is explicitly false and guardrail_can_approve is true (S9.1/decide\'s real shape)', () => {
    const manifest = manifestWith([
      { slotName: 'guardrail_blocked', blockType: 'flag', binding: 'data.blocked' },
      { slotName: 'guardrail_can_approve', blockType: 'flag', binding: 'data.canApprove' },
      { slotName: 'guardrail_cta_label', blockType: 'text', binding: 'data.ctaLabel' },
    ]);
    const fixture = { data: { blocked: false, canApprove: true, ctaLabel: 'Approve 4 moves & continue' } };
    expect(resolveStageActionEligibility(manifest, fixture)).toEqual({
      canConfirm: true,
      blockedReason: null,
      ctaLabel: 'Approve 4 moves & continue',
    });
  });

  it('returns blockedReason: null when blocked but no reason field is present or it is blank', () => {
    const manifest = manifestWith([{ slotName: 'guardrail_blocked', blockType: 'flag', binding: 'data.blocked' }]);
    expect(resolveStageActionEligibility(manifest, { data: { blocked: true } }).blockedReason).toBeNull();
    const manifestWithBlankReason = manifestWith([
      { slotName: 'guardrail_blocked', blockType: 'flag', binding: 'data.blocked' },
      { slotName: 'guardrail_reason', blockType: 'text', binding: 'data.blockReason' },
    ]);
    expect(resolveStageActionEligibility(manifestWithBlankReason, { data: { blocked: true, blockReason: '   ' } }).blockedReason).toBeNull();
  });

  it('never blocks a stage whose blockedReason field exists but guardrail_blocked/can_approve do not (a reason alone is not a block)', () => {
    const manifest = manifestWith([{ slotName: 'guardrail_reason', blockType: 'text', binding: 'data.blockReason' }]);
    const fixture = { data: { blockReason: 'some context, no actual block flag' } };
    expect(resolveStageActionEligibility(manifest, fixture).canConfirm).toBe(true);
  });

  it('handles a missing manifest/fixture defensively rather than throwing', () => {
    expect(() => resolveStageActionEligibility(undefined, undefined)).not.toThrow();
    expect(resolveStageActionEligibility(undefined, undefined)).toEqual({ canConfirm: true, blockedReason: null, ctaLabel: null });
  });
});
