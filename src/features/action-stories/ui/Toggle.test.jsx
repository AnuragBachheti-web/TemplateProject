// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import Toggle from './Toggle';

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

describe('Toggle — a real <input type="checkbox" role="switch">, not a hand-rolled div', () => {
  it('renders a genuine switch input, reflecting the checked prop', () => {
    const { container } = mount(<Toggle checked onChange={() => {}} label="Auto-approve" />);
    const input = container.querySelector('input[type="checkbox"]');
    expect(input).not.toBeNull();
    expect(input.getAttribute('role')).toBe('switch');
    expect(input.checked).toBe(true);
    expect(input.getAttribute('aria-checked')).toBe('true');
    expect(container.textContent).toContain('Auto-approve');
  });

  it('calls onChange with the new value when clicked, via its own label', () => {
    const onChange = vi.fn();
    const { container } = mount(<Toggle checked={false} onChange={onChange} label="Auto-approve" />);
    const input = container.querySelector('input[type="checkbox"]');
    act(() => input.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('is keyboard-operable (a real input, not a div)', () => {
    const { container } = mount(<Toggle checked={false} onChange={() => {}} />);
    const input = container.querySelector('input[type="checkbox"]');
    expect(input.tabIndex).not.toBe(-1);
  });

  it('disabled prevents interaction', () => {
    const { container } = mount(<Toggle checked={false} disabled onChange={() => {}} />);
    const input = container.querySelector('input[type="checkbox"]');
    expect(input.disabled).toBe(true);
  });

  it('hideLabel keeps an accessible name without visible text', () => {
    const { container } = mount(<Toggle checked={false} onChange={() => {}} label="Auto-approve" hideLabel />);
    const label = container.querySelector('span.sr-only');
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('Auto-approve');
  });
});
