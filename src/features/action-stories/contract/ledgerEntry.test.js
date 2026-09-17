import { describe, it, expect } from 'vitest'
import { createLedgerEntry } from './ledgerEntry'

function params(overrides = {}) {
  return {
    actionId: 'approve',
    label: 'Approve',
    storyCode: 'S10.4',
    stage: 'decide',
    proposalId: 'prop_1',
    outcome: 'success',
    ...overrides,
  }
}

describe('createLedgerEntry', () => {
  it('carries the caller\'s fields through unchanged', () => {
    const entry = createLedgerEntry(params())
    expect(entry.actionId).toBe('approve')
    expect(entry.label).toBe('Approve')
    expect(entry.storyCode).toBe('S10.4')
    expect(entry.stage).toBe('decide')
    expect(entry.proposalId).toBe('prop_1')
    expect(entry.outcome).toBe('success')
  })

  it('always attributes to "You" — there is no auth/session to source a real name from', () => {
    expect(createLedgerEntry(params()).who).toBe('You')
  })

  it('stamps a real, parseable ISO timestamp at call time', () => {
    const before = Date.now()
    const entry = createLedgerEntry(params())
    const after = Date.now()
    const stamped = Date.parse(entry.when)
    expect(stamped).toBeGreaterThanOrEqual(before)
    expect(stamped).toBeLessThanOrEqual(after)
  })

  it('defaults detail to null, and carries it through when given', () => {
    expect(createLedgerEntry(params()).detail).toBeNull()
    expect(createLedgerEntry(params({ detail: 'approved' })).detail).toBe('approved')
  })

  it('gives every entry a unique id, even created in the same tick', () => {
    const ids = new Set(Array.from({ length: 20 }, () => createLedgerEntry(params()).id))
    expect(ids.size).toBe(20)
  })
})
