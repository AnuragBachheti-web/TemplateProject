// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import StageActionBar from './StageActionBar';

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
    root.render(element);
  });
  return container;
}

async function flush(times = 8) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
  }
}

describe('StageActionBar — real mutation lifecycle end to end', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders nothing on a reason/analyze/live stage (no business action exists there)', () => {
    const container = mount(<StageActionBar code="S9.99" stageKey="reason" />);
    expect(container.textContent).toBe('');
  });

  it('click -> loading (disabled, aria-busy) -> confirmed, with duplicate-click protection', async () => {
    const container = mount(<StageActionBar code="S9.99" stageKey="decide" />);
    const button = container.querySelector('button');
    expect(button.textContent).toBe('Approve');
    expect(button.disabled).toBe(false);

    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toContain('Confirming');

    // A second click while pending must not start a second mutation or throw.
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await flush();

    expect(container.querySelector('button').disabled).toBe(true);
    expect(container.querySelector('button').textContent).toBe('Done');
    expect(container.textContent).toContain('Confirmed');
  });

  it('persists the confirmation across a fresh mount (regression: refresh used to lose it)', async () => {
    const first = mount(<StageActionBar code="S9.99" stageKey="decide" />);
    act(() => {
      first.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();
    expect(first.querySelector('button').textContent).toBe('Done');

    // A fresh component instance (simulating a page reload) reads the same persisted state.
    const second = mount(<StageActionBar code="S9.99" stageKey="decide" />);
    expect(second.querySelector('button').textContent).toBe('Done');
  });

  it('shows a retryable error state and label when the mutation fails', async () => {
    const mutations = await import('@/services/actionStoriesMutations');
    vi.spyOn(mutations, 'confirmStageMutation').mockRejectedValueOnce(
      Object.assign(new Error('boom'), { code: 'SERVER_ERROR', retryable: true, userMessage: 'Something went wrong on our end.' }),
    );
    const container = mount(<StageActionBar code="S9.99" stageKey="execute" />);
    act(() => {
      container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[role="alert"]').textContent).toContain('Something went wrong');
    const button = container.querySelector('button');
    expect(button.disabled).toBe(false); // not stuck — a retry is possible
    expect(button.textContent).toContain('Retry');
    mutations.confirmStageMutation.mockRestore();
  });

  it('a decorative CTA label from the manifest overrides the default Approve/Start text', () => {
    // A code unused by any earlier test in this file — the in-memory Zustand store is a
    // module-level singleton that isn't reset between tests just because localStorage was
    // cleared, so reusing "S9.99/decide" here would read back an already-confirmed state.
    const container = mount(<StageActionBar code="S9.100" stageKey="decide" ctaLabel="Ship it" />);
    expect(container.querySelector('button').textContent).toBe('Ship it');
  });
});
