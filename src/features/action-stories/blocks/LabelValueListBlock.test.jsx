// @vitest-environment jsdom
//
// Density fix (RENDERED_UI_FORENSIC_AUDIT.md §3.2/§13): the primary-value resolver used to only
// recognize a fixed key list (value/note/detail/amount/pct); any other real field name (`meta`,
// `n`, `w`, `key`, `numeric`) fell back to a blank primary row plus a stacked "extra entry" line —
// 2–3 lines for what should be one. Uses a real render (createRoot), since the row/inline-field
// logic is easiest to assert against actual rendered text and line count.
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import LabelValueListBlock from './LabelValueListBlock';

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

function rowCountFor(container) {
  return container.querySelectorAll('li').length;
}

describe('LabelValueListBlock — generic primary-value resolution (no growing hardcoded key list)', () => {
  it('label + meta: promotes `meta` to the primary value (one line, not a stacked extra)', () => {
    const container = mount(<LabelValueListBlock slotName="inputs" data={[{ label: 'Orders · 90 days', meta: '18,402 rows' }]} />);
    expect(container.textContent).toContain('18,402 rows');
    // A single row: no secondary "Meta: ..." line underneath.
    expect(container.querySelectorAll('li > div').length).toBe(1);
  });

  it('label + n: promotes `n` to the primary value', () => {
    const container = mount(<LabelValueListBlock slotName="moveBar" data={[{ label: 'Keep', n: 162 }]} />);
    expect(container.textContent).toContain('162');
    expect(container.querySelectorAll('li > div').length).toBe(1);
  });

  it('label + w: promotes `w` to the primary value', () => {
    const container = mount(<LabelValueListBlock slotName="x" data={[{ label: 'Keep', w: 74.3 }]} />);
    expect(container.textContent).toContain('74.3');
    expect(container.querySelectorAll('li > div').length).toBe(1);
  });

  it('label + key: promotes `key` to the primary value', () => {
    const container = mount(<LabelValueListBlock slotName="cols" data={[{ label: 'Product', key: 'product' }]} />);
    expect(container.textContent).toContain('product');
    expect(container.querySelectorAll('li > div').length).toBe(1);
  });

  it('label + numeric: promotes `numeric` (a boolean) to the primary value', () => {
    const container = mount(<LabelValueListBlock slotName="cols" data={[{ label: 'GMROI', numeric: true }]} />);
    // flattenNestedEntry's own boolean convention (see nestedEntryText.js) — "Yes", not "true".
    expect(container.textContent).toContain('Yes');
  });

  it('label + n + w: `n` becomes the primary value, `w` joins it INLINE on the same row (moveBar\'s exact shape)', () => {
    const container = mount(<LabelValueListBlock slotName="moveBar" data={[{ label: 'Keep', n: 162, w: 74.3 }]} />);
    expect(rowCountFor(container)).toBe(1);
    // Exactly one row — no secondary stacked line for `w`.
    expect(container.querySelectorAll('li > div').length).toBe(1);
    expect(container.textContent).toContain('162');
    expect(container.textContent).toContain('74.3');
  });

  it('label + value: unchanged behavior (the explicit priority key still wins)', () => {
    const container = mount(<LabelValueListBlock slotName="x" data={[{ label: 'GMROI target', value: '≥ 2.4' }]} />);
    expect(container.textContent).toContain('≥ 2.4');
  });

  it('label + value + note (note is long prose): value is primary, the long note keeps its own secondary line', () => {
    const note = 'Gross margin return on inventory investment, measured per SKU across 90 days of true CM.';
    const container = mount(<LabelValueListBlock slotName="policy" data={[{ label: 'GMROI target', value: '≥ 2.4', note }]} />);
    const rows = container.querySelectorAll('li');
    expect(rows).toHaveLength(1);
    // Two internal lines: the primary label/value row, and note's own secondary line (long prose).
    // PHASE 8: both now sit INSIDE the shared RailRow, so they are one level deeper than they were
    // — the long line belongs to its row visually as well as structurally, which is the point of
    // the row having a divider at all.
    expect(rows[0].querySelectorAll('[data-rail-row] > div')).toHaveLength(2);
    expect(container.textContent).toContain(note);
  });

  it('label + multiple meaningful fields, one long: short fields inline, the long one keeps its own line', () => {
    const data = [{ label: 'Exit-rate cap', value: '≤ 8%', current: '5.1%', why: 'Protects channel ranking and review velocity from a mass delist.' }];
    const container = mount(<LabelValueListBlock slotName="checks" data={data} />);
    const rows = container.querySelectorAll('li');
    // Primary line (value) + current inlined + why on its own line = 2 internal <div>s, not 3.
    expect(rows[0].querySelectorAll('[data-rail-row] > div')).toHaveLength(2);
    expect(container.textContent).toContain('5.1%');
    expect(container.textContent).toContain('Protects channel ranking');
  });

  it('label + decorative fields only: decorative fields never leak as extra entries or inline text', () => {
    const container = mount(<LabelValueListBlock slotName="x" data={[{ label: 'Hero', hue: 'var(--mod-discover)', tint: 'var(--r-blue-50)' }]} />);
    expect(container.textContent).not.toContain('var(--');
    expect(container.textContent).not.toContain('Hue');
    expect(container.textContent).not.toContain('Tint');
  });

  it('a compound decorative key (dotInner) is filtered even though the decorative word isn\'t a suffix', () => {
    const container = mount(<LabelValueListBlock slotName="slates" data={[{ label: 'Balanced', flag: 'Recommended', dotInner: 'transparent' }]} />);
    expect(container.textContent).not.toContain('Dot Inner');
    expect(container.textContent).not.toContain('transparent');
    expect(container.textContent).toContain('Recommended');
  });

  it('never throws and degrades gracefully when an item has only a label (no candidate value at all)', () => {
    expect(() => mount(<LabelValueListBlock slotName="x" data={[{ label: 'Lonely' }]} />)).not.toThrow();
  });
});
