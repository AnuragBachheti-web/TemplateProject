// @vitest-environment jsdom
//
// Density fix (visual-forensic follow-up to the semantic-composition pass): a list where every
// item reduces to nothing but a headline (e.g. S9.1/analyze.roles: `{name, hue}`) used to render
// as N full-width bordered `<li>` rows stacked vertically — "six large stacked pills" for a plain
// legend. Uses a real render (createRoot), same convention as TableBlock.test.jsx — ItemQueueBlock
// now composes its own SimpleChipList subcomponent, so calling it as a bare function (like the
// other, single-level stateless blocks) wouldn't actually expand that nested component's own JSX.
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import ItemQueueBlock from './ItemQueueBlock';

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

describe('ItemQueueBlock — simple (headline-only) lists render as compact wrapped chips, not stacked cards', () => {
  it('renders a uniformly-simple list (only a headline field on every item) as a chip row', () => {
    const roles = [
      { name: 'Hero', hue: 'var(--mod-discover)' },
      { name: 'Core', hue: 'var(--r-blue-500)' },
      { name: 'Margin Driver', hue: 'var(--mod-margin)' },
    ];
    const container = mount(<ItemQueueBlock slotName="roles" data={roles} />);
    // Chip rendering: rounded-full pills in a flex-wrap row, not the per-row bordered `<li>` list.
    expect(container.querySelector('.flex-wrap')).toBeTruthy();
    expect(container.querySelectorAll('.rounded-full').length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll('li').length).toBe(0);
    expect(container.textContent).toContain('Hero');
    expect(container.textContent).toContain('Core');
    expect(container.textContent).toContain('Margin Driver');
  });

  it("uses the item's own decorative color field (hue/tint/...) as the chip's dot color", () => {
    const roles = [{ name: 'Hero', hue: 'var(--mod-discover)' }];
    const container = mount(<ItemQueueBlock slotName="roles" data={roles} />);
    const dot = container.querySelector('.rounded-full[style]');
    expect(dot?.style.backgroundColor).toBe('var(--mod-discover)');
  });

  it('a list with even one richer item (a detail/status/identifier) keeps the existing per-row card treatment', () => {
    const richer = [
      { name: 'Hero', hue: 'var(--mod-discover)' },
      { name: 'Exit Candidate', hue: 'var(--rose-500)', status: 'watch' },
    ];
    const container = mount(<ItemQueueBlock slotName="roles" data={richer} />);
    expect(container.querySelector('ul')).toBeTruthy(); // the per-row `<li>` list, not the chip row
    expect(container.querySelectorAll('li').length).toBe(2);
    expect(container.textContent).toContain('watch');
  });

  it('still renders normally for genuinely rich items (regression guard, unchanged behavior)', () => {
    const dests = [{ name: 'Shopify', meta: '30 edits · 4 collections', status: 'staged' }];
    const container = mount(<ItemQueueBlock slotName="dests" data={dests} />);
    expect(container.querySelector('ul')).toBeTruthy();
    expect(container.textContent).toContain('Shopify');
  });

  it('renders compactly (a small mono label, no BlockCard) when `compact`', () => {
    const roles = [{ name: 'Hero', hue: 'var(--mod-discover)' }, { name: 'Core', hue: 'var(--r-blue-500)' }];
    const container = mount(<ItemQueueBlock slotName="roles" data={roles} compact />);
    expect(container.querySelector('.rounded-2xl')).toBeFalsy();
    expect(container.textContent).toContain('Hero');
  });
});
