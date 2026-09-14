import { create } from 'zustand';
import { dispatchAction, readCompletedActions, clearCompletedAction } from '@/services/actionStoriesMutations';

const actionKey = (code, stageKey, actionId) => `${code}/${stageKey}/${actionId}`;

/**
 * UI + mutation state for Action Stories' generic, template-driven action system.
 *
 * Which workflow/stage is showing is NOT here — it lives in the URL (see
 * @/constants/actionStoriesRoutes) and StagePage reads it straight from useParams(), so it can
 * never drift from what the address bar says and back/forward keeps working for free.
 *
 * Keyed by `${code}/${stageKey}/${actionId}`, not just `${code}/${stageKey}` — a stage can expose
 * more than one action (an "approve" and a "decline" side by side, say; see StageActionBar.jsx),
 * each with its own independent done/pending/error lifecycle, all going through the one generic
 * `runAction`. Nothing here knows what any given `actionId` MEANS — see services/
 * actionStoriesMutations.js for exactly what "real" means for the mutation itself today (no live
 * backend exists yet; genuinely persisted, genuinely async, genuinely failable, ready to point at a
 * real endpoint later).
 */
export const useActionStoriesStore = create((set, get) => ({
  completedActions: readCompletedActions(), // key -> ISO completedAt timestamp
  pendingActions: {}, // key -> true while a run is in flight
  actionErrors: {}, // key -> the ActionStoriesError from the last failed attempt

  isActionDone: (code, stageKey, actionId) => Boolean(get().completedActions[actionKey(code, stageKey, actionId)]),
  isActionPending: (code, stageKey, actionId) => Boolean(get().pendingActions[actionKey(code, stageKey, actionId)]),
  getActionError: (code, stageKey, actionId) => get().actionErrors[actionKey(code, stageKey, actionId)] ?? null,

  /**
   * Real async mutation, generic over `actionId` (and the action's own declared backend `action`
   * type — see actionEligibility.js's `actionType`): duplicate-click / concurrent-run protection
   * for THIS SPECIFIC action is checked before anything happens, then a genuine loading state is
   * entered for the duration of dispatchAction(), and the result (success -> persisted completion,
   * failure -> a retryable error) is the only thing that updates `completedActions`. Calling this
   * again after a failure is how retry works — no separate "retry" action needed.
   */
  runAction: async (code, stageKey, actionId, { action, reason } = {}) => {
    const id = actionKey(code, stageKey, actionId);
    if (get().isActionDone(code, stageKey, actionId) || get().isActionPending(code, stageKey, actionId)) return;

    set((state) => ({
      pendingActions: { ...state.pendingActions, [id]: true },
      actionErrors: { ...state.actionErrors, [id]: undefined },
    }));

    try {
      const result = await dispatchAction({ code, stageKey, actionId, action, reason });
      set((state) => {
        const nextPending = { ...state.pendingActions };
        delete nextPending[id];
        return {
          completedActions: { ...state.completedActions, [id]: result.completedAt },
          pendingActions: nextPending,
        };
      });
    } catch (error) {
      set((state) => {
        const nextPending = { ...state.pendingActions };
        delete nextPending[id];
        return { pendingActions: nextPending, actionErrors: { ...state.actionErrors, [id]: error } };
      });
    }
  },

  resetAction: (code, stageKey, actionId) => {
    clearCompletedAction(code, stageKey, actionId); // keep localStorage in sync — otherwise a refresh would silently restore it
    set((state) => {
      const next = { ...state.completedActions };
      delete next[actionKey(code, stageKey, actionId)];
      return { completedActions: next };
    });
  },
}));
