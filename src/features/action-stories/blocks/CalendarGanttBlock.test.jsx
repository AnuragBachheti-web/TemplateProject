// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import CalendarGanttBlock from './CalendarGanttBlock';

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

const lanes = [
  {
    name: 'Shopify DTC',
    note: '41% of GMV',
    blocks: [
      { col: '5 / span 2', label: 'Early Black Friday', sub: '25% off · 34 SKUs', conflicts: 2 },
      { col: '13 / span 1', label: 'Clearance', sub: '40% · aged' },
    ],
  },
  {
    name: 'Amazon',
    note: '45% of GMV',
    blocks: [{ col: '1 / span 1', label: 'Prime Fall', sub: '20% · 22 SKUs', conflicts: 1 }],
  },
];

describe('CalendarGanttBlock — named lanes positioned on a shared column grid', () => {
  it('renders every lane name and its blocks', () => {
    const container = mount(<CalendarGanttBlock slotName="calendar" data={lanes} />);
    expect(container.textContent).toContain('Shopify DTC');
    expect(container.textContent).toContain('Amazon');
    expect(container.textContent).toContain('Early Black Friday');
    expect(container.textContent).toContain('Prime Fall');
  });

  it('sizes the grid to the rightmost column any block actually reaches', () => {
    // "13 / span 1" is the widest reach in this data → 13 columns.
    const container = mount(<CalendarGanttBlock slotName="calendar" data={lanes} />);
    expect(container.querySelector('[role="img"]').getAttribute('aria-label')).toBe('Calendar, 2 lanes across 13 columns.');
  });

  it('shifts every block one grid line right, past the lane-name column', () => {
    const container = mount(<CalendarGanttBlock slotName="calendar" data={lanes} />);
    const primeFall = container.querySelector('[title="Prime Fall · 20% · 22 SKUs"]');
    expect(primeFall).not.toBeNull();
    expect(primeFall.style.gridColumn).toBe('2 / span 1'); // raw "1 / span 1" + 1
  });

  it('shows a conflict badge only when a block actually carries one', () => {
    const container = mount(<CalendarGanttBlock slotName="calendar" data={lanes} />);
    const earlyBF = container.querySelector('[title="Early Black Friday · 25% off · 34 SKUs"]');
    expect(earlyBF.textContent).toContain('2'); // its own conflict count

    // Clearance carries no `conflicts` field at all — no badge for it.
    const clearance = container.querySelector('[title="Clearance · 40% · aged"]');
    expect(clearance.querySelector('.font-mono')).toBeNull();
  });

  it('renders an empty state for null/undefined, an error state for the wrong shape', () => {
    expect(mount(<CalendarGanttBlock slotName="calendar" data={null} />).textContent).toContain('Calendar');
    expect(mount(<CalendarGanttBlock slotName="calendar" data="not an array" />).textContent).toMatch(/expected an array/);
    expect(mount(<CalendarGanttBlock slotName="calendar" data={[]} />).textContent).toContain('No lanes.');
  });

  it('errors rather than rendering a bare grid when no block has a usable column placement', () => {
    const noPositions = [{ name: 'Lane', blocks: [{ col: 'not-a-grid-line', label: 'x' }] }];
    expect(mount(<CalendarGanttBlock slotName="calendar" data={noPositions} />).textContent).toMatch(/no positioned blocks/);
  });
});
