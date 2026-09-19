// @vitest-environment jsdom
//
// TableBlock uses real interactive state (sort/page), unlike every other block — a real render is
// required to exercise it, same convention as BlockErrorBoundary.test.jsx/StageRenderer.test.jsx.
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import TableBlock from './TableBlock';
import { splitColumns } from './tableColumns';
import { flattenDisplayValue } from './flattenDisplayValue';
import { isHiddenKey } from './decorativeKeys';
import { SLOT_VOCABULARY } from '../templates/slotVocabulary';
import { slateItemIdOf } from '../contract/slateItem';
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json';

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
    // The fixture grew from one row to three under Phase 5E's column rule. A one-row table makes
    // every field trivially "shared", so it could no longer distinguish the case this test is
    // about — a REAL column with a blank in it, which still needs its dash — from the case the
    // rule removes: a column that is blank on nearly every row. Three rows states which one is
    // meant. The assertion itself is unchanged: a missing value reads as "—", never as nothing.
    const container = mount(<TableBlock slotName="x" data={[
      { a: 'real value', b: 'b1', c: 'c1', d: 'd1' },
      { a: 'blank row', b: null, c: undefined, d: '' },
      { a: 'third', b: 'b3', c: 'c3', d: 'd3' },
    ]} />);
    const cells = [...container.querySelectorAll('tbody tr:nth-child(2) td')];
    expect(cells[0].textContent).toBe('blank row');
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

describe('TableBlock — columns are the fields the records SHARE (Phase 5E, R74)', () => {
  // REPLACES "unions columns across all rows". That guard pinned the old behaviour and its own
  // premise — "the classifier only types uniform arrays as `table`, so the union equals row 0" —
  // was false for 29 of the corpus's 116 tables. prop_s10_1_decide's slate unioned four records
  // carrying 4-7 fields into fifteen columns in an 834px region, wrapping a 213-character paragraph
  // over nineteen lines. What the guard was protecting — a field must never silently vanish — still
  // holds and is asserted below: a minority field MOVES to the row's detail line.
  it('a field a minority of rows carry is not a column', () => {
    const data = [{ a: 1 }, { a: 2, b: 3 }];
    const container = mount(<TableBlock slotName="x" data={data} />);
    const headers = [...container.querySelectorAll('th')].map((th) => th.textContent.trim());
    expect(headers).toEqual(['A']);
  });

  it('…and its value is still on the page, attached to its own row (R75)', () => {
    const data = [{ a: 1 }, { a: 2, b: 'only on the second row' }];
    const container = mount(<TableBlock slotName="x" data={data} />);
    expect(container.textContent).toContain('only on the second row');
    expect(container.textContent).toContain('B:');
  });

  it('a field every row carries stays a column', () => {
    const data = [{ a: 1, b: 2 }, { a: 3, b: 4 }];
    const container = mount(<TableBlock slotName="x" data={data} />);
    expect([...container.querySelectorAll('th')].map((th) => th.textContent.trim())).toEqual(['A', 'B']);
  });
});

