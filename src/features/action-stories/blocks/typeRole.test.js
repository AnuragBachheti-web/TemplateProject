// Phase 5E Part 2 — T94 (the six type roles) and T99 (the eyebrow is one thing, not twenty-six).
//
// I2 SAYS ONE TYPE SYSTEM. The survey found the opposite: 82 hardcoded pixel sizes across 11 values
// in 38 files, and zero consumption of the `--text-*` scale that already sits in
// src/styles/realify-tokens.css. The eyebrow — a single role — was spelled 26 different ways, in
// five sizes (9/9.5/10/10.5/11px), five tracking values (0.06/0.08/0.1/0.12/0.14em), three weights
// and three colours, and several of them were not even mono.
//
// So this file asserts the RULES, and designSystem.test.jsx asserts that the codebase obeys them.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TYPE_ROLES, TYPE_ROLE_NAMES, MONO_ROLES, typeRole } from './typeRole'

const HERE = path.dirname(fileURLToPath(import.meta.url))

describe('T94 — six type roles, declared in one module', () => {
  it('is exactly the six the ruling named, and no more', () => {
    // A seventh role added quietly is how eleven DS rows became 82 pixel literals the first time.
    expect(TYPE_ROLE_NAMES).toEqual(['display', 'heading', 'body', 'label', 'figure', 'micro'])
  })

  it('every role states its face, its DS row and its rule in words', () => {
    for (const name of TYPE_ROLE_NAMES) {
      const spec = TYPE_ROLES[name]
      expect(['serif', 'sans', 'mono'], `${name} has no declared face`).toContain(spec.face)
      expect(spec.className, `${name} renders nothing`).toBeTruthy()
      expect(spec.rule.length, `${name} has no rule a reader can check against`).toBeGreaterThan(40)
      expect(spec, `${name} does not say which DS row it implements`).toHaveProperty('dsRow')
    }
  })

  it('MICRO IS A DECLARED LOCAL EXTENSION, NOT A SILENT DS VIOLATION (R81)', () => {
    // The DS scale stops at 11px. 21 usages in this template sit below it (10/9/7px), almost all of
    // them the dense grid annotations Phase 5B built. Raising them to 11px would change layout in a
    // phase whose I6 says 5C and 5D hold, on the densest surfaces in the app. So `micro` is an
    // extension, and it says so out loud with its reason attached — R81's "an honest documented
    // extension beats a silent DS violation and beats a layout change dressed as compliance".
    expect(TYPE_ROLES.micro.dsRow, 'micro claims a DS row it does not have').toBeNull()
    expect(TYPE_ROLES.micro.extension, 'micro is an extension with no stated reason').toBeTruthy()
    expect(TYPE_ROLES.micro.extension).toMatch(/DS/)

    // Every OTHER role must name a real row, so `dsRow: null` cannot become the easy way out.
    for (const name of TYPE_ROLE_NAMES.filter((n) => n !== 'micro')) {
      expect(TYPE_ROLES[name].dsRow, `${name} implements no DS row`).toBeTruthy()
      expect(TYPE_ROLES[name].extension ?? null, `${name} is not an extension and must not claim to be`).toBeNull()
    }
  })

  it('MONO IS BOUNDED TO THREE ROLES (R84) — it is the product\'s voice, not a free choice', () => {
    // The reference is mono-dominant: 5,399 var(--font-mono) against 578 sans and 179 display
    // across the 114 mockups, and this template is already closer to the reference than to the DS's
    // two mono rows. R84 follows the reference AND bounds it so it cannot drift: mono is the face
    // for label, figure and micro. Prose and headings are Inter. Titles are Fraunces. A block may
    // not reach for mono outside those roles, and that is checkable rather than a convention.
    expect(MONO_ROLES).toEqual(['label', 'figure', 'micro'])
    for (const name of TYPE_ROLE_NAMES) {
      const isMono = TYPE_ROLES[name].face === 'mono'
      expect(isMono, `${name}'s face disagrees with MONO_ROLES`).toBe(MONO_ROLES.includes(name))
    }
    expect(TYPE_ROLES.display.face, 'the title is Fraunces').toBe('serif')
    expect(TYPE_ROLES.heading.face).toBe('sans')
    expect(TYPE_ROLES.body.face, 'prose is Inter').toBe('sans')
  })

  it('returns props, and refuses a role it does not have', () => {
    expect(typeRole('body')).toHaveProperty('className')
    expect(typeRole('label').className).toContain('font-mono')
    expect(typeRole('body', 'text-rf-text-secondary').className).toContain('text-rf-text-secondary')
    expect(() => typeRole('subtitle')).toThrow(/unknown role/)
  })
})

describe('T99 — THE EYEBROW IS ONE THING (non-negotiable)', () => {
  const src = fs.readFileSync(path.join(HERE, 'typeRole.js'), 'utf8')

  it('the label role carries the DS Label spec: mono, 11px, uppercase, +0.14em', () => {
    // DS row "Label": JB Mono 500 · 11 · +14%. The 26 spellings in the survey averaged to roughly
    // this and agreed on none of it.
    const { className } = typeRole('label')
    expect(className).toContain('font-mono')
    expect(className).toContain('uppercase')
    expect(className).toMatch(/tracking-\[0\.14em\]/)
    expect(className).toMatch(/text-\[11px\]/)
  })

  it('the figure role is mono with tabular alignment, so columns of numbers line up', () => {
    const { className } = typeRole('figure')
    expect(className).toContain('font-mono')
    expect(className).toContain('tabular-nums')
  })

  it('the sizes live here and only here', () => {
    // Every px size in the app must be traceable to one of these six declarations. This asserts the
    // module actually carries them rather than delegating back out to call sites.
    const sizes = [...src.matchAll(/text-\[([0-9.]+)px\]/g)].map((m) => m[1])
    expect(new Set(sizes).size, 'the roles do not declare distinct sizes').toBeGreaterThanOrEqual(5)
  })
})
