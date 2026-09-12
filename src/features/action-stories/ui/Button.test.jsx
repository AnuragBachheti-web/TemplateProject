// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import Button from './Button';

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

describe('Button — the one shared button every action/CTA/dialog control should use', () => {
  it('renders its label and fires onClick', () => {
    const onClick = vi.fn();
    const { container } = mount(<Button onClick={onClick}>Approve</Button>);
    const button = container.querySelector('button');
    expect(button.textContent).toBe('Approve');
    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to the primary variant and rf-* tokens, never a hardcoded palette literal', () => {
    const { container } = mount(<Button>Go</Button>);
    const classes = container.querySelector('button').className.split(/\s+/);
    expect(classes).toContain('bg-rf-brand-blue-500');
    // No RAW Tailwind palette color (e.g. bg-blue-500, distinct from the rf-brand-blue-* token).
    expect(classes.some((c) => /^bg-(blue|indigo|emerald|green|red|rose)-\d+$/.test(c))).toBe(false);
  });

  it('every variant resolves to a real class set (no silent no-op variant name)', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'destructive']) {
      const { container } = mount(<Button variant={variant}>X</Button>);
      expect(container.querySelector('button').className.length).toBeGreaterThan(20);
    }
  });

  it('loading forces disabled, sets aria-busy, and shows a spinner instead of an icon', () => {
    const { container } = mount(
      <Button loading icon="fa-solid fa-arrow-right">
        Go
      </Button>,
    );
    const button = container.querySelector('button');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('.animate-spin')).not.toBeNull();
    expect(button.querySelector('.fa-arrow-right')).toBeNull();
  });

  it('disabled prevents onClick from firing', () => {
    const onClick = vi.fn();
    const { container } = mount(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    const button = container.querySelector('button');
    expect(button.disabled).toBe(true);
    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forwards a ref to the underlying <button> element (needed for ConfirmDialog\'s initial focus)', () => {
    let ref;
    function Wrapper() {
      ref = { current: null };
      return (
        <Button
          ref={(el) => {
            ref.current = el;
          }}
        >
          Cancel
        </Button>
      );
    }
    mount(<Wrapper />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
