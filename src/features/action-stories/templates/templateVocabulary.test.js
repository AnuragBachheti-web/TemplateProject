// Suite 2 + 10: the guards that keep the template layer from decaying back into what it replaced —
// slot-name sprawl (835 names, 667 of them used once) and unbounded stage density (up to 35 blocks).
import { describe, it, expect } from 'vitest'
import { TEMPLATE_REGISTRY, validateTemplate } from './templateRegistry'
import { SLOT_VOCABULARY, CANONICAL_SLOT_NAMES } from './slotVocabulary'
import { BLOCK_TYPES } from '../manifests/blockTypes'
import { OPERATOR_ACTION_IDS } from '../contract/actionTypes'

const templates = Object.entries(TEMPLATE_REGISTRY)

describe('canonical templates — schema validity', () => {
  it.each(templates)('%s validates against the EXISTING manifest validator', (id, template) => {
    // Templates are manifests. If this ever needed its own validator, the abstraction would be wrong.
    const stage = template.stage ?? 'decide' // locked.v1 serves every stage, so validate it under one
    expect(validateTemplate(template, stage)).toEqual([])
  })

  it.each(templates)('%s declares a template_id matching its registry key', (id, template) => {
    expect(template.template_id).toBe(id)
  })
})

describe('slot vocabulary — the anti-sprawl guard', () => {
  it.each(templates)('%s uses only canonical slot names', (id, template) => {
    const unknown = template.blocks.map((b) => b.slotName).filter((s) => !SLOT_VOCABULARY[s])
    expect(unknown, `${id} uses non-canonical slots: ${unknown.join(', ')}`).toEqual([])
  })

  it.each(templates)('%s binds every slot to its canonical Decision Object path', (id, template) => {
    // The point of a vocabulary is that one name always means one thing. A slot bound to a
    // different path in a different template is two concepts wearing one name — exactly the
    // footStatus/footerStatus failure, one level up.
    for (const block of template.blocks) {
      expect(block.binding, `${id}.${block.slotName}`).toBe(SLOT_VOCABULARY[block.slotName].binding)
      expect(block.blockType, `${id}.${block.slotName}`).toBe(SLOT_VOCABULARY[block.slotName].blockType)
    }
  })

  it('declares every vocabulary blockType as a real registered block type', () => {
    for (const [name, spec] of Object.entries(SLOT_VOCABULARY)) {
      expect(BLOCK_TYPES, `${name}`).toContain(spec.blockType)
    }
  })

  it('stays far below the 835-name sprawl it replaced', () => {
    expect(CANONICAL_SLOT_NAMES.length).toBeLessThanOrEqual(80)
  })

  it('has no unused slots — every canonical name is actually used by a template', () => {
    const used = new Set(templates.flatMap(([, t]) => t.blocks.map((b) => b.slotName)))
    const orphans = CANONICAL_SLOT_NAMES.filter((n) => !used.has(n))
    expect(orphans, `unused canonical slots: ${orphans.join(', ')}`).toEqual([])
  })

  it('never declares a presentation concept as a business slot', () => {
    const BANNED = /(colou?r|tone|tint|hue|^bg$|border|shadow|left|right|width|height|top|bottom|css|svg|path|span|region)/i
    for (const [name, spec] of Object.entries(SLOT_VOCABULARY)) {
      expect(BANNED.test(name), `slot "${name}" reads as presentation`).toBe(false)
      expect(BANNED.test(spec.binding), `binding "${spec.binding}" reads as presentation`).toBe(false)
    }
  })

  it('marks every conditional slot with a `when` so it is OMITTED, not emptied', () => {
    for (const [id, template] of templates) {
      for (const block of template.blocks) {
        if (SLOT_VOCABULARY[block.slotName].tier === 'conditional') {
          expect(block.when, `${id}.${block.slotName} is conditional but has no when`).toBeTruthy()
        }
      }
    }
  })
})

