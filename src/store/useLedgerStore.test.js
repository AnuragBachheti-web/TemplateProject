import { describe, it, expect, beforeEach } from 'vitest';
import { useLedgerStore } from './useLedgerStore';

beforeEach(() => {
  useLedgerStore.setState({ entries: [], isOpen: false });
});

function entryFields(overrides = {}) {
  return {
    actionId: 'approve',
    label: 'Approve',
    storyCode: 'S10.4',
    stage: 'decide',
    proposalId: 'prop_1',
    outcome: 'success',
    ...overrides,
  };
}

describe('useLedgerStore', () => {
  it('starts empty and closed', () => {
    expect(useLedgerStore.getState().entries).toEqual([]);
    expect(useLedgerStore.getState().isOpen).toBe(false);
  });

  it('open()/close() toggle isOpen with no effect on entries', () => {
    useLedgerStore.getState().record(entryFields());
    useLedgerStore.getState().open();
    expect(useLedgerStore.getState().isOpen).toBe(true);
    useLedgerStore.getState().close();
    expect(useLedgerStore.getState().isOpen).toBe(false);
    expect(useLedgerStore.getState().entries).toHaveLength(1);
  });

  it('record() prepends — newest entry first', () => {
    useLedgerStore.getState().record(entryFields({ actionId: 'approve' }));
    useLedgerStore.getState().record(entryFields({ actionId: 'dismiss' }));
    const { entries } = useLedgerStore.getState();
    expect(entries).toHaveLength(2);
    expect(entries[0].actionId).toBe('dismiss');
    expect(entries[1].actionId).toBe('approve');
  });

  it('caps at 200 entries, dropping the oldest', () => {
    for (let i = 0; i < 205; i += 1) {
      useLedgerStore.getState().record(entryFields({ proposalId: `prop_${i}` }));
    }
    const { entries } = useLedgerStore.getState();
    expect(entries).toHaveLength(200);
    expect(entries[0].proposalId).toBe('prop_204'); // newest kept
    expect(entries[199].proposalId).toBe('prop_5'); // oldest surviving
  });
});
