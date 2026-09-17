// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import Badge from './Badge';

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

describe('Badge — the one shared status pill', () => {
  it('renders its children and defaults to the neutral tone', () => {
    const { container } = mount(<Badge>Pinned</Badge>);
    expect(container.textContent).toContain('Pinned');
    expect(container.firstChild.className).toMatch(/rf-surface-sunken/);
  });

  it('applies the requested semantic tone', () => {
    const { container } = mount(<Badge tone="critical">Blocked</Badge>);
    expect(container.firstChild.className).toMatch(/rf-status-critical/);
  });

  it('renders an icon before the label when given', () => {
    const { container } = mount(<Badge icon="fa-solid fa-thumbtack">Pinned</Badge>);
    expect(container.querySelector('.fa-thumbtack')).not.toBeNull();
  });

  it('only ever uses rf-status-*/rf-brand-*/rf-surface-* tokens, never a hardcoded palette literal', () => {
    for (const tone of ['neutral', 'brand', 'info', 'success', 'warning', 'critical']) {
      const { container } = mount(<Badge tone={tone}>x</Badge>);
      const cls = container.firstChild.className;
      expect(cls).toMatch(/rf-(status|brand|surface|text)-/);
      expect(cls).not.toMatch(/rose|emerald|amber|indigo/);
    }
  });
});
