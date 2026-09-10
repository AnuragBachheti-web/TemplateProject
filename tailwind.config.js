import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * `rf-*` Tailwind colours, generated from `src/styles/tokens.css` rather than hand-listed — so this
 * block cannot drift from the tokens the Y1.1 pipeline actually produces. Re-reads the file on every
 * config load (including a dev-server restart after `npm run generate-tokens`), same as any other
 * `content`-scanned source.
 *
 * `tokens.css` carries every colour twice: `--rf-x: <hex or rgba()>` (the value every other consumer
 * expects, untouched) and `--rf-x-rgb: "r g b"` (space-separated components, added specifically so
 * Tailwind's `rgb(var(--x) / <alpha-value>)` opacity-modifier syntax has something valid to read —
 * `rgb(#FFFFFF / <alpha-value>)` is not legal CSS). Only the `-rgb` companions are read here; the
 * `-x` bare names are skipped so a real token can never collide with its own plumbing.
 *
 * Two tokens are the deliberate exception: `--rf-brand-tint-08` and `--rf-brand-tint-16` bake in a
 * DIFFERENT alpha per theme (0.08 light / 0.12 dark, 0.16 / 0.20), not just a different RGB —
 * something Tailwind's `<alpha-value>` cannot express, since it is substituted once at the utility
 * class's call site rather than re-read per theme. Routing them through `rgb(var(...) / <alpha-value>)`
 * would default an unmodified `bg-rf-brand-tint-08` to fully opaque instead of the intended tint. They
 * reference the unmodified `rgba()` custom property directly instead, which is exactly as
 * theme-reactive as every other use of that property already is.
 */
function rfColorsFromTokensCss() {
  const tokensPath = path.join(__dirname, 'src', 'styles', 'tokens.css');
  const css = fs.readFileSync(tokensPath, 'utf-8');
  const rootBlock = css.split('[data-theme="dark"]')[0];
  const names = new Set();
  for (const match of rootBlock.matchAll(/--(\S+?):\s*[^;]+;/g)) {
    const name = match[1];
    if (name.startsWith('rf-') && name.endsWith('-rgb')) {
      names.add(name.slice(0, -'-rgb'.length));
    }
  }

  const ALPHA_VARIES_BY_THEME = new Set(['rf-brand-tint-08', 'rf-brand-tint-16']);
  const colors = {};
  for (const name of [...names].sort()) {
    colors[name] = ALPHA_VARIES_BY_THEME.has(name)
      ? `var(--${name})`
      : `rgb(var(--${name}-rgb) / <alpha-value>)`;
  }
  return colors;
}

/** @type {import('tailwindcss').Config} */
export default {
  // Single dark-mode mechanism: the `data-theme="dark"` attribute on <html>, written by
  // useThemeStore.js's paint(). No `.dark` class anywhere — see README "Known gaps" history.
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Inter', 'sans-serif'],
        mono: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.03)',
      },
      colors: {
        // ── Brand palette — edit CSS vars in src/index.css to retheme the whole app ──
        brand: 'rgb(var(--color-brand) / <alpha-value>)',
        'brand-hover': 'rgb(var(--color-brand-hover) / <alpha-value>)',
        'brand-subtle': 'rgb(var(--color-brand-subtle) / <alpha-value>)',
        // ── Danger palette — edit CSS vars in src/index.css to retheme destructive UI ──
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        'danger-hover': 'rgb(var(--color-danger-hover) / <alpha-value>)',
        'danger-text': 'rgb(var(--color-danger-text) / <alpha-value>)',
        // ── Cobalt-blue accent palette — edit CSS vars in src/index.css ──
        'cb-200': 'rgb(var(--cb-200) / <alpha-value>)',
        'cb-300': 'rgb(var(--cb-300) / <alpha-value>)',
        'cb-400': 'rgb(var(--cb-400) / <alpha-value>)',
        'cb-500': 'rgb(var(--cb-500) / <alpha-value>)',
        'cb-600': 'rgb(var(--cb-600) / <alpha-value>)',
        'cb-700': 'rgb(var(--cb-700) / <alpha-value>)',
        'cb-800': 'rgb(var(--cb-800) / <alpha-value>)',
        'cb-850': 'rgb(var(--cb-850) / <alpha-value>)',
        'cb-900': 'rgb(var(--cb-900) / <alpha-value>)',
        // ── rf-* tokens — generated from tokens.css, see rfColorsFromTokensCss() above ──
        ...rfColorsFromTokensCss(),
      },
    },
  },
  plugins: [],
}