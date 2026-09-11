import { create } from 'zustand';
import { confirmStageMutation, readConfirmedStages, clearConfirmedStage } from '@/services/actionStoriesMutations';

const stageId = (code, stageKey) => `${code}/${stageKey}`;

/**
 * UI + mutation state for Action Stories.
 *
 * Which workflow/stage is showing is NOT here — it lives in the URL (see
 * @/constants/actionStoriesRoutes) and StagePage reads it straight from useParams(), so it can
 * never drift from what the address bar says and back/forward keeps working for free.
 *
 * The Confirm/Approve/Start button on a decide/execute stage now performs a real mutation
 * lifecycle — click -> loading -> success/failure -> persisted, server-truth-once-a-backend-
 * exists state (see services/actionStoriesMutations.js's own doc comment for exactly what "real"
 * means here today vs. once a live endpoint exists). `confirmedStages` is hydrated from
 * localStorage at store creation, so a page refresh shows the correct confirmed/unconfirmed state
 * instead of reverting every stage to unconfirmed (AUDIT_REPORT.md §13: "Refresh preserves state?
 * No.").
 */
export const useActionStoriesStore = create((set, get) => ({
  confirmedStages: readConfirmedStages(), // `${code}/${stageKey}` -> ISO confirmedAt timestamp
  pendingStages: {}, // `${code}/${stageKey}` -> true while a confirm mutation is in flight
  stageErrors: {}, // `${code}/${stageKey}` -> the ActionStoriesError from the last failed attempt

  isStageConfirmed: (code, stageKey) => Boolean(get().confirmedStages[stageId(code, stageKey)]),
  isStagePending: (code, stageKey) => Boolean(get().pendingStages[stageId(code, stageKey)]),
  getStageError: (code, stageKey) => get().stageErrors[stageId(code, stageKey)] ?? null,

  /**
   * Real async mutation, not a local `set()`: eligibility (is this stage already confirmed or
   * already in flight — duplicate-click protection) is checked before anything happens, then a
   * genuine loading state is entered for the duration of confirmStageMutation, and the result
   * (success -> persisted confirmation, failure -> a retryable error) is the only thing that
   * updates `confirmedStages`. Calling this again after a failure is how retry works — no
   * separate "retry" action needed, since this function is already idempotent-safe to re-invoke.
   */
  confirmStage: async (code, stageKey) => {
    const id = stageId(code, stageKey);
    if (get().isStageConfirmed(code, stageKey) || get().isStagePending(code, stageKey)) return;

    set((state) => ({
      pendingStages: { ...state.pendingStages, [id]: true },
      stageErrors: { ...state.stageErrors, [id]: undefined },
    }));

    try {
      const result = await confirmStageMutation(code, stageKey);
      set((state) => {
        const nextPending = { ...state.pendingStages };
        delete nextPending[id];
        return {
          confirmedStages: { ...state.confirmedStages, [id]: result.confirmedAt },
          pendingStages: nextPending,
        };
      });
    } catch (error) {
      set((state) => {
        const nextPending = { ...state.pendingStages };
        delete nextPending[id];
        return { pendingStages: nextPending, stageErrors: { ...state.stageErrors, [id]: error } };
      });
    }
  },

  resetStage: (code, stageKey) => {
    clearConfirmedStage(code, stageKey); // keep localStorage in sync — otherwise a refresh would silently restore it
    set((state) => {
      const next = { ...state.confirmedStages };
      delete next[stageId(code, stageKey)];
      return { confirmedStages: next };
    });
  },
}));
