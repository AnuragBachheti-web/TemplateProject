// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ToastProvider, useToast } from './Toast';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return { container, root };
}

function toastNodes() {
  return Array.from(document.body.querySelectorAll('[role="status"], [role="alert"]'));
}

let notifyRef;
function Trigger() {
  notifyRef = useToast().notify;
  return null;
}

describe('Toast — transient, app-wide feedback for the moment an action settles', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('useToast throws outside a ToastProvider (fails loudly, not silently a no-op)', () => {
    function Bare() {
      useToast();
      return null;
    }
    expect(() => mount(<Bare />)).toThrow(/ToastProvider/);
  });

  it('notify renders a toast with the message and the correct live-region role per tone', () => {
    const { root } = mount(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => notifyRef('Stage confirmed', { tone: 'success' }));
    const [toast] = toastNodes();
    expect(toast.textContent).toContain('Stage confirmed');
    expect(toast.getAttribute('role')).toBe('status'); // success -> polite, not alert
    expect(toast.getAttribute('aria-live')).toBe('polite');
    act(() => root.unmount());
  });

  it('a critical/warning tone uses an assertive alert region — errors should not wait to be noticed', () => {
    const { root } = mount(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => notifyRef('Something went wrong', { tone: 'critical' }));
    const [toast] = toastNodes();
    expect(toast.getAttribute('role')).toBe('alert');
    expect(toast.getAttribute('aria-live')).toBe('assertive');
    act(() => root.unmount());
  });

  it('auto-dismisses after its tone default duration', () => {
    const { root } = mount(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => notifyRef('Hi', { tone: 'info' }));
    expect(toastNodes()).toHaveLength(1);
    act(() => vi.advanceTimersByTime(4000));
    expect(toastNodes()).toHaveLength(0);
    act(() => root.unmount());
  });

  it('a critical toast stays up longer than an info one (needs to actually be read)', () => {
    const { root } = mount(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => notifyRef('Failed', { tone: 'critical' }));
    act(() => vi.advanceTimersByTime(4000)); // info's own duration — a critical toast must survive it
    expect(toastNodes()).toHaveLength(1);
    act(() => vi.advanceTimersByTime(2000)); // critical's own 6000ms total
    expect(toastNodes()).toHaveLength(0);
    act(() => root.unmount());
  });

  it('duration: Infinity never auto-dismisses; the dismiss (×) button still removes it', () => {
    const { root } = mount(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => notifyRef('Stays until dismissed', { tone: 'info', duration: Infinity }));
    act(() => vi.advanceTimersByTime(60_000));
    expect(toastNodes()).toHaveLength(1);

    const dismissButton = toastNodes()[0].querySelector('button');
    act(() => dismissButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(toastNodes()).toHaveLength(0);
    act(() => root.unmount());
  });

  it('multiple toasts stack independently', () => {
    const { root } = mount(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => {
      notifyRef('First');
      notifyRef('Second');
    });
    expect(toastNodes()).toHaveLength(2);
    act(() => root.unmount());
  });
});
