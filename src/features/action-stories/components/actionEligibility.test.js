import { describe, it, expect } from 'vitest';
import { resolveActionState } from './actionEligibility';

describe('resolveActionState', () => {
  it('an action with no "when" is always enabled', () => {
    const state = resolveActionState({ id: 'dismiss', label: 'Dismiss' }, { data: {} });
    expect(state).toMatchObject({ id: 'dismiss', label: 'Dismiss', kind: 'secondary', enabled: true, disabledReason: null });
  });

  it('defaults kind to "secondary" and actionType to the action id when unset', () => {
    const state = resolveActionState({ id: 'dismiss', label: 'Dismiss' }, { data: {} });
    expect(state.kind).toBe('secondary');
    expect(state.actionType).toBe('dismiss');
  });

  it('honors an explicit "action" backend-type distinct from "id"', () => {
    const state = resolveActionState({ id: 'approve_and_notify', label: 'Approve & notify', action: 'confirm' }, { data: {} });
    expect(state.actionType).toBe('confirm');
  });

  describe('the migrated guardrail rule (reproduced generically via "when", not hardcoded)', () => {
    function guardrailAction() {
      return {
        id: 'confirm',
        label: 'Approve',
        action: 'confirm',
        when: {
          all: [
            { path: 'data.blocked', op: 'ne', value: true },
            { path: 'data.canApprove', op: 'ne', value: false },
          ],
        },
        disabledReasonBinding: 'data.blockReason',
        labelBinding: 'data.ctaLabel',
      };
    }

    it('defaults to enabled when a stage has no guardrail data at all (82 of 105 real stages)', () => {
      const state = resolveActionState(guardrailAction(), { data: { rationale: 'no guardrail fields here' } });
      expect(state.enabled).toBe(true);
      expect(state.disabledReason).toBeNull();
    });

    it('disables when "blocked" is true', () => {
      const state = resolveActionState(guardrailAction(), {
        data: { blocked: true, canApprove: false, blockReason: 'Exceeds appetite', ctaLabel: 'Approve pilot & continue' },
      });
      expect(state.enabled).toBe(false);
      expect(state.disabledReason).toBe('Exceeds appetite');
      expect(state.label).toBe('Approve pilot & continue');
    });

    it('disables on "canApprove: false" alone, even without an explicit "blocked" flag', () => {
      const state = resolveActionState(guardrailAction(), { data: { canApprove: false } });
      expect(state.enabled).toBe(false);
    });

    it('stays enabled when blocked is explicitly false and canApprove is true', () => {
      const state = resolveActionState(guardrailAction(), { data: { blocked: false, canApprove: true } });
      expect(state.enabled).toBe(true);
    });

    it('disabledReason falls back to null when no reason binding resolves to anything', () => {
      const state = resolveActionState(guardrailAction(), { data: { blocked: true } });
      expect(state.disabledReason).toBeNull();
    });

    it('label falls back to the static "label" when labelBinding resolves to nothing', () => {
      const state = resolveActionState(guardrailAction(), { data: {} });
      expect(state.label).toBe('Approve');
    });
  });

  describe('confirm / reason resolution', () => {
    it('confirmRequired defaults to false; confirmTitle falls back to "{label}?"', () => {
      const state = resolveActionState({ id: 'dismiss', label: 'Dismiss' }, { data: {} });
      expect(state.confirmRequired).toBe(false);
      expect(state.confirmTitle).toBe('Dismiss?');
    });

    it('honors an explicit confirm config', () => {
      const state = resolveActionState(
        { id: 'approve', label: 'Approve', confirm: { required: true, title: 'Approve this?', description: 'Cannot be undone.' } },
        { data: {} },
      );
      expect(state).toMatchObject({ confirmRequired: true, confirmTitle: 'Approve this?', confirmDescription: 'Cannot be undone.' });
    });

    it('reasonEnabled is true only when a "reason" object is declared at all (required or optional)', () => {
      expect(resolveActionState({ id: 'a', label: 'A' }, { data: {} }).reasonEnabled).toBe(false);
      expect(resolveActionState({ id: 'a', label: 'A', reason: {} }, { data: {} }).reasonEnabled).toBe(true);
    });

    it('reasonMinLength defaults to 0 (no minimum) when unset or non-positive', () => {
      expect(resolveActionState({ id: 'a', label: 'A', reason: { required: true } }, { data: {} }).reasonMinLength).toBe(0);
      expect(resolveActionState({ id: 'a', label: 'A', reason: { minLength: 10 } }, { data: {} }).reasonMinLength).toBe(10);
    });
  });

  it('never throws on a missing action/fixture', () => {
    expect(() => resolveActionState(undefined, undefined)).not.toThrow();
    expect(resolveActionState(undefined, undefined).enabled).toBe(true);
  });
});
