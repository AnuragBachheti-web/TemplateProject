import { create } from 'zustand';

// The activation path `tailwind.config.js`'s own comment names ("the `data-theme="dark"` attribute
// on <html>, written by useThemeStore.js's paint()") but that never existed in this repository —
// the full dark-mode token set (`tokens.css`'s `[data-theme="dark"]` block, every block's own
// `dark:` Tailwind variants) was fully authored, real, non-trivial work with no way to ever reach
// it (AUDIT_REPORT.md §6/§17/§25: "authored-but-unreachable... a specific, avoidable maintenance
// trap"). This is that missing mechanism, built to the exact contract the config file already
// assumed — the token architecture itself needed no changes at all.

const STORAGE_KEY = 'rf-theme'; // 'light' | 'dark' | 'system' — an explicit user choice, or none yet
const PREFERS_DARK_QUERY = '(prefers-color-scheme: dark)';

function readStoredPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    // A private window, blocked storage, or a non-browser test environment — 'system' is a safe,
    // fully-functional default either way (see AsyncState/localStorage guidance elsewhere in this
    // codebase: never let a storage failure break rendering).
    return 'system';
  }
}

function systemPrefersDark() {
  try {
    return window.matchMedia?.(PREFERS_DARK_QUERY).matches ?? false;
  } catch {
    return false;
  }
}

/** Writes the resolved theme onto <html data-theme="..."> — the one place any DOM mutation for theming happens. */
function paint(preference) {
  const resolved = preference === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : preference;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved;
  }
  return resolved;
}

export const useThemeStore = create((set, get) => {
  const initialPreference = typeof window === 'undefined' ? 'system' : readStoredPreference();
  const initialResolved = paint(initialPreference);

  if (typeof window !== 'undefined' && window.matchMedia) {
    // Live-updates when the OS theme changes, but only while the user hasn't made an explicit
    // choice — an explicit 'light'/'dark' pick always wins over the system, matching how every
    // other app with a 3-way theme toggle behaves.
    try {
      window.matchMedia(PREFERS_DARK_QUERY).addEventListener('change', () => {
        if (get().preference === 'system') set({ resolved: paint('system') });
      });
    } catch {
      // matchMedia without addEventListener support (very old browsers) — system-preference
      // live-updates just don't happen; the initial resolved value from paint() above still works.
    }
  }

  return {
    preference: initialPreference, // 'light' | 'dark' | 'system' — what the user asked for
    resolved: initialResolved, // 'light' | 'dark' — what's actually painted right now

    setTheme: (preference) => {
      try {
        localStorage.setItem(STORAGE_KEY, preference);
      } catch {
        // Storage unavailable — the in-memory state below still updates and paints correctly for
        // this session; it just won't persist across a reload.
      }
      set({ preference, resolved: paint(preference) });
    },
  };
});
