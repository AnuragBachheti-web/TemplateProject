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
})
