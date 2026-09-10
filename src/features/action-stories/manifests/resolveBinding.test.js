import { describe, it, expect } from 'vitest'
import { resolveBinding } from './resolveBinding'

describe('resolveBinding', () => {
  const fixture = { data: { execLabel: 'Suggest', rows: [{ name: 'A' }, { name: 'B' }] }, state: {} }

  it('resolves a simple dot path', () => {
    expect(resolveBinding('data.execLabel', fixture)).toBe('Suggest')
  })

  it('resolves through array indices', () => {
    expect(resolveBinding('data.rows[1].name', fixture)).toBe('B')
    expect(resolveBinding('data.rows.0.name', fixture)).toBe('A')
  })

  it('returns undefined, never throws, for a missing key', () => {
    expect(resolveBinding('data.nope', fixture)).toBeUndefined()
    expect(resolveBinding('data.rows[9].name', fixture)).toBeUndefined()
  })

  it('returns undefined rather than throwing when the path runs through null', () => {
    const withNull = { data: { thing: null } }
    expect(() => resolveBinding('data.thing.deeper', withNull)).not.toThrow()
    expect(resolveBinding('data.thing.deeper', withNull)).toBeUndefined()
  })

  it('never returns the literal string "undefined"', () => {
    const result = resolveBinding('data.nope', fixture)
    expect(result).not.toBe('undefined')
  })

  it('is safe against non-string bindings and non-object data', () => {
    expect(() => resolveBinding(null, fixture)).not.toThrow()
    expect(() => resolveBinding('data.execLabel', null)).not.toThrow()
    expect(resolveBinding('data.execLabel', null)).toBeUndefined()
  })
})
