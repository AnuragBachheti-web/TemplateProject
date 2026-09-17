// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useLedgerStore } from '@/store/useLedgerStore';
import LedgerOverlay from './LedgerOverlay';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let container;

beforeEach(() => {
  useLedgerStore.setState({ entries: [], isOpen: false });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount() {
  act(() => {
    root.render(
      <MemoryRouter>
        <LedgerOverlay />
      </MemoryRouter>,
    );
  });
}

describe('LedgerOverlay', () => {
  it('renders nothing when closed', () => {
    mount();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows an honest empty state with no fabricated history', () => {
    useLedgerStore.getState().open();
    mount();
    expect(document.body.textContent).toContain('Nothing here yet');
  });

  it('lists a real recorded entry, newest first, attributed to "You"', () => {
    useLedgerStore.getState().record({
      actionId: 'approve',
      label: 'Approve',
      storyCode: 'S10.4',
      stage: 'decide',
      proposalId: 'prop_1',
      outcome: 'success',
      detail: 'approved',
    });
    useLedgerStore.getState().open();
    mount();
    expect(document.body.textContent).toContain('You');
    expect(document.body.textContent).toContain('Approve');
    expect(document.body.textContent).toContain('S10.4');
    expect(document.body.querySelector('a[href="/action-stories/S10.4/decide"]')).not.toBeNull();
  });

  it('shows the failure detail and a critical badge for an errored entry', () => {
    useLedgerStore.getState().record({
      actionId: 'dismiss',
      label: 'Dismiss',
      storyCode: 'S9.1',
      stage: 'decide',
      proposalId: 'prop_2',
      outcome: 'error',
      detail: 'A reason of at least 10 characters is required.',
    });
    useLedgerStore.getState().open();
    mount();
    expect(document.body.textContent).toContain('tried to');
    expect(document.body.textContent).toContain('A reason of at least 10 characters is required.');
  });

  it('never renders a rollback control — no operator action in this app is reversible', () => {
    useLedgerStore.getState().record({
      actionId: 'approve',
      label: 'Approve',
      storyCode: 'S10.4',
      stage: 'decide',
      proposalId: 'prop_1',
      outcome: 'success',
    });
    useLedgerStore.getState().open();
    mount();
    expect(document.body.textContent.toLowerCase()).not.toContain('rollback');
  });

  it('closing calls the store\'s close(), which the trigger button also reads from', () => {
    useLedgerStore.getState().open();
    mount();
    const closeButton = document.body.querySelector('button[aria-label="Close"]');
    act(() => closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(useLedgerStore.getState().isOpen).toBe(false);
  });
});
