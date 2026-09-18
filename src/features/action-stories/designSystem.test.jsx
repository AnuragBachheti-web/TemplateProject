// Phase 5E Part 2 — T95 (no literals), T97 (the -700 text steps) and T100 (the browser half).
//
// WHAT THIS PHASE ACTUALLY IS. Not "apply the design system" — 21 of the 22 light-mode `--rf-*`
// tokens already hold exact DS values, byte for byte. THE COLOUR LAYER IS NOT WRONG, IT IS
// INCOMPLETE: the -700 text steps were missing, the module hues were unmapped, and the type scale
// existed in src/styles/realify-tokens.css while Action Stories consumed none of it and spelled 82
// pixel sizes by hand instead.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '../../..')
const AS = HERE
const TOKENS = fs.readFileSync(path.join(REPO_ROOT, 'src/styles/tokens.css'), 'utf8')

/** Every source file this phase is responsible for. */
function sourceFiles() {
  const out = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__corpus__') continue
        walk(full)
      } else if (/\.(?:js|jsx)$/.test(entry.name) && !/\.test\.(?:js|jsx)$/.test(entry.name)) {
        // .js TOO, not just .jsx. The first version of this scan looked only at components and so
        // never saw statusTone.js — which is where almost every status text colour in the app
        // actually comes from. A scan that misses the module holding the rule is the adjacency
        // failure T79 is about, arriving as a glob.
        out.push(full)
      }
    }
  }
  walk(AS)
  return out
}
// THE TWO FILES THAT MAY SPELL A SIZE, because they are the files that decide them: typeRole.js
// for text and glyphSize.js for icon glyphs. Exempting the modules that own the scales is not a
// loophole in the rule — it is the rule: the sizes live in one place each, and this names them.
const OWNS_THE_SCALE = ['blocks/typeRole.js', 'blocks/glyphSize.js']
const FILES = sourceFiles().filter((f) => !OWNS_THE_SCALE.some((o) => f.endsWith(o)))
const rel = (f) => path.relative(AS, f)

/** Class-carrying code only — a rule quoted in a comment is documentation, not a literal. */
function codeLines(text) {
  return text
    .split('\n')
    .map((line, i) => [i + 1, line])
    .filter(([, line]) => !/^\s*(\/\/|\*|\/\*)/.test(line))
}

describe('T95 — the sizes and the palette live in the token layer, not in 38 files', () => {
  it('measures a real codebase, so this cannot pass vacuously', () => {
    expect(FILES.length).toBeGreaterThan(30)
  })

  it('no component spells a text size in pixels', () => {
    // 157 of these across 18 distinct values when the phase started — including half-pixel steps
    // (12.5, 11.5, 10.5, 9.5, 8.5) that exist for no stated reason. A size belongs to a ROLE; a
    // component asking for 10.5px is a component inventing a seventh role in private.
    //
    // AN ICON GLYPH IS NOT TEXT, and it goes through glyphSize.js. This check used to exempt any
    // LINE carrying a literal `fa-*` class — and that exemption silently failed on the two Alert
    // and Toast icons whose class arrives through a variable (`t.icon`), which is how 58 tofu boxes
    // reached the screen. A structural answer replaced the heuristic one: the bare form is banned
    // everywhere, and an icon says `glyph(10)`, so nothing has to be inferred from a line's shape.
    const offenders = []
    for (const file of FILES) {
      for (const [n, line] of codeLines(fs.readFileSync(file, 'utf8'))) {
        for (const m of line.matchAll(/text-\[[0-9.]+px\]/g)) offenders.push(`${rel(file)}:${n} ${m[0]}`)
      }
    }
    expect(offenders, 'a pixel size is still being spelled in a component').toEqual([])
  })

  it('no component spells letter-spacing, which is the eyebrow drifting again (T99)', () => {
    const offenders = []
    for (const file of FILES) {
      for (const [n, line] of codeLines(fs.readFileSync(file, 'utf8'))) {
        for (const m of line.matchAll(/tracking-\[[0-9.]+em\]/g)) offenders.push(`${rel(file)}:${n} ${m[0]}`)
      }
    }
    expect(offenders, 'tracking is still being chosen per call site').toEqual([])
  })

  it('no component reaches for a raw Tailwind palette colour (I1: TOKENS ONLY)', () => {
    // 21 of these when the phase started — `text-rose-400`, `bg-amber-50`, `text-emerald-700` — a
    // second, parallel status palette living beside the real one. statusTone.js's own comment has
    // warned against exactly this since Phase 3B.
    const RAW = /\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:rose|emerald|green|amber|yellow|slate|gray|grey|zinc|neutral|stone|blue|sky|cyan|teal|violet|purple|indigo|fuchsia|pink|red|orange|lime)-(?:\d{2,3})\b/g
    const offenders = []
    for (const file of FILES) {
      for (const [n, line] of codeLines(fs.readFileSync(file, 'utf8'))) {
        for (const m of line.matchAll(RAW)) offenders.push(`${rel(file)}:${n} ${m[0]}`)
      }
    }
    expect(offenders, 'a raw palette colour is still in a component').toEqual([])
  })
})