describe('TableBlock — compact mode (no nested card when already inside a shared panel)', () => {
  it('renders the table without BlockCard\'s own card wrapper when compact', () => {
    // PHASE 6 (R99). This used to test for `.rounded-2xl` — BlockCard's radius — which worked only
    // because the card and the compact table happened to round differently. One card treatment
    // means they no longer do, and a radius stopped identifying a card.
    //
    // THE SHADOW IS WHAT MAKES A CARD A CARD: it is what lifts a surface off the page, and it is
    // the one thing a compact table inside a shared panel must not draw. What this guards is
    // unchanged — a table already in a panel may round its own border, but it may not become a
    // second card.
    const data = [{ a: 1, b: 2, c: 3, d: 4 }];
    const compact = mount(<TableBlock slotName="x" data={data} compact />);
    const full = mount(<TableBlock slotName="x" data={data} />);
    expect(compact.querySelector('.shadow-card'), 'compact drew a card').toBeFalsy();
    expect(full.querySelector('.shadow-card'), 'standalone drew no card').toBeTruthy();
    expect(full.querySelector('.rounded-xl')).toBeTruthy();
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

describe('T93 — a demoted field moves, it does not disappear (Phase 5E, R75)', () => {
  // THE WHOLE CORPUS, not a fixture. The rule in tableColumns.js decides which fields stop being
  // columns; this asserts the other half of R75 — that every one of them is still READ somewhere on
  // the page, attached to the row it belongs to. A fixture cannot prove that, because the fields
  // this rule demotes are exactly the irregular ones a hand-written fixture would not think to
  // carry.
  const at = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  const TABLES = [];
  for (const d of dataset) {
    for (const [slot, spec] of Object.entries(SLOT_VOCABULARY)) {
      if (spec.blockType !== 'table') continue;
      const rows = at(d, spec.binding);
      if (Array.isArray(rows) && rows.length > 0 && splitColumns(rows, isHiddenKey).detail.length > 0) {
        TABLES.push({ id: d.proposal_id, slot, rows });
      }
    }
  }

  it('measures every table the rule actually fires on', () => {
    expect(TABLES.length, 'the rule fires on nothing — this test would pass vacuously').toBeGreaterThan(5);
  });

  it('every demoted value that can be displayed at all is on the page, under its own label', () => {
    const missing = [];
    for (const t of TABLES) {
      const { detail } = splitColumns(t.rows, isHiddenKey);
      const text = mount(<TableBlock slotName={t.slot} data={t.rows} />).textContent;
      for (const row of t.rows) {
        for (const key of detail) {
          const shown = flattenDisplayValue(row[key]);
          if (shown === '' || shown === undefined || shown === null) continue;
          if (!text.includes(shown)) missing.push(`${t.id} · ${t.slot}: "${key}" = ${JSON.stringify(shown.slice(0, 40))}`);
        }
      }
    }
    expect(missing, 'a value left the columns and did not arrive anywhere').toEqual([]);
  });

  it('records every field NO table can display, so they are not mistaken for this rule\'s doing', () => {
    // R75 ACCOUNTING, measured by rendering all 105 objects before and after the change and diffing
    // the rendered text as multisets. 450 strings left the page and NONE of them was data:
    //
    //   426  the missing-value marker — "—" and its sr-only "No value" — on cells that no longer
    //        exist. Removing them is the entire point of the rule.
    //    24  COLUMN HEADERS, listed below. Every one labelled a column that rendered "—" on EVERY
    //        row, before this change and after it.
    //
    // 55 strings were gained: the detail line's own labels. Nothing else moved — T13's four pinned
    // pane baselines did not change by a character.
    //
    // Their values are arrays of objects ([{sku, qty}], [{label}], [{name, initials}],
    // [{title, chip, detail}]) and flattenDisplayValue returns '' for a plain object it does not
    // recognise — so "A. Castellanos · Ops" and "Fix in PIM, regenerate feed" were never on the
    // page at any point in this project's history. What was removed is a label over nothing, which
    // is the same noise as the dashes beneath it. Nothing an operator could read has moved except
    // into a detail line, which the test above asserts for every demoted value in the corpus.
    //
    // THE UNRENDERED DATA IS A REAL GAP AND IT IS NOT THIS PHASE'S. nestedEntryText.js already
    // reads exactly these shapes, so the detail line COULD print them — and that would put text on
    // the page that has never been there, which is a functional change. R74 lifted I5 for column
    // selection and nothing else. Recorded here for the ledger rather than quietly fixed, and the
    // list is pinned so it cannot grow unnoticed.
    //
    // A SECOND, SEPARATE FINDING, recorded for the same ledger. Three columns are hollow on screen
    // and are NOT in this list, because their emptiness is in the data rather than in the renderer:
    // prop_s9_9_execute's plan.st is the literal string "—" on all 9 rows, prop_s9_4_decide's
    // coverStr on 3 of 5, prop_s9_12_execute's ledger.hash on 3 of 4. They still render as columns,
    // deliberately. Demoting them would take a rule that reads a cell's text and decides it means
    // nothing — a content classifier in the layout layer, which is the defect class this project
    // has removed four times (R72). The corpus writing "no value" as a dash is the corpus's to fix.
    const unreadable = [];
    for (const t of TABLES) {
      for (const key of splitColumns(t.rows, isHiddenKey).detail) {
        const carried = t.rows.filter((r) => r?.[key] !== undefined && r?.[key] !== null && r?.[key] !== '');
        if (carried.length > 0 && carried.every((r) => flattenDisplayValue(r[key]) === '')) {
          unreadable.push(`${t.id} · ${t.slot}: ${key}`);
        }
      }
    }
    expect(unreadable.sort()).toEqual([
      'prop_s10_1_decide · slate: bandOptions',
      'prop_s10_1_decide · slate: cards',
      'prop_s10_1_decide · slate: people',
      'prop_s10_2_decide · slate: sizes',
      'prop_s10_2_execute · plan: items',
      'prop_s10_3_execute · plan: items',
      'prop_s10_4_execute · plan: items',
      'prop_s10_5_decide · slate: options',
      'prop_s10_5_execute · plan: items',
      'prop_s10_6_execute · plan: items',
      'prop_s9_10_decide · slate: sponsors',
      'prop_s9_11_execute · plan: diff',
      'prop_s9_14_decide · slate: options',
      'prop_s9_16_execute · plan: items',
      'prop_s9_17_decide · slate: candidates',
      'prop_s9_17_decide · slate: trade',
      'prop_s9_18_execute · plan: items',
      'prop_s9_19_decide · slate: channels',
      'prop_s9_19_execute · plan: items',
      'prop_s9_20_execute · plan: items',
      'prop_s9_2_decide · slate: lines',
      'prop_s9_3_decide · slate: options',
      'prop_s9_9_decide · slate: ladder',
      'prop_s9_9_decide · slate: options',
    ]);
  });
});

// THE WIRING, NOT JUST THE RULE. slateItem.test.js proves `slateItemIdOf` gives distinct ids; this
// proves the block wired the way StagePage wires it turns them into distinct checkboxes. The bug
// lived in neither module — it lived in the call between them, so only a test that makes the same
// call catches it coming back.
describe('TableBlock — row selection is per-row (regression: one tick checked every box)', () => {
  const slate = [{ label: 'Spawn remediation cards' }, { label: 'Annotate and archive' }, { label: 'Adjust the contract band' }];

  function mountSlate(selectedIds, onToggleRow) {
    return mount(
      <TableBlock
        slotName="slate"
        data={slate}
        selectable
        selectedIds={selectedIds}
        onToggleRow={onToggleRow}
        rowIdOf={slateItemIdOf}
      />,
    );
  }

  it('gives each id-less row its own id, so a click reports only that row', () => {
    const toggled = [];
    const container = mountSlate([], (id) => toggled.push(id));
    const boxes = [...container.querySelectorAll('input[type="checkbox"]')];
    expect(boxes).toHaveLength(slate.length);

    click(boxes[1]);
    expect(toggled).toEqual(['item_1']);
    click(boxes[2]);
    expect(toggled).toEqual(['item_1', 'item_2']);
  });

  it('checks ONLY the selected row, not the whole table', () => {
    const container = mountSlate(['item_1'], () => {});
    const boxes = [...container.querySelectorAll('input[type="checkbox"]')];
    expect(boxes.map((b) => b.checked)).toEqual([false, true, false]);
  });

  it('a row carrying a business id keeps it, and is unaffected', () => {
    const toggled = [];
    const container = mount(
      <TableBlock
        slotName="slate"
        data={[{ sku: 'X-1', label: 'A' }, { label: 'B' }]}
        selectable
        selectedIds={[]}
        onToggleRow={(id) => toggled.push(id)}
        rowIdOf={slateItemIdOf}
      />,
    );
    const boxes = [...container.querySelectorAll('input[type="checkbox"]')];
    click(boxes[0]);
    click(boxes[1]);
    expect(toggled).toEqual(['X-1', 'item_1']);
  });
});
