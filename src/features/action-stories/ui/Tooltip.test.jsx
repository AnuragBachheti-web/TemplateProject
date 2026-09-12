// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import Tooltip from './Tooltip';

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

describe('Tooltip — hover- and focus-triggered explanation for a short, jargon-y value', () => {
  it('renders children unwrapped, with no tooltip markup, when content is falsy', () => {
    const { container } = mount(
      <Tooltip content={null}>
        <span>82% ± 7</span>
      </Tooltip>,
    );
    expect(container.innerHTML).toBe('<span>82% ± 7</span>');
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('shows on mouse enter and hides on mouse leave', () => {
    const { container } = mount(
      <Tooltip content="Statistical confidence, not a probability of success.">
        <span>82% ± 7</span>
      </Tooltip>,
    );
    const wrapper = container.querySelector('span.relative');
    expect(container.querySelector('[role="tooltip"]')).toBeNull();

    // `mouseenter`/`mouseleave` don't bubble (by spec) — React listens for their bubbling
    // equivalents (`mouseover`/`mouseout`) at the root and synthesizes onMouseEnter/onMouseLeave
    // from them, so those are what a dispatched event has to be for React to ever see it.
    act(() => wrapper.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    expect(container.querySelector('[role="tooltip"]').textContent).toContain('Statistical confidence');

    act(() => wrapper.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })));
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('shows on keyboard focus (never hover-only) and hides on blur, wired via aria-describedby', () => {
    const { container } = mount(
      <Tooltip content="Explanation">
        <span>Value</span>
      </Tooltip>,
    );
    const trigger = container.querySelector('[tabindex="0"]');
    // Real `.focus()`/`.blur()` calls, not a dispatched FocusEvent — `focus`/`blur` never bubble
    // even with `{ bubbles: true }` set on the constructor; React listens via `focusin`/`focusout`
    // (which do bubble), and only the real focus-management APIs fire those correctly.
    act(() => trigger.focus());
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);

    act(() => trigger.blur());
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('Escape hides it while focused', () => {
    const { container } = mount(
      <Tooltip content="Explanation">
        <span>Value</span>
      </Tooltip>,
    );
    const trigger = container.querySelector('[tabindex="0"]');
    act(() => trigger.focus());
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull();

    act(() => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });
});
