import { describe, it, expect } from 'vitest'
import { validateManifest } from './validateManifest'

const validManifest = {
  code: 'S9.11',
  name: 'Repricing',
  stageKey: 'analyze',
  blocks: [
    { slotName: 'execution_lane', blockType: 'text', binding: 'data.execLabel' },
    { slotName: 'rows', blockType: 'itemQueue', binding: 'data.rows' },
  ],
}

describe('validateManifest', () => {
  it('returns no problems for a valid manifest', () => {
    expect(validateManifest(validManifest)).toEqual([])
  })

  it('never throws on garbage input', () => {
    for (const bad of [null, undefined, 42, 'nope', [], () => {}]) {
      expect(() => validateManifest(bad)).not.toThrow()
      expect(validateManifest(bad).length).toBeGreaterThan(0)
    }
  })

  it('flags a missing/invalid stageKey', () => {
    const problems = validateManifest({ ...validManifest, stageKey: 'nonsense' })
    expect(problems.some((p) => p.includes('stageKey'))).toBe(true)
  })

  it('flags an unknown blockType instead of throwing', () => {
    const problems = validateManifest({
      ...validManifest,
      blocks: [{ slotName: 'x', blockType: 'madeUpType', binding: 'data.x' }],
    })
    expect(problems.some((p) => p.includes('unknown blockType'))).toBe(true)
  })

  it('flags a duplicate slotName', () => {
    const problems = validateManifest({
      ...validManifest,
      blocks: [
        { slotName: 'dup', blockType: 'text', binding: 'data.a' },
        { slotName: 'dup', blockType: 'text', binding: 'data.b' },
      ],
    })
    expect(problems.some((p) => p.includes('duplicate slotName'))).toBe(true)
  })

  it('flags a block missing its binding', () => {
    const problems = validateManifest({
      ...validManifest,
      blocks: [{ slotName: 'x', blockType: 'text', binding: '' }],
    })
    expect(problems.some((p) => p.includes('binding'))).toBe(true)
  })

  describe('optional identity/semantic-placement fields (all additive — absent is always valid)', () => {
    it('accepts a manifest with no headline/role/region/layout/sections at all (old-shape manifest)', () => {
      expect(validateManifest(validManifest)).toEqual([])
    })

    it('accepts a valid "headline" distinct from "name"', () => {
      expect(validateManifest({ ...validManifest, headline: 'Quarterly assortment review — 214 active SKUs' })).toEqual([])
    })

    it('flags a non-string "headline" when present', () => {
      const problems = validateManifest({ ...validManifest, headline: 42 })
      expect(problems.some((p) => p.includes('headline'))).toBe(true)
    })

    it('accepts a valid block "role"/"region"/"layout"', () => {
      const manifest = {
        ...validManifest,
        blocks: [{ slotName: 'heroTitle', blockType: 'text', binding: 'data.heroTitle', role: 'hero', region: 'main', layout: { group: 'recommendation', span: 12 } }],
      }
      expect(validateManifest(manifest)).toEqual([])
    })

    it('flags an invalid block "region" (must be main|rail)', () => {
      const problems = validateManifest({
        ...validManifest,
        blocks: [{ slotName: 'x', blockType: 'text', binding: 'data.x', region: 'sidebar' }],
      })
      expect(problems.some((p) => p.includes('"region"'))).toBe(true)
    })

    it('flags an out-of-range block "layout.span" (must be 1-12)', () => {
      const problems = validateManifest({
        ...validManifest,
        blocks: [{ slotName: 'x', blockType: 'text', binding: 'data.x', layout: { group: 'g', span: 13 } }],
      })
      expect(problems.some((p) => p.includes('layout.span'))).toBe(true)
    })

    it('accepts valid declared "sections" with a "region"', () => {
      const manifest = {
        ...validManifest,
        sections: [{ id: 'guardrails', title: 'Guardrails', region: 'rail' }, { id: 'details', title: 'Details', region: 'main' }],
      }
      expect(validateManifest(manifest)).toEqual([])
    })

    it('flags a section with an invalid "region"', () => {
      const problems = validateManifest({
        ...validManifest,
        sections: [{ id: 'guardrails', title: 'Guardrails', region: 'sidebar' }],
      })
      expect(problems.some((p) => p.includes('"region"'))).toBe(true)
    })

    it('flags a non-array "sections"', () => {
      const problems = validateManifest({ ...validManifest, sections: 'nope' })
      expect(problems.some((p) => p.includes('"sections"'))).toBe(true)
    })
  })

  describe('block.dependencies (DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §5/§9/§11)', () => {
    it('accepts a block whose dependencies reference other real slotNames in this same manifest', () => {
      const manifest = {
        ...validManifest,
        blocks: [
          { slotName: 'tol', blockType: 'slider', binding: 'data.tol', dependencies: ['slate'] },
          { slotName: 'slate', blockType: 'table', binding: 'data.slate' },
        ],
      }
      expect(validateManifest(manifest)).toEqual([])
    })

    it('flags a dependency referencing a slotName that does not exist in this manifest', () => {
      const problems = validateManifest({
        ...validManifest,
        blocks: [{ slotName: 'tol', blockType: 'slider', binding: 'data.tol', dependencies: ['doesNotExist'] }],
      })
      expect(problems.some((p) => p.includes('dependencies') && p.includes('doesNotExist'))).toBe(true)
    })

    it('flags a non-array "dependencies"', () => {
      const problems = validateManifest({
        ...validManifest,
        blocks: [{ slotName: 'tol', blockType: 'slider', binding: 'data.tol', dependencies: 'slate' }],
      })
      expect(problems.some((p) => p.includes('dependencies'))).toBe(true)
    })

    it('is fully optional — a manifest with no block.dependencies anywhere is still valid', () => {
      expect(validateManifest(validManifest)).toEqual([])
    })
  })
})
