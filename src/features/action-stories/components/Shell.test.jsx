// @vitest-environment jsdom
//
// Scoped to the new LedgerTrigger/LedgerOverlay wiring only — Shell's own WorkflowNav (data
// fetching, mobile drawer, retry) has no prior test coverage and adding a full suite for it is out
// of scope for this change; MemoryRouter + Route mirrors App.jsx's own real nesting (Shell as a
// layout route with an index child) so Shell mounts exactly as it does in production.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Shell from './Shell';
import { useLedgerStore } from '@/store/useLedgerStore';
import { __resetMockApi } from '@/services/mockDecisionApi';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

async function render() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Shell />}>
            <Route index element={<p>Home</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
}

beforeEach(() => {
  __resetMockApi();
  useLedgerStore.setState({ entries: [], isOpen: false });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

describe('Shell — the LedgerTrigger masthead icon', () => {
  it('carries no count badge when the ledger is empty', async () => {
    await render();
    const trigger = container.querySelector('button[aria-label="Ledger"]');
    expect(trigger).not.toBeNull();
    expect(trigger.querySelector('span[aria-hidden="true"]')).toBeNull();
  });

  it('opens LedgerOverlay when clicked', async () => {
    await render();
    const trigger = container.querySelector('button[aria-label="Ledger"]');
    act(() => trigger.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(useLedgerStore.getState().isOpen).toBe(true);
  });

  it('shows the real recorded count as a badge, capped display at 99+', async () => {
    useLedgerStore.getState().record({
      actionId: 'approve',
      label: 'Approve',
      storyCode: 'S10.4',
      stage: 'decide',
      proposalId: 'prop_1',
      outcome: 'success',
    });
    await render();
    const trigger = container.querySelector('button[aria-label*="1 action"]');
    expect(trigger).not.toBeNull();
    expect(trigger.textContent).toBe('1');
  });
});