describe('T97 — TEXT USES THE -700 STEP, WHICH IS AN ACCESSIBILITY FIX (R83)', () => {
  it('the -700 text tokens exist and hold the DS\'s own values', () => {
    // From 05-color.html's contrast matrix: green-700 #046c46 is AAA 7.4:1 on white and is what the
    // DS calls "success message body text"; amber-700 #a15c07 is AA 5.1:1; rose-700 #9f1239.
    for (const [token, value] of [
      ['--rf-status-success-text', '#046C46'],
      ['--rf-status-warning-text', '#A15C07'],
      ['--rf-status-critical-text', '#9F1239'],
    ]) {
      expect(TOKENS, `${token} is missing`).toContain(`${token}:`)
      expect(TOKENS.toUpperCase(), `${token} does not hold the DS value`).toContain(value)
      expect(TOKENS, `${token} has no -rgb companion, so Tailwind cannot see it`)
        .toContain(`${token}-rgb:`)
    }
  })

  it('WHY: the -500 steps fail the DS\'s own contrast matrix as text on white', () => {
    // amber-500 is 2.3:1 and green-500 is 3.1:1 against white — the DS marks both "large only" and
    // says amber is for "icons and large UI only". This template was painting 11-13px text with
    // them. The reference agrees overwhelmingly and always has: as a TEXT colour across the 114
    // mockups, green-700 appears 95 times and green-500 zero; rose-700 148 and rose-500 zero;
    // amber-700 56 against amber-500 twice.
    //
    // This is the one place in Part 2 where rendered colour changes ON PURPOSE.
    const contrast = (hex) => {
      const c = hex.replace('#', '').match(/../g).map((h) => {
        const v = parseInt(h, 16) / 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      })
      const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
      return (1.0 + 0.05) / (L + 0.05)
    }
    expect(contrast('#10A36D')).toBeLessThan(4.5) // green-500: the defect
    expect(contrast('#F59E0B')).toBeLessThan(4.5) // amber-500: the worse defect
    expect(contrast('#046C46'), 'green-700 must clear AA for body text').toBeGreaterThanOrEqual(4.5)
    expect(contrast('#A15C07'), 'amber-700 must clear AA for body text').toBeGreaterThanOrEqual(4.5)
    expect(contrast('#9F1239'), 'rose-700 must clear AA for body text').toBeGreaterThanOrEqual(4.5)
  })

  it('no call site colours TEXT with a -500 status token', () => {
    // THE DISTINCTION IS STRUCTURAL, NOT A HEURISTIC. `text-rf-status-critical` used to mean both
    // "colour this sentence" and "colour this glyph", so a contrast rule could only be enforced by
    // guessing from context — which is exactly how the -500 steps ended up on 11px text. There are
    // now two names for the two jobs: `-text` (the AA-clearing -700 step) and `-icon` (the -500
    // step, same value as before, for glyphs, dots and bars). The bare form is banned outright, so
    // no exemption list is needed and no reviewer has to adjudicate a call site.
    const offenders = []
    for (const file of FILES) {
      for (const [n, line] of codeLines(fs.readFileSync(file, 'utf8'))) {
        for (const m of line.matchAll(/\btext-rf-status-(?:critical|success|warning|purple)\b(?!-(?:text|icon))/g)) {
          offenders.push(`${rel(file)}:${n} ${m[0]} — say -text or -icon`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('but KEEPS the -500 steps for what the DS says they are for', () => {
    // Icons, dots, bars, borders and large UI. Removing them entirely would be over-correcting a
    // contrast rule into a colour ban, and the dot beside a status word is the "pair with icon"
    // the DS explicitly asks for.
    const uses = []
    for (const file of [...FILES, path.join(AS, 'blocks/statusTone.js'), path.join(AS, 'blocks/deltaTone.js')]) {
      if (!fs.existsSync(file)) continue
      for (const [, line] of codeLines(fs.readFileSync(file, 'utf8'))) {
        for (const m of line.matchAll(/\b(?:bg|border|ring|fill|stroke)-rf-status-[a-z]+\b/g)) uses.push(m[0])
      }
    }
    expect(uses.length, 'the -500 steps have been removed entirely, which over-corrects R83').toBeGreaterThan(0)
  })
})

describe('T100 — the browser half runs in LIGHT MODE, explicitly (R85)', () => {
  const smoke = fs.readFileSync(path.join(REPO_ROOT, 'scripts/smoke.mjs'), 'utf8')

  it('the harness sets the theme rather than inheriting the system\'s', () => {
    // R85: the DS is sourced for light only, so light is the subject. A gate that renders whatever
    // the CI machine's OS happens to prefer is measuring an inference.
    expect(smoke, 'the smoke harness does not set a theme').toMatch(/data-theme[^\n]*light|setTheme|THEME/)
    expect(smoke, 'the colour gate is not in the smoke run').toContain('T100')
  })

  it('T100 can fail the run, not just report', () => {
    // Same requirement R65 put on the layout gate: a browser check that reports without failing is
    // the vacuous pass in a new costume.
    expect(smoke).toMatch(/failures\.length > 0[\s\S]{0,200}fail\(/)
  })
})
