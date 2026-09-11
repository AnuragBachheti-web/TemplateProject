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
      // Reference design system's real type roles (previously all three aliased to Inter, so the
      // reference's Fraunces-display/Inter-UI/JetBrains-Mono-data hierarchy could never show up no
      // matter what markup used `font-serif`/`font-mono`) — see src/styles/realify-tokens.css for
      // the same fonts as CSS custom properties, used where a Tailwind utility isn't the natural fit.
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Times New Roman', 'serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.03)',
        xs: '0 1px 2px rgba(10,15,26,0.04)',
        sm: '0 1px 3px rgba(10,15,26,0.06), 0 1px 2px rgba(10,15,26,0.04)',
        md: '0 4px 12px rgba(10,15,26,0.06), 0 2px 4px rgba(10,15,26,0.04)',
      },
      // One real utility (`max-w-page`) for the stage page's own content cap, backed by
      // `--page-max` in realify-tokens.css — FORENSIC_AUDIT_S9.1.md §12/§19/§25 found this same
      // 1280px cap hardcoded independently in StagePage.jsx AND StageActionBar.jsx, with the
      // matching CSS token already defined but never actually consumed. Change the page's max
      // width in exactly one place (the CSS token) from now on, never here or in a component.
      maxWidth: {
        page: 'var(--page-max)',
      },
      colors: {
        // `brand`/`brand-hover`/`brand-subtle`, `danger`/`danger-hover`/`danger-text`, and
        // `cb-200`…`cb-900` used to be defined here, reading CSS custom properties
        // (`--color-brand`, `--cb-500`, etc.) that don't exist anywhere in this repo's CSS and
        // were never referenced by a single class name in `src/` (grep-confirmed both ways) —
        // dead config inherited from the target `realifyai` app this scaffold merges into
        // (AUDIT_REPORT.md §6/§17: "the design-token surface a new engineer sees in
        // tailwind.config.js is partly fictional relative to what this app actually renders
        // with"). Removed rather than wired: this app's real color system is `rf-*`
        // (rfColorsFromTokensCss() below) end to end, and inventing values for a second,
        // unused palette just to keep the names defined would be the opposite fix.
        //
        // ── rf-* tokens — generated from tokens.css, see rfColorsFromTokensCss() above ──
        ...rfColorsFromTokensCss(),
      },
    },
  },
  plugins: [],
}