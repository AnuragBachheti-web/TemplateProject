// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import Modal from './Modal';

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

describe('Modal — the generic WAI-ARIA dialog shell every overlay should reuse', () => {
  it('renders nothing when closed', () => {
    const { container } = mount(
      <Modal open={false} onClose={() => {}}>
        <p>Body</p>
      </Modal>,
    );
    expect(container.textContent).toBe('');
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('portals to document.body with the correct dialog semantics when open', () => {
    const { root } = mount(
      <Modal open onClose={() => {}} labelledBy="t">
        <h2 id="t">Title</h2>
      </Modal>,
    );
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('t');
    act(() => root.unmount());
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    const { root } = mount(
      <Modal open onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('calls onClose on a backdrop click, but not on a click inside the dialog', () => {
    const onClose = vi.fn();
    const { root } = mount(
      <Modal open onClose={onClose}>
        <button type="button">inside</button>
      </Modal>,
    );
    act(() => {
      document.body.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();

    const backdrop = document.body.querySelector('[aria-hidden="true"]');
    act(() => backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('moves focus into the dialog (or the given initialFocusRef) on open, and restores it on close', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const initialFocusRef = { current: null };
    function Wrapper({ open }) {
      return (
        <Modal open={open} onClose={() => {}} initialFocusRef={initialFocusRef}>
          <button
            type="button"
            ref={(el) => {
              initialFocusRef.current = el;
            }}
          >
            Cancel
          </button>
        </Modal>
      );
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<Wrapper open />));
    expect(document.activeElement).toBe(initialFocusRef.current);

    act(() => root.render(<Wrapper open={false} />));
    expect(document.activeElement).toBe(trigger);
    act(() => root.unmount());
  });
});
