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
import { TYPE_ROLES, TYPE_ROLE_NAMES, typeRole } from './typeRole'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.join(HERE, 'typeRole.js'), 'utf8')

// ============================================================================================
// T94 AND T99 ARE RETIRED HERE — PHASE 6 REPLACED THEM, IT DID NOT DELETE THEM.
// ============================================================================================
//
// Both asserted this module's Phase 5E resolution against docs/design-system/06-typography.html:
// six roles, mono on label/figure/micro (R84), the eyebrow at JB Mono 11px with +0.14em tracking.
// Every one of those assertions was correct for its source and is wrong for this one. The design
// source changed — the shipping product is Inter throughout — so:
//
//     T94's "exactly six roles"        -> seven. R95 split reading (15px) from scanning (13px),
//                                        because this app is both kinds of surface.
//     T94's MONO_ROLES == 3            -> one. I3 confines mono to figures; R84 is reversed, and
//                                        typeRole.js says so where R84 is recorded.
//     T94's `dsRow` on every role      -> `productRow`. A role now cites the product hierarchy row
//                                        it implements, not a row of the old document.
//     T99's mono/11px/+0.14em eyebrow  -> Inter 12 semibold, +0.04em. The label is a label.
//
// THEIR SUCCESSOR IS phase6.test.jsx's T103, which asserts the same three things this file was
// written to protect — one type system, every role declared in one place, no component choosing a
// face or a size — against the source that is now authoritative. What survives unchanged is below:
// the parts that are about how roles WORK rather than what they resolve to, which is exactly the
// half of R84 that made reversing the other half a one-file edit.

describe('T94/T103 — the type system is one module, whatever the source says', () => {
  it('every role is declared with a face, a size, a rule and a product row', () => {
    for (const name of TYPE_ROLE_NAMES) {
      const spec = TYPE_ROLES[name]
      expect(['sans', 'mono'], `${name} has no declared face`).toContain(spec.face)
      expect(spec.className, `${name} renders nothing`).toBeTruthy()
      expect(typeof spec.px, `${name} has no size a test can reason about`).toBe('number')
      expect(spec.rule.length, `${name} has no rule a reader can check against`).toBeGreaterThan(40)
      expect(spec, `${name} does not say which product row it implements`).toHaveProperty('productRow')
    }
  })

  it('an extension states its reason, and nothing else claims to be one', () => {
    // Unchanged in substance from Phase 5E's R81 assertion: a role outside the scale must say so
    // out loud and say why, so `productRow: null` cannot become the easy way out. Only the name of
    // the field changed with the source.
    expect(TYPE_ROLES.micro.productRow, 'micro claims a product row it does not have').toBeNull()
    expect(TYPE_ROLES.micro.extension, 'micro is an extension with no stated reason').toBeTruthy()
    for (const name of TYPE_ROLE_NAMES.filter((n) => n !== 'micro')) {
      expect(TYPE_ROLES[name].productRow, `${name} implements no product row`).toBeTruthy()
      expect(TYPE_ROLES[name].extension ?? null, `${name} must not claim to be an extension`).toBeNull()
    }
  })

  it('returns props, and refuses a role it does not have', () => {
    expect(typeRole('body')).toHaveProperty('className')
    expect(typeRole('body', 'text-rf-text-secondary').className).toContain('text-rf-text-secondary')
    expect(() => typeRole('subtitle')).toThrow(/unknown role/)
  })

  it('the sizes live here and only here', () => {
    const sizes = [...src.matchAll(/text-\[([0-9.]+)px\]/g)].map((m) => m[1])
    expect(new Set(sizes).size, 'the roles do not declare distinct sizes').toBeGreaterThanOrEqual(5)
  })
})
