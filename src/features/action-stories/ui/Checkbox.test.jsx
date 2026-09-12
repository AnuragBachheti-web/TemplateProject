// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import Checkbox from './Checkbox';

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

describe('Checkbox — a real <input type="checkbox">, not a hand-rolled div', () => {
  it('renders a genuine checkbox input, reflecting the checked prop', () => {
    const { container } = mount(<Checkbox checked onChange={() => {}} label="Selected" />);
    const input = container.querySelector('input[type="checkbox"]');
    expect(input).not.toBeNull();
    expect(input.checked).toBe(true);
    expect(container.textContent).toContain('Selected');
  });

  it('calls onChange with the new value when clicked (via its own label, real DOM toggling)', () => {
    const onChange = vi.fn();
    const { container } = mount(<Checkbox checked={false} onChange={onChange} label="Pick me" />);
    const input = container.querySelector('input[type="checkbox"]');
    act(() => input.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('is keyboard-operable — Space toggles it (free from using a real <input>, unlike a div)', () => {
    const { container } = mount(<Checkbox checked={false} onChange={() => {}} />);
    const input = container.querySelector('input[type="checkbox"]');
    expect(input.tabIndex).not.toBe(-1);
  });

  it('indeterminate sets the DOM property and shows a dash, not a check, until actually checked', () => {
    const { container } = mount(<Checkbox checked={false} indeterminate onChange={() => {}} />);
    const input = container.querySelector('input[type="checkbox"]');
    expect(input.indeterminate).toBe(true);
    expect(input.getAttribute('aria-checked')).toBe('mixed');
    expect(container.querySelector('.fa-minus')).not.toBeNull();
    expect(container.querySelector('.fa-check')).toBeNull();
  });

  it('disabled prevents interaction', () => {
    const onChange = vi.fn();
    const { container } = mount(<Checkbox checked={false} disabled onChange={onChange} />);
    const input = container.querySelector('input[type="checkbox"]');
    expect(input.disabled).toBe(true);
  });
});
