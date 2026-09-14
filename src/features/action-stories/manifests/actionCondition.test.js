import { describe, it, expect } from 'vitest'
import { evaluateCondition, validateCondition, CONDITION_OPS } from './actionCondition'

describe('evaluateCondition', () => {
  it('is always true when no condition is given (no gate = always eligible)', () => {
    expect(evaluateCondition(undefined, { data: {} })).toBe(true)
    expect(evaluateCondition(null, { data: {} })).toBe(true)
  })

  describe('leaf operators', () => {
    const fixture = { data: { blocked: true, canApprove: false, score: 42, tag: 'high', tags: ['a', 'b'] } }

    it('eq / ne', () => {
      expect(evaluateCondition({ path: 'data.tag', op: 'eq', value: 'high' }, fixture)).toBe(true)
      expect(evaluateCondition({ path: 'data.tag', op: 'eq', value: 'low' }, fixture)).toBe(false)
      expect(evaluateCondition({ path: 'data.blocked', op: 'ne', value: true }, fixture)).toBe(false)
      expect(evaluateCondition({ path: 'data.blocked', op: 'ne', value: false }, fixture)).toBe(true)
    })

    it('ne treats a MISSING value as satisfying the condition (absence is not itself a block)', () => {
      expect(evaluateCondition({ path: 'data.doesNotExist', op: 'ne', value: true }, fixture)).toBe(true)
    })

    it('eq treats a MISSING value as NOT satisfying an equality claim', () => {
      expect(evaluateCondition({ path: 'data.doesNotExist', op: 'eq', value: true }, fixture)).toBe(false)
    })

    it('exists / notExists', () => {
      expect(evaluateCondition({ path: 'data.score', op: 'exists' }, fixture)).toBe(true)
      expect(evaluateCondition({ path: 'data.missing', op: 'exists' }, fixture)).toBe(false)
      expect(evaluateCondition({ path: 'data.missing', op: 'notExists' }, fixture)).toBe(true)
      expect(evaluateCondition({ path: 'data.score', op: 'notExists' }, fixture)).toBe(false)
    })

    it('truthy / falsy', () => {
      expect(evaluateCondition({ path: 'data.blocked', op: 'truthy' }, fixture)).toBe(true)
      expect(evaluateCondition({ path: 'data.canApprove', op: 'falsy' }, fixture)).toBe(true)
    })

    it('gt / gte / lt / lte, and false (never a crash) against a non-numeric or missing value', () => {
      expect(evaluateCondition({ path: 'data.score', op: 'gt', value: 10 }, fixture)).toBe(true)
      expect(evaluateCondition({ path: 'data.score', op: 'lte', value: 42 }, fixture)).toBe(true)
      expect(evaluateCondition({ path: 'data.score', op: 'lt', value: 42 }, fixture)).toBe(false)
      expect(evaluateCondition({ path: 'data.tag', op: 'gt', value: 1 }, fixture)).toBe(false)
      expect(evaluateCondition({ path: 'data.missing', op: 'gt', value: 1 }, fixture)).toBe(false)
    })

    it('in / notIn', () => {
      expect(evaluateCondition({ path: 'data.tag', op: 'in', value: ['high', 'medium'] }, fixture)).toBe(true)
      expect(evaluateCondition({ path: 'data.tag', op: 'in', value: ['low'] }, fixture)).toBe(false)
      expect(evaluateCondition({ path: 'data.tag', op: 'notIn', value: ['low'] }, fixture)).toBe(true)
    })

    it('an unrecognized op fails safe (false), never throws', () => {
      expect(() => evaluateCondition({ path: 'data.tag', op: 'madeUp', value: 1 }, fixture)).not.toThrow()
      expect(evaluateCondition({ path: 'data.tag', op: 'madeUp', value: 1 }, fixture)).toBe(false)
    })

    it('never throws on a missing/null/malformed fixture', () => {
      expect(() => evaluateCondition({ path: 'data.x', op: 'exists' }, null)).not.toThrow()
      expect(() => evaluateCondition({ path: 'data.x', op: 'exists' }, undefined)).not.toThrow()
    })
  })

  describe('all / any composition', () => {
    const fixture = { data: { blocked: false, canApprove: true } }

    it('all is a logical AND', () => {
      const condition = {
        all: [
          { path: 'data.blocked', op: 'ne', value: true },
          { path: 'data.canApprove', op: 'ne', value: false },
        ],
      }
      expect(evaluateCondition(condition, fixture)).toBe(true)
      expect(evaluateCondition(condition, { data: { blocked: true, canApprove: true } })).toBe(false)
    })

    it('any is a logical OR', () => {
      const condition = { any: [{ path: 'data.x', op: 'eq', value: 1 }, { path: 'data.canApprove', op: 'eq', value: true }] }
      expect(evaluateCondition(condition, fixture)).toBe(true)
    })

    it('nests recursively', () => {
      const condition = { all: [{ any: [{ path: 'data.blocked', op: 'eq', value: true }, { path: 'data.canApprove', op: 'eq', value: true }] }] }
      expect(evaluateCondition(condition, fixture)).toBe(true)
    })
  })
})

describe('validateCondition', () => {
  it('accepts every real operator with a valid shape', () => {
    for (const op of CONDITION_OPS) {
      const needsValue = !['exists', 'notExists', 'truthy', 'falsy'].includes(op)
      const condition = needsValue ? { path: 'data.x', op, value: op === 'in' || op === 'notIn' ? ['a'] : 1 } : { path: 'data.x', op }
      expect(validateCondition(condition, 'where')).toEqual([])
    }
  })

  it('rejects a non-object', () => {
    expect(validateCondition(null, 'w')).toEqual(['w: must be an object'])
    expect(validateCondition('nope', 'w')).toEqual(['w: must be an object'])
    expect(validateCondition([], 'w')).toEqual(['w: must be an object'])
  })

  it('rejects a missing/empty path', () => {
    expect(validateCondition({ op: 'exists' }, 'w').some((p) => p.includes('"path"'))).toBe(true)
    expect(validateCondition({ path: '', op: 'exists' }, 'w').some((p) => p.includes('"path"'))).toBe(true)
  })

  it('rejects an unknown op', () => {
    expect(validateCondition({ path: 'data.x', op: 'madeUp' }, 'w').some((p) => p.includes('"op"'))).toBe(true)
  })

  it('rejects a comparison op with no "value"', () => {
    expect(validateCondition({ path: 'data.x', op: 'eq' }, 'w').some((p) => p.includes('requires a "value"'))).toBe(true)
  })

  it('validates "all"/"any" recursively and rejects an empty or non-array list', () => {
    expect(validateCondition({ all: [] }, 'w').some((p) => p.includes('non-empty array'))).toBe(true)
    expect(validateCondition({ all: 'nope' }, 'w').some((p) => p.includes('non-empty array'))).toBe(true)
    expect(validateCondition({ all: [{ op: 'exists' }] }, 'w').some((p) => p.includes('w.all[0]'))).toBe(true)
    expect(validateCondition({ all: [{ path: 'data.x', op: 'exists' }] }, 'w')).toEqual([])
  })

  it('rejects declaring both "all" and "any" on the same condition', () => {
    expect(
      validateCondition({ all: [{ path: 'data.x', op: 'exists' }], any: [{ path: 'data.y', op: 'exists' }] }, 'w'),
    ).toEqual(['w: must not declare both "all" and "any"'])
  })
})
