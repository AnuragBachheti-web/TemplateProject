import { create } from 'zustand';

const stageId = (code, stageKey) => `${code}/${stageKey}`;

/**
 * UI-only state for Action Stories.
 *
 * Which workflow/stage is showing is NOT here — it lives in the URL (see
 * @/constants/actionStoriesRoutes) and StagePage reads it straight from useParams(), so it can
 * never drift from what the address bar says and back/forward keeps working for free.
 *
 * The Confirm/Approve/Start button on a decide/execute stage is still just UI decoration: no
 * backend call, no ledger entry exists yet for Action Stories. This only remembers, per stage,
 * whether that button has been pressed so the screen can show its confirmed look.
 *
 * TODO(action-stories-mutations): once a real mutation endpoint exists (e.g.
 * POST /v1/action-stories/:code/:stageKey/confirm), replace `confirmStage` with an async action
 * that calls it and only flips `confirmedStages` on success — pairs with the SAMPLE DATA note at
 * the top of actionStoriesService.js.
 */
export const useActionStoriesStore = create((set, get) => ({
  confirmedStages: {}, // `${code}/${stageKey}` -> true, once its decorative button is pressed

  isStageConfirmed: (code, stageKey) => Boolean(get().confirmedStages[stageId(code, stageKey)]),

  confirmStage: (code, stageKey) =>
    set((state) => ({
      confirmedStages: { ...state.confirmedStages, [stageId(code, stageKey)]: true },
    })),

  resetStage: (code, stageKey) =>
    set((state) => {
      const next = { ...state.confirmedStages };
      delete next[stageId(code, stageKey)];
      return { confirmedStages: next };
    }),
}));
