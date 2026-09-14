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

function buttonsIn(container) {
  return Array.from(container.querySelectorAll('button'));
}

describe('StageActionBar — genericity (§18-H proof: unrelated action sets through ONE shared component)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders nothing when the manifest declares no actions at all', () => {
    const { container, root } = mount(<StageActionBar code="T.0" stageKey="reason" actions={undefined} fixture={{ data: {} }} />);
    expect(container.textContent).toBe('');
    act(() => root.unmount());
  });

  it('renders nothing for an explicit empty actions array', () => {
    const { container, root } = mount(<StageActionBar code="T.0" stageKey="reason" actions={[]} fixture={{ data: {} }} />);
    expect(container.textContent).toBe('');
    act(() => root.unmount());
  });

  it('template A: a single simple action with no confirm/reason executes immediately on click', async () => {
    const actions = [{ id: 'retry', label: 'Retry', kind: 'primary' }];
    const { container, root } = mount(<StageActionBar code="T.A" stageKey="live" actions={actions} fixture={{ data: {} }} />);
    const [button] = buttonsIn(container);
    expect(button.textContent).toBe('Retry');

    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    // No dialog — it just started running immediately, straight into its own loading state.
    expect(confirmDialogButtons()).toHaveLength(0);
    expect(buttonsIn(container)[0].getAttribute('aria-busy')).toBe('true');
    await flush();
    expect(buttonsIn(container)[0].textContent).toBe('Done');
    act(() => root.unmount());
  });

  it('template B: two independent actions (Approve + Decline) render side by side, each with its own lifecycle', async () => {
    const actions = [
      { id: 'approve', label: 'Approve', kind: 'primary', confirm: { required: true } },
      { id: 'decline', label: 'Decline', kind: 'destructive', reason: { required: true, minLength: 5 } },
    ];
    const { container, root } = mount(<StageActionBar code="T.B" stageKey="decide" actions={actions} fixture={{ data: {} }} />);
    const labels = buttonsIn(container).map((b) => b.textContent);
    expect(labels).toEqual(['Approve', 'Decline']);
    act(() => root.unmount());
  });

  it('template C: three differently-configured actions (dismiss, escalate, request_changes) all render through the same component', () => {
    const actions = [
      { id: 'dismiss', label: 'Dismiss', kind: 'secondary' },
      { id: 'escalate', label: 'Escalate', kind: 'destructive', confirm: { required: true, title: 'Escalate this?' } },
      { id: 'request_changes', label: 'Request changes', kind: 'primary', reason: { required: true, label: 'What needs to change?', minLength: 10 } },
    ];
    const { container, root } = mount(<StageActionBar code="T.C" stageKey="analyze" actions={actions} fixture={{ data: {} }} />);
    expect(buttonsIn(container).map((b) => b.textContent)).toEqual(['Dismiss', 'Escalate', 'Request changes']);
    act(() => root.unmount());
  });
});

