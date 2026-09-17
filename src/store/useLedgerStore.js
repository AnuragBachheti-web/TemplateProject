import { create } from 'zustand';
import { createLedgerEntry } from '@/features/action-stories/contract/ledgerEntry';

// The reference's "LedgerOverlay ... on every Actions screen" chrome — a real, session-scoped
// activity log, deliberately independent of useActionStoriesStore: that store's decision/selection/
// pending state is cleared on every stage navigation (StagePage's own cleanup effect calls
// clearDecision()), which is correct for per-proposal state but wrong for an audit trail meant to
// survive moving between stories. `isOpen` lives here too (not in Shell.jsx's own local state) so
// the masthead trigger and the overlay itself can agree on it with no prop drilling through Outlet.
const MAX_ENTRIES = 200; // a session ledger, not an unbounded memory leak across a long-running tab

export const useLedgerStore = create((set) => ({
  entries: [],
  isOpen: false,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  /** Called by useActionStoriesStore.runAction() whenever a real operator action settles. */
  record: (fields) =>
    set((state) => ({
      entries: [createLedgerEntry(fields), ...state.entries].slice(0, MAX_ENTRIES),
    })),
}));
