import { create } from 'zustand';
import { dispatchAction, newIdempotencyKey } from '@/services/actionStoriesMutations';
import { checkOperatorAction, getOperatorAction } from '@/features/action-stories/contract/actionTypes';
import { useLedgerStore } from './useLedgerStore';

/**
 * Operator-action state for the currently-rendered proposal.
 *
 * The SAME zustand store this feature always had — no new state library, no second store, no
 * migration. What changed is what it holds and what it trusts:
 *
 *   - It now holds the current Decision Object. That object is SERVER STATE, fetched and replaced
 *     wholesale; it is never patched locally and never mirrored into derived slices. A successful
 *     action returns the new Decision Object and the store swaps it in — which is what makes the
 *     whole screen (slate, guardrails, eligibility, status) re-render correctly with no optimistic
 *     reconciliation logic anywhere.
 *   - `completedActions` and its localStorage persistence are GONE. A completed action used to be
 *     client-side truth that survived a refresh, which meant clearing browser storage un-approved a
 *     proposal. `decision.status` is the only answer to "was this approved".
 *
 * Which proposal/stage is showing still lives in the URL, not here — StagePage reads it from
 * useParams(), so it cannot drift from the address bar and back/forward keeps working.
 */
export const useActionStoriesStore = create((set, get) => ({
  /** The Decision Object currently rendered. Server state — replaced, never edited. */
  decision: null,
  /** actionId -> true while that action's POST is in flight. */
  pendingActions: {},
  /** actionId -> the ActionStoriesError from its last failed attempt. */
  actionErrors: {},
  /** actionId -> the idempotency key of its last attempt, so a RETRY reuses it rather than minting a new one. */
  idempotencyKeys: {},
  /** Slate item ids currently ticked, for Approve-selected. Cleared whenever the proposal changes. */
  selection: [],

  /** Called by StagePage once the stage view has loaded, and after every successful action. */
  setDecision: (decision) =>
    set((state) => ({
      decision,
      // A different proposal must never inherit the previous one's selection or error state.
      selection: decision?.proposal_id === state.decision?.proposal_id ? state.selection : [],
      actionErrors: decision?.proposal_id === state.decision?.proposal_id ? state.actionErrors : {},
    })),

  clearDecision: () => set({ decision: null, selection: [], actionErrors: {}, pendingActions: {}, idempotencyKeys: {} }),

  toggleSelection: (itemId) =>
    set((state) => ({
      selection: state.selection.includes(itemId)
        ? state.selection.filter((id) => id !== itemId)
        : [...state.selection, itemId],
    })),

  setSelection: (ids) => set({ selection: Array.isArray(ids) ? ids : [] }),

  isActionPending: (actionId) => Boolean(get().pendingActions[actionId]),
  getActionError: (actionId) => get().actionErrors[actionId] ?? null,

  /**
   * Runs one operator action against the current Decision Object.
   *
   * THE DISPATCH BOUNDARY GATE. Eligibility is re-checked here, before anything is sent, using the
   * same pure `checkOperatorAction` the action bar renders from and the server enforces. The action
   * bar's check decides how a button LOOKS; this one decides whether a request HAPPENS. They are
   * deliberately the same function and deliberately in two places: a gate that exists only inside a
   * click handler is bypassed by every call site that is not that click handler.
   *
   * Fails closed: no Decision Object, an unknown action, a missing `eligibility` entry, or
   * `allowed` that is anything other than the boolean `true` all refuse without a network call.
   */
  runAction: async (actionId, { reason, selection, snoozeUntil } = {}) => {
    const { decision, pendingActions } = get();
    if (pendingActions[actionId]) return; // duplicate-click guard

    const effectiveSelection = selection ?? get().selection;
    const verdict = checkOperatorAction(actionId, decision, {
      reason,
      selection: effectiveSelection,
      snooze_until: snoozeUntil,
    });
    if (!verdict.allowed) {
      set((state) => ({
        actionErrors: {
          ...state.actionErrors,
          [actionId]: { code: 'CLIENT_ERROR', userMessage: verdict.reason, retryable: false },
        },
      }));
      return;
    }

    // A retry reuses the previous attempt's key. That is the whole reason the key is stored: a
    // first attempt whose response was lost, retried with the same key, must return the original
    // result rather than approve a second time.
    const idempotencyKey = get().idempotencyKeys[actionId] ?? newIdempotencyKey();

    set((state) => ({
      pendingActions: { ...state.pendingActions, [actionId]: true },
      actionErrors: { ...state.actionErrors, [actionId]: undefined },
      idempotencyKeys: { ...state.idempotencyKeys, [actionId]: idempotencyKey },
    }));

    try {
      const updated = await dispatchAction({
        proposalId: decision.proposal_id,
        decision,
        actionType: actionId,
        reason,
        selection: effectiveSelection,
        snoozeUntil,
        idempotencyKey,
      });

      set((state) => {
        const nextPending = { ...state.pendingActions };
        delete nextPending[actionId];
        const nextKeys = { ...state.idempotencyKeys };
        delete nextKeys[actionId]; // settled — a future action starts a new key
        return {
          // The re-render everything else depends on: the returned Decision Object replaces the old
          // one, so the slate, guardrails, eligibility and status all update from one assignment.
          decision: updated,
          selection: [],
          pendingActions: nextPending,
          idempotencyKeys: nextKeys,
        };
      });
      // A REAL event, recorded once the backend has actually confirmed it — never before the
      // request settles, which would log an action that might still fail. See ledgerEntry.js for
      // why this is deliberately the only place an entry is ever created.
      useLedgerStore.getState().record({
        actionId,
        label: getOperatorAction(actionId)?.label ?? actionId,
        storyCode: decision.story_code,
        stage: decision.stage,
        proposalId: decision.proposal_id,
        outcome: 'success',
        detail: updated.status,
      });
      return updated;
    } catch (error) {
      set((state) => {
        const nextPending = { ...state.pendingActions };
        delete nextPending[actionId];
        // The idempotency key is deliberately KEPT on failure — retrying is how this action is
        // retried, and it must reuse the key.
        return { pendingActions: nextPending, actionErrors: { ...state.actionErrors, [actionId]: error } };
      });
      useLedgerStore.getState().record({
        actionId,
        label: getOperatorAction(actionId)?.label ?? actionId,
        storyCode: decision.story_code,
        stage: decision.stage,
        proposalId: decision.proposal_id,
        outcome: 'error',
        detail: error?.userMessage ?? error?.message ?? null,
      });
      return undefined;
    }
  },
}));