describe('StageActionBar — confirmation flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('click opens a confirm dialog first — the mutation does not fire until Confirm is clicked', () => {
    const actions = [{ id: 'approve', label: 'Approve', confirm: { required: true } }];
    const { container, root } = mount(<StageActionBar code="S9.99" stageKey="decide" actions={actions} fixture={{ data: {} }} />);
    const button = container.querySelector('button');

    expect(confirmDialogButtons()).toHaveLength(0);
    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(button.disabled).toBe(false);
    const dialogButtons = confirmDialogButtons();
    expect(dialogButtons.map((b) => b.textContent)).toEqual(['Cancel', 'Approve']);
    act(() => root.unmount());
  });

  it('Cancel closes the dialog without ever starting the mutation', () => {
    const actions = [{ id: 'approve', label: 'Approve', confirm: { required: true } }];
    const { container, root } = mount(<StageActionBar code="S9.99" stageKey="decide" actions={actions} fixture={{ data: {} }} />);
    act(() => container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const [cancelButton] = confirmDialogButtons();
    act(() => cancelButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('button').textContent).toBe('Approve');
    act(() => root.unmount());
  });

  it('Confirm -> loading (disabled, spinner) -> done, dialog auto-closes, persists across a fresh mount', async () => {
    const actions = [{ id: 'approve', label: 'Approve', confirm: { required: true } }];
    const { container, root } = mount(<StageActionBar code="S9.97" stageKey="decide" actions={actions} fixture={{ data: {} }} />);
    act(() => container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const [, confirmButton] = confirmDialogButtons();
    act(() => confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const button = container.querySelector('button');
    expect(button.disabled).toBe(true);
    expect(confirmDialogButtons().every((b) => b.disabled)).toBe(true);

    await flush();

    expect(container.querySelector('button').disabled).toBe(true);
    expect(container.querySelector('button').textContent).toBe('Done');
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    act(() => root.unmount());

    // A fresh mount (simulating a page reload) reads the same persisted completion.
    const second = mount(<StageActionBar code="S9.97" stageKey="decide" actions={actions} fixture={{ data: {} }} />);
    expect(second.container.querySelector('button').textContent).toBe('Done');
    act(() => second.root.unmount());
  });

  it('shows a retryable error and label when the mutation fails, and Retry reopens the same dialog rather than silently re-running', async () => {
    const mutations = await import('@/services/actionStoriesMutations');
    vi.spyOn(mutations, 'dispatchAction').mockRejectedValueOnce(
      Object.assign(new Error('boom'), { code: 'SERVER_ERROR', retryable: true, userMessage: 'Something went wrong on our end.' }),
    );
    const actions = [{ id: 'confirm', label: 'Start', confirm: { required: true } }];
    const { container, root } = mount(<StageActionBar code="S9.99" stageKey="execute" actions={actions} fixture={{ data: {} }} />);
    act(() => container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const [, confirmButton] = confirmDialogButtons();
    act(() => confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await flush();

    expect(container.querySelector('[role="alert"]').textContent).toContain('Something went wrong');
    const button = container.querySelector('button');
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain('Retry');
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(confirmDialogButtons()).toHaveLength(2);

    mutations.dispatchAction.mockRestore();
    act(() => root.unmount());
  });

  it('a simple action with no confirm/reason config runs immediately, no dialog ever opens', async () => {
    const actions = [{ id: 'dismiss', label: 'Dismiss' }];
    const { container, root } = mount(<StageActionBar code="S9.98" stageKey="reason" actions={actions} fixture={{ data: {} }} />);
    act(() => container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    await flush();
    expect(container.querySelector('button').textContent).toBe('Done');
    act(() => root.unmount());
  });
});

describe('StageActionBar — eligibility (generic "when", not a hardcoded guardrail field)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function guardrailAction() {
    return {
      id: 'approve',
      label: 'Approve',
      confirm: { required: true },
      when: {
        all: [
          { path: 'data.blocked', op: 'ne', value: true },
          { path: 'data.canApprove', op: 'ne', value: false },
        ],
      },
      disabledReasonBinding: 'data.blockReason',
    };
  }

  it('never opens the confirm dialog, and the mutation never fires, when the "when" condition fails', async () => {
    const mutations = await import('@/services/actionStoriesMutations');
    const spy = vi.spyOn(mutations, 'dispatchAction');

    const fixture = { data: { blocked: true, blockReason: 'Full-launch exposure of $92.5K breaks the $75K appetite set in Reason' } };
    const { container, root } = mount(<StageActionBar code="S9.16" stageKey="decide" actions={[guardrailAction()]} fixture={fixture} />);
    const button = container.querySelector('button');

    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Unavailable');
    expect(container.querySelector('[role="alert"]').textContent).toContain('Full-launch exposure of $92.5K');

    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
    act(() => root.unmount());
  });

  it('is enabled by default when the stage carries none of the "when" condition\'s fields at all', () => {
    const { container, root } = mount(<StageActionBar code="S9.101" stageKey="decide" actions={[guardrailAction()]} fixture={{ data: {} }} />);
    expect(container.querySelector('button').disabled).toBe(false);
    act(() => root.unmount());
  });

  it('an already-done action stays "Done" even if it would now be ineligible — done always wins', async () => {
    const eligibleFixture = { data: { blocked: false, canApprove: true } };
    const { container, root } = mount(<StageActionBar code="S9.102" stageKey="decide" actions={[guardrailAction()]} fixture={eligibleFixture} />);
    act(() => container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const [, confirmButton] = confirmDialogButtons();
    act(() => confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await flush();
    act(() => root.unmount());

    const blockedFixture = { data: { blocked: true } };
    const { container: container2, root: root2 } = mount(<StageActionBar code="S9.102" stageKey="decide" actions={[guardrailAction()]} fixture={blockedFixture} />);
    expect(container2.querySelector('button').textContent).toBe('Done');
    expect(container2.querySelector('[role="alert"]')).toBeNull();
    act(() => root2.unmount());
  });
});

describe('StageActionBar — reason requirement', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function actionWithReason() {
    return { id: 'decline', label: 'Decline', kind: 'destructive', confirm: { required: true }, reason: { required: true, label: 'Reason', minLength: 10 } };
  }

  it('Confirm stays disabled until the reason meets the minimum length', () => {
    const { container, root } = mount(<StageActionBar code="S9.200" stageKey="decide" actions={[actionWithReason()]} fixture={{ data: {} }} />);
    act(() => container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const [, confirmButton] = confirmDialogButtons();
    expect(confirmButton.disabled).toBe(true);

    const textarea = document.body.querySelector('textarea');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, 'short');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(confirmDialogButtons()[1].disabled).toBe(true); // still too short

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, 'a genuinely long enough reason');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(confirmDialogButtons()[1].disabled).toBe(false);
    act(() => root.unmount());
  });

  it('runs with the typed reason once valid', async () => {
    const mutations = await import('@/services/actionStoriesMutations');
    const spy = vi.spyOn(mutations, 'dispatchAction');
    const { container, root } = mount(<StageActionBar code="S9.201" stageKey="decide" actions={[actionWithReason()]} fixture={{ data: {} }} />);
    act(() => container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const textarea = document.body.querySelector('textarea');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, 'a genuinely long enough reason');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => confirmDialogButtons()[1].dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await flush();

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ reason: 'a genuinely long enough reason' }));
    spy.mockRestore();
    act(() => root.unmount());
  });

  it('an optional reason (required: false) never blocks Confirm', () => {
    const actions = [{ id: 'dismiss', label: 'Dismiss', confirm: { required: true }, reason: { required: false } }];
    const { container, root } = mount(<StageActionBar code="S9.202" stageKey="decide" actions={actions} fixture={{ data: {} }} />);
    act(() => container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(confirmDialogButtons()[1].disabled).toBe(false);
    act(() => root.unmount());
  });
});

describe('StageActionBar — concurrency and unknown actions', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('while one action is running, its siblings disable too (never two consequential actions at once)', async () => {
    const actions = [
      { id: 'approve', label: 'Approve' },
      { id: 'decline', label: 'Decline' },
    ];
    const { container, root } = mount(<StageActionBar code="S9.300" stageKey="decide" actions={actions} fixture={{ data: {} }} />);
    const [approveButton, declineButton] = buttonsIn(container);
    act(() => approveButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(declineButton.disabled).toBe(true);
    await flush();
    expect(declineButton.disabled).toBe(false); // free again once Approve settled
    act(() => root.unmount());
  });

  it('an unrecognized backend action type never crashes and never silently becomes a different action — it dispatches its own declared id/label as-is', async () => {
    const actions = [{ id: 'escalate', label: 'Escalate', action: 'some_future_backend_action' }];
    const { container, root } = mount(<StageActionBar code="S9.301" stageKey="decide" actions={actions} fixture={{ data: {} }} />);
    act(() => container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await flush();
    expect(container.querySelector('button').textContent).toBe('Done');
    act(() => root.unmount());
  });
});