describe('density budgets — templates must not become the new dumping ground', () => {
  // Deliberately generous versus what they replace (decide averaged 20.2 blocks and peaked at 35;
  // execute peaked at 32). The budget is a ratchet against regression, not a layout optimiser.
  const BUDGETS = {
    'reason.v1': { blocks: 12, actions: 0 },
    'analyze.compare.v1': { blocks: 16, actions: 0 },
    'decide.slate.v1': { blocks: 20, actions: 6 },
    'execute.bridge.v1': { blocks: 16, actions: 3 },
    'locked.v1': { blocks: 4, actions: 0 },
  }

  it.each(templates)('%s stays within its block and action budget', (id, template) => {
    const budget = BUDGETS[id]
    expect(budget, `no density budget declared for ${id}`).toBeTruthy()
    expect(template.blocks.length, `${id} block count`).toBeLessThanOrEqual(budget.blocks)
    expect((template.actions ?? []).length, `${id} action count`).toBeLessThanOrEqual(budget.actions)
  })

  it.each(templates)('%s never declares the same slot twice', (id, template) => {
    const names = template.blocks.map((b) => b.slotName)
    expect(new Set(names).size, `${id} has duplicate slots`).toBe(names.length)
  })

  it.each(templates)('%s declares only real operator actions', (id, template) => {
    for (const action of template.actions ?? []) {
      expect(OPERATOR_ACTION_IDS, `${id} action "${action.id}"`).toContain(action.id)
      // `action` (the backend operation type) must equal the id — a template that renamed one
      // would dispatch an operation the contract does not describe.
      expect(action.action).toBe(action.id)
    }
  })

  it('locked.v1 exposes no operator action at all', () => {
    expect(TEMPLATE_REGISTRY['locked.v1'].actions).toEqual([])
  })

  // Derived at runtime by contract/deriveEligibility.js — `approve` since Phase 1, `approve_selected`
  // since Phase 2. A template `when` on either would be a second producer of a value that must have
  // exactly one.
  const DERIVED_ACTIONS = ['approve', 'approve_selected']

  it('every PAYLOAD-DRIVEN action gates on explicit eligibility, fail-closed', () => {
    for (const [id, template] of templates) {
      for (const action of (template.actions ?? []).filter((a) => !DERIVED_ACTIONS.includes(a.id))) {
        const json = JSON.stringify(action.when)
        expect(action.when, `${id}.${action.id} has no when gate`).toBeTruthy()
        // `exists` + `eq true`, never `ne` — `ne` is satisfied by a MISSING value, which is exactly
        // how 40 of the previous corpus's 52 actions ended up unconditionally enabled.
        expect(json, `${id}.${action.id}`).toContain(`"eligibility.${action.id}.allowed"`)
        expect(json, `${id}.${action.id} must require presence`).toContain('"exists"')
        expect(json, `${id}.${action.id} must not use ne`).not.toContain('"ne"')
      }
    }
  })

  it('the derived actions declare NO eligibility condition — that would be a second producer', () => {
    // `approve` is derived at runtime by contract/deriveEligibility.js. A `when` reading
    // `eligibility.approve.allowed` would be exactly the payload-trusting read this phase deleted:
    // it passed a payload whose guardrail verdict said beyond_limits but whose eligibility claimed
    // allowed. There must be no path back to that, in any template.
    for (const [id, template] of templates) {
      for (const action of (template.actions ?? []).filter((a) => DERIVED_ACTIONS.includes(a.id))) {
        expect(action.when, `${id}.${action.id} must not gate on a template condition`).toBeUndefined()
      }
    }
  })

  it('no template anywhere reads eligibility.approve.allowed', () => {
    // Asserted over the whole template, not just `actions[]` — a block `when`, a label binding or a
    // future slot reading that path would reintroduce the same trust.
    for (const [id, template] of templates) {
      expect(JSON.stringify(template), `${id} reads the payload's own approve eligibility`).not.toContain(
        'eligibility.approve.allowed',
      )
      expect(JSON.stringify(template), `${id} reads the payload's own approve_selected eligibility`).not.toContain(
        'eligibility.approve_selected.allowed',
      )
    }
  })

  it('approve keeps its disabledReasonBinding — copy is not a gate', () => {
    // The 3 shipped beyond_limits objects carry real business prose in
    // `eligibility.approve.blocked_reason`. The DECISION is derived; the MESSAGE is still the
    // corpus's, which is why an operator reads why rather than generic derived text.
    for (const [id, template] of templates) {
      for (const action of (template.actions ?? []).filter((a) => DERIVED_ACTIONS.includes(a.id))) {
        expect(action.disabledReasonBinding, `${id}.${action.id} lost its reason copy`).toBe(
          `eligibility.${action.id}.blocked_reason`,
        )
      }
    }
  })
})
