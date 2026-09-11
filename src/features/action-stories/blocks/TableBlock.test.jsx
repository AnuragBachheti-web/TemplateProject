// @vitest-environment jsdom
//
// TableBlock uses real interactive state (sort/page), unlike every other block — a real render is
// required to exercise it, same convention as BlockErrorBoundary.test.jsx/StageRenderer.test.jsx.
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import TableBlock from './TableBlock';

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

function click(el) {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('TableBlock — empty/error states (real render, since it now uses hooks)', () => {
  it('renders EmptyState for null/empty array', () => {
    expect(mount(<TableBlock slotName="x" data={null} />).textContent).toContain('Nothing here yet');
    expect(mount(<TableBlock slotName="x" data={[]} />).textContent).toContain('No rows');
  });

  it('renders ErrorState for the wrong type', () => {
    expect(mount(<TableBlock slotName="x" data="nope" />).textContent).toContain('expected a table');
  });

  it('renders real content for valid rows, with a caption and scoped column headers', () => {
    const container = mount(<TableBlock slotName="items" data={[{ name: 'A', sku: 'X-1', qty: 3 }]} />);
    expect(container.querySelector('caption')).toBeTruthy();
    expect(container.querySelector('caption').textContent).toContain('Items');
    const th = container.querySelector('th');
    expect(th.getAttribute('scope')).toBe('col');
  });
});

describe('TableBlock — missing-value representation (regression: blank cell indistinguishable from N/A)', () => {
  it('renders a visible dash for null/undefined/empty cells, distinct from a real value', () => {
    const container = mount(<TableBlock slotName="x" data={[{ a: 'real value', b: null, c: undefined, d: '' }]} />);
    const cells = [...container.querySelectorAll('tbody td')];
    expect(cells[0].textContent).toBe('real value');
    expect(cells[1].textContent).toContain('—');
    expect(cells[2].textContent).toContain('—');
    expect(cells[3].textContent).toContain('—');
  });
});

describe('TableBlock — sorting', () => {
  const data = [{ name: 'Charlie', score: 3 }, { name: 'Alice', score: 1 }, { name: 'Bob', score: 2 }];

  it('sorts ascending on first header click, descending on second, clears on third', () => {
    const container = mount(<TableBlock slotName="x" data={data} />);
    const nameHeaderButton = [...container.querySelectorAll('th button')][0];

    click(nameHeaderButton);
    let names = [...container.querySelectorAll('tbody tr')].map((tr) => tr.children[0].textContent);
    expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
    expect(container.querySelector('th[aria-sort="ascending"]')).toBeTruthy();

    click(nameHeaderButton);
    names = [...container.querySelectorAll('tbody tr')].map((tr) => tr.children[0].textContent);
    expect(names).toEqual(['Charlie', 'Bob', 'Alice']);
    expect(container.querySelector('th[aria-sort="descending"]')).toBeTruthy();

    click(nameHeaderButton);
    names = [...container.querySelectorAll('tbody tr')].map((tr) => tr.children[0].textContent);
    expect(names).toEqual(['Charlie', 'Alice', 'Bob']); // back to original declared order
  });

  it('sorts numerically, not lexicographically, for a numeric column', () => {
    const wide = [{ score: 2 }, { score: 10 }, { score: 1 }];
    const container = mount(<TableBlock slotName="x" data={wide} />);
    click(container.querySelector('th button'));
    const values = [...container.querySelectorAll('tbody tr')].map((tr) => tr.children[0].textContent);
    expect(values).toEqual(['1', '2', '10']); // not ['1', '10', '2'] (string sort)
  });
});

describe('TableBlock — pagination and sticky header (only past the row-count threshold)', () => {
  it('does not paginate or scroll-wrap a small table', () => {
    const small = Array.from({ length: 5 }, (_, i) => ({ n: i }));
    const container = mount(<TableBlock slotName="x" data={small} />);
    expect(container.textContent).not.toContain('Page 1 of');
    expect(container.querySelector('.max-h-\\[420px\\]')).toBeFalsy();
  });

  it('paginates and adds a scroll region with a sticky header for a large table', () => {
    const large = Array.from({ length: 60 }, (_, i) => ({ n: i, label: `Row ${i}` }));
    const container = mount(<TableBlock slotName="x" data={large} />);
    expect(container.textContent).toContain('Page 1 of 3'); // 60 rows / 25 per page
    expect(container.querySelectorAll('tbody tr').length).toBe(25);
    expect(container.querySelector('th.sticky')).toBeTruthy();

    const nextButton = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Next');
    click(nextButton);
    expect(container.textContent).toContain('Page 2 of 3');
    // Row 0-24 on page 1, row 25 should now be first on page 2.
    expect(container.querySelector('tbody tr').textContent).toContain('25');
  });

  it('resets to page 1 when sorting changes', () => {
    const large = Array.from({ length: 60 }, (_, i) => ({ n: i }));
    const container = mount(<TableBlock slotName="x" data={large} />);
    const nextButton = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Next');
    click(nextButton);
    expect(container.textContent).toContain('Page 2 of 3');
    click(container.querySelector('th button'));
    expect(container.textContent).toContain('Page 1 of 3');
  });
});

describe('TableBlock — column union across rows (regression guard, unchanged behavior)', () => {
  it('unions columns across all rows, not just row 0', () => {
    const data = [{ a: 1 }, { a: 2, b: 3 }];
    const container = mount(<TableBlock slotName="x" data={data} />);
    const headers = [...container.querySelectorAll('th')].map((th) => th.textContent.trim());
    expect(headers).toEqual(['A', 'B']);
  });
});

describe('TableBlock — compact mode (no nested card when already inside a shared panel)', () => {
  it('renders the table without BlockCard\'s own rounded-2xl/shadow-xs wrapper when compact', () => {
    const data = [{ a: 1, b: 2, c: 3, d: 4 }];
    const compact = mount(<TableBlock slotName="x" data={data} compact />);
    const full = mount(<TableBlock slotName="x" data={data} />);
    expect(compact.querySelector('.rounded-2xl')).toBeFalsy();
    expect(compact.querySelector('.shadow-xs')).toBeFalsy();
    expect(full.querySelector('.rounded-2xl')).toBeTruthy();
    // Same table content either way — compact changes the wrapper, never the data.
    expect(compact.querySelector('table')).toBeTruthy();
    expect(compact.textContent).toContain('1');
  });

  it('still renders sort/pagination controls when compact (interactivity is unaffected)', () => {
    const large = Array.from({ length: 30 }, (_, i) => ({ n: i })); // > PAGE_SIZE (25), forces pageCount > 1
    const container = mount(<TableBlock slotName="x" data={large} compact />);
    expect(container.textContent).toContain('Page 1 of');
    const nextButton = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Next');
    expect(nextButton).toBeTruthy();
  });

  it('still scrolls/sticky-headers a large table when compact (the row-count threshold is unaffected)', () => {
    const large = Array.from({ length: 15 }, (_, i) => ({ n: i })); // > LARGE_TABLE_ROW_THRESHOLD (12)
    const container = mount(<TableBlock slotName="x" data={large} compact />);
    expect(container.querySelector('.max-h-\\[420px\\]')).toBeTruthy();
    expect(container.querySelector('.sticky')).toBeTruthy();
  });
});

describe('TableBlock — wide-table scroll affordance (RENDERED_UI_FORENSIC_AUDIT.md §3.6/§11)', () => {
  it('renders a scrollable region plus both edge-fade cues (hidden by default, never intercepting clicks)', () => {
    const data = [{ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 }];
    const container = mount(<TableBlock slotName="wide" data={data} />);
    const scrollRegion = container.querySelector('.overflow-x-auto, .overflow-auto');
    expect(scrollRegion).toBeTruthy();
    const fades = container.querySelectorAll('[aria-hidden="true"].pointer-events-none');
    expect(fades.length).toBe(2); // left + right edge fade
    for (const fade of fades) {
      expect(fade.className).toContain('opacity-0'); // jsdom reports no real scrollWidth, so no fade shows by default
    }
  });

  it('never throws when the scroll container has no measurable width (jsdom has no real layout)', () => {
    const data = [{ a: 1, b: 2 }];
    expect(() => mount(<TableBlock slotName="x" data={data} />)).not.toThrow();
  });
});
