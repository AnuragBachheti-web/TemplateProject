// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import StageActionBar from './StageActionBar';
import { ToastProvider } from '../ui/Toast';

if (typeof window !== 'undefined' && !window.localStorage) {
  const storage = new Map();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
      clear: () => storage.clear(),
    },
  });
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    // StageActionBar calls useToast() — needs a real ToastProvider above it, same as App.jsx.
    root.render(<ToastProvider>{element}</ToastProvider>);
  });
  return { container, root };
}

async function flush(times = 8) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
  }
}

// ConfirmDialog portals to document.body, outside the mounted `container` — its buttons have to be
// queried globally. `[role="dialog"]` null means the confirm step isn't open (or has auto-closed).
function confirmDialogButtons() {
  const dialog = document.body.querySelector('[role="dialog"]');
  return dialog ? Array.from(dialog.querySelectorAll('button')) : [];
}

describe('StageActionBar — confirm-gated mutation lifecycle end to end', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders nothing on a reason/analyze/live stage (no business action exists there)', () => {
    const { container, root } = mount(<StageActionBar code="S9.99" stageKey="reason" />);
    expect(container.textContent).toBe('');
    act(() => root.unmount());
  });

  it('click opens a confirm dialog first — the mutation does not fire until Confirm is clicked', () => {
    const { container, root } = mount(<StageActionBar code="S9.99" stageKey="decide" />);
    const button = container.querySelector('button');
    expect(button.textContent).toBe('Approve');

    expect(confirmDialogButtons()).toHaveLength(0); // nothing open yet
    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    // The CTA itself is untouched — no mutation started, no loading state — only the dialog opened.
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe('Approve');
    const dialogButtons = confirmDialogButtons();
    expect(dialogButtons.map((b) => b.textContent)).toEqual(['Cancel', 'Approve']);
    act(() => root.unmount());
  });

  it('Cancel closes the dialog without ever starting the mutation', () => {
    const { container, root } = mount(<StageActionBar code="S9.99" stageKey="decide" />);
    act(() => container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const [cancelButton] = confirmDialogButtons();
    act(() => cancelButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('button').textContent).toBe('Approve');
    act(() => root.unmount());
  });

  it('Confirm in the dialog -> loading (disabled, aria-busy) -> confirmed, dialog auto-closes', async () => {
    const { container, root } = mount(<StageActionBar code="S9.99" stageKey="decide" />);
    act(() => container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const [, confirmButton] = confirmDialogButtons();

    act(() => confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const button = container.querySelector('button');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toContain('Confirming');
    // Both dialog buttons disable immediately too — no double-submit, no cancel mid-flight.
    expect(confirmDialogButtons().every((b) => b.disabled)).toBe(true);

    await flush();

    expect(container.querySelector('button').disabled).toBe(true);
    expect(container.querySelector('button').textContent).toBe('Done');
    expect(container.textContent).toContain('Confirmed');
    expect(document.body.querySelector('[role="dialog"]')).toBeNull(); // settled -> auto-closed
    act(() => root.unmount());
  });

  it('persists the confirmation across a fresh mount (regression: refresh used to lose it)', async () => {
    // A code/stageKey pair unused by any earlier test in this file — the in-memory Zustand store
    // is a module-level singleton shared across every test in this file (only reset per test FILE,
    // not per test), so reusing "S9.99/decide" here would read back the already-confirmed state
    // the earlier "Confirm in the dialog -> ... -> confirmed" test left behind.
    const first = mount(<StageActionBar code="S9.97" stageKey="decide" />);
    act(() => first.container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const [, confirmButton] = confirmDialogButtons();
    act(() => confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await flush();
    expect(first.container.querySelector('button').textContent).toBe('Done');
    act(() => first.root.unmount());

    // A fresh component instance (simulating a page reload) reads the same persisted state.
    const second = mount(<StageActionBar code="S9.97" stageKey="decide" />);
    expect(second.container.querySelector('button').textContent).toBe('Done');
    act(() => second.root.unmount());
  });

  it('shows a retryable error state and label when the mutation fails, and the dialog auto-closes', async () => {
    const mutations = await import('@/services/actionStoriesMutations');
    vi.spyOn(mutations, 'confirmStageMutation').mockRejectedValueOnce(
      Object.assign(new Error('boom'), { code: 'SERVER_ERROR', retryable: true, userMessage: 'Something went wrong on our end.' }),
    );
    const { container, root } = mount(<StageActionBar code="S9.99" stageKey="execute" />);
    act(() => container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const [, confirmButton] = confirmDialogButtons();
    act(() => confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await flush();

    expect(container.querySelector('[role="alert"]').textContent).toContain('Something went wrong');
    const button = container.querySelector('button');
    expect(button.disabled).toBe(false); // not stuck — a retry is possible
    expect(button.textContent).toContain('Retry');
    expect(document.body.querySelector('[role="dialog"]')).toBeNull(); // settled (failed) -> auto-closed

    // Clicking "Retry ..." opens the same confirm dialog again, not a silent second mutation.
    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(confirmDialogButtons()).toHaveLength(2);

    mutations.confirmStageMutation.mockRestore();
    act(() => root.unmount());
  });

  it('a decorative CTA label from the manifest overrides the default Approve/Start text', () => {
    // A code unused by any earlier test in this file — the in-memory Zustand store is a
    // module-level singleton that isn't reset between tests just because localStorage was
    // cleared, so reusing "S9.99/decide" here would read back an already-confirmed state.
    const { container, root } = mount(<StageActionBar code="S9.100" stageKey="decide" ctaLabel="Ship it" />);
    expect(container.querySelector('button').textContent).toBe('Ship it');
    act(() => root.unmount());
  });
});

describe('StageActionBar — guardrail-blocked proposal (regression: a proposal whose own data says it cannot be approved used to still show a fully clickable Approve button)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('never opens the confirm dialog, and never lets the mutation fire, when canConfirm is false', async () => {
    const mutations = await import('@/services/actionStoriesMutations');
    const spy = vi.spyOn(mutations, 'confirmStageMutation');

    const { container, root } = mount(
      <StageActionBar code="S9.16" stageKey="decide" canConfirm={false} blockedReason="Full-launch exposure of $92.5K breaks the $75K appetite set in Reason" />,
    );
    const button = container.querySelector('button');

    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Blocked');
    expect(container.querySelector('[role="alert"]').textContent).toContain('Full-launch exposure of $92.5K');

    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.querySelector('[role="dialog"]')).toBeNull(); // no dialog ever opened
    expect(spy).not.toHaveBeenCalled(); // and so the mutation itself never had a path to fire

    spy.mockRestore();
    act(() => root.unmount());
  });

  it('shows a sensible generic message when blocked with no explicit reason', () => {
    const { container, root } = mount(<StageActionBar code="S9.101" stageKey="decide" canConfirm={false} />);
    expect(container.querySelector('[role="alert"]').textContent).toContain("isn't available");
    act(() => root.unmount());
  });

  it('an already-confirmed stage stays "Done" even if canConfirm is (stale-)false — confirmed always wins', async () => {
    const { container, root } = mount(<StageActionBar code="S9.102" stageKey="decide" canConfirm={true} />);
    act(() => container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const [, confirmButton] = confirmDialogButtons();
    act(() => confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await flush();
    act(() => root.unmount());

    const { container: container2, root: root2 } = mount(<StageActionBar code="S9.102" stageKey="decide" canConfirm={false} blockedReason="stale" />);
    expect(container2.querySelector('button').textContent).toBe('Done');
    expect(container2.querySelector('[role="alert"]')).toBeNull();
    act(() => root2.unmount());
  });
});
