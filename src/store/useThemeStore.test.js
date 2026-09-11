// @vitest-environment jsdom
//
// Regression: dark-mode tokens were fully authored (tokens.css's [data-theme="dark"] block, every
// block's own dark: variants) with no way to ever activate them — tailwind.config.js's own comment
// named useThemeStore.js's paint() as the mechanism, but that file didn't exist (AUDIT_REPORT.md
// §6/§17/§25). These tests verify the real activation path: it actually writes data-theme onto
// <html>, persists an explicit choice, and falls back to system preference correctly.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// This jsdom version doesn't provide `window.localStorage` out of the box in this vitest setup
// (confirmed: `typeof window.localStorage === 'undefined'`, unrelated to origin/URL) — a real
// browser always has one, so production code is unaffected; a minimal in-memory polyfill here is
// only to make this one test file's assertions about persistence meaningful.
if (typeof window !== 'undefined' && !window.localStorage) {
  const store = new Map();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
  });
}

function freshStore() {
  vi.resetModules();
  return import('./useThemeStore.js');
}

describe('useThemeStore — activation path', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to "system" with no stored preference, and paints a resolved light/dark value onto <html>', async () => {
    const { useThemeStore } = await freshStore();
    expect(useThemeStore.getState().preference).toBe('system');
    expect(['light', 'dark']).toContain(document.documentElement.dataset.theme);
  });

  it('setTheme("dark") writes data-theme="dark" onto <html> immediately', async () => {
    const { useThemeStore } = await freshStore();
    useThemeStore.getState().setTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(useThemeStore.getState().resolved).toBe('dark');
  });

  it('setTheme("light") writes data-theme="light" onto <html> immediately', async () => {
    const { useThemeStore } = await freshStore();
    useThemeStore.getState().setTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('persists an explicit choice to localStorage and restores it on the next "load"', async () => {
    const { useThemeStore: store1 } = await freshStore();
    store1.getState().setTheme('dark');
    expect(window.localStorage.getItem('rf-theme')).toBe('dark');

    const { useThemeStore: store2 } = await freshStore();
    expect(store2.getState().preference).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('never throws even if localStorage is unavailable', async () => {
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('storage blocked');
      },
      configurable: true,
    });
    try {
      const { useThemeStore } = await freshStore();
      expect(() => useThemeStore.getState().setTheme('dark')).not.toThrow();
    } finally {
      Object.defineProperty(window, 'localStorage', { value: original, configurable: true });
    }
  });
});
