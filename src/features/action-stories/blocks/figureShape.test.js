// Phase 5E Part 2 — T98. WHAT MAKES A STRING A FIGURE, and the line it must not cross.
//
// Ruling R87. R2 forbids recovering a NUMBER from a display string — parsing "+$41K" into 41000 and
// computing with it. Recognising that a string IS a figure, so it renders in mono with tabular
// alignment and may carry its own sign's colour, computes nothing and asserts no value. R87's test
// of the difference: whether any arithmetic follows. Here none does, and none may — which is what
// the last test in this file exists to keep true.
//
// Why it was needed at all: `isNumericValue` (Number.isFinite(Number(v))) calls "−$4.6K" not a
// number, so 269 of the 275 coloured cells in the corpus were rendering in the PROSE role. Gating
// tone on that role would have stripped the colour from every real figure in the app.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isFigureText } from './figureShape'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const AS = path.resolve(HERE, '..')

/** Source with comment lines removed, so a rule quoted in prose is not read as a breach of it. */
const code = (text) => text.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

describe('T98 — a figure is recognised by SHAPE, in one place', () => {
  it('recognises the corpus\'s own formatted figures', () => {
    for (const v of ['−$4.6K', '+12.4%', '$511K', '42', '3.1%', '−$2,210 / day', '640 PPM', '1,400 u', '18%']) {
      expect(isFigureText(v), `${JSON.stringify(v)} is a figure`).toBe(true)
    }
  })

  it('refuses prose, labels and names — including the ones that broke deltaTone', () => {
    for (const v of [
      'Ridgeline mug top-up → FBA-East',
      'Defect rate 640 PPM above the Tier 3 ceiling and rising for six quarters.',
      'The base of the range. Buffer sized to P75 demand, topped up on the weekly cycle.',
      'Max volume loss',
      'Ignore · accept the share loss',
      'Drop',
      'Spawn remediation cards',
    ]) {
      expect(isFigureText(v), `${JSON.stringify(v.slice(0, 40))} is not a figure`).toBe(false)
    }
  })

  it('is total, and always answers with a boolean', () => {
    for (const v of [null, undefined, '', '   ', 0, 42, -1, {}, [], [1, 2], true, NaN, Infinity]) {
      expect(typeof isFigureText(v), `${JSON.stringify(v)} produced a non-boolean`).toBe('boolean')
    }
    expect(isFigureText('')).toBe(false)
    expect(isFigureText(null)).toBe(false)
  })

  it('IS NEVER CONSULTED FOR A VALUE (R87) — nothing numeric may be derived from it', () => {
    // THE ASSERTION THAT KEEPS THIS ON THE RIGHT SIDE OF R2. Two halves.
    //
    // 1. The module cannot hand anyone a number. It exports one boolean predicate and nothing that
    //    parses, converts, sums or compares — so there is no value here to misuse in the first
    //    place. If a future edit adds `parseFigure`, this fails and the reviewer has to argue for
    //    it in the open rather than acquire it by import.
    const src = fs.readFileSync(path.join(HERE, 'figureShape.js'), 'utf8')
    const exported = [...src.matchAll(/export\s+(?:function|const)\s+([A-Za-z0-9_]+)/g)].map((m) => m[1])
    expect(exported, 'figureShape exports something other than the predicate').toEqual(['isFigureText'])
    // CODE ONLY. The first run of this test failed on the module's own header, which quotes the
    // rule it is enforcing — a prohibition written down is documentation, not a violation of
    // itself. Same distinction designSystem.test.jsx draws for class literals.
    expect(code(src), 'figureShape converts its input to a number').not.toMatch(/\b(parseFloat|parseInt|Number\s*\()/)

    // 2. No CALLER may combine the recognition with a conversion. The predicate answers a
    //    typography question; an arithmetic expression next to it means someone has started
    //    treating the string as a quantity, which is exactly R2's line.
    const files = []
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\.(js|jsx)$/.test(entry.name)) files.push(full)
      }
    }
    walk(AS)
    const offenders = []
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      if (!text.includes('isFigureText')) continue
      for (const [i, line] of text.split('\n').entries()) {
        if (!line.includes('isFigureText')) continue
        if (/^\s*(\/\/|\*)/.test(line)) continue
        if (/\b(parseFloat|parseInt)\s*\(/.test(line) || /\bNumber\s*\(/.test(line)) {
          offenders.push(`${path.relative(AS, file)}:${i + 1} — a figure's SHAPE is being turned into a value`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
