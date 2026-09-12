// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import GaugeBlock from './GaugeBlock';

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

describe('GaugeBlock — the threshold tick is now hover/focus-discoverable, not just sr-only', () => {
  const data = [{ label: 'Volume loss', value: '3.1%', threshold: '4.0%' }];

  it('renders the row and no longer stashes the threshold in a bare sr-only span', () => {
    const container = mount(<GaugeBlock slotName="tolerance" data={data} />);
    expect(container.textContent).toContain('Volume loss');
    expect(container.querySelector('.sr-only')).toBeNull();
  });

  it('a sighted/keyboard user can discover the threshold value via the tick\'s tooltip', () => {
    const container = mount(<GaugeBlock slotName="tolerance" data={data} />);
    expect(container.querySelector('[role="tooltip"]')).toBeNull();

    // A real `.focus()` call, not a dispatched FocusEvent — see Tooltip.test.jsx for why `focus`
    // never bubbles even with `{ bubbles: true }` set, and only the real DOM API reaches React.
    const tick = container.querySelector('[tabindex="0"]');
    act(() => tick.focus());
    expect(container.querySelector('[role="tooltip"]').textContent).toBe('Threshold: 4.0%');
  });

  it('flags a value over its threshold with the critical status color, not a hardcoded palette literal', () => {
    const container = mount(<GaugeBlock slotName="tolerance" data={[{ label: 'Over', value: '9%', threshold: '4%' }]} />);
    const html = container.innerHTML;
    expect(html).toContain('bg-rf-status-critical');
    expect(html).not.toMatch(/bg-rose-|text-rose-/);
  });
});
