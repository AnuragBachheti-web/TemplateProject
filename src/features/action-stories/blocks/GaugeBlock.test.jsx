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

  it('shows the value against its threshold WITHOUT judging which side is good', () => {
    // REPLACED IN PHASE 5B. This asserted that a value over its threshold renders
    // `bg-rf-status-critical` — and that premise did not survive looking at the result. On
    // S9.18/decide the coverage rows are two floors and two ceilings:
    //
    //     On-time · DTC   95.6%  pct 70  limitPct 63  note "floor 95% · scale 90-98%"
    //     Split rate       8.2%  pct 59  limitPct 57  note "ceiling 8% · scale 0-14%"
    //
    // Past a ceiling is a breach; past a floor is comfort. The screenshot showed "On-time · DTC
    // 95.6%" painted critical red while its own note called 95% a floor. The direction exists ONLY
    // in that prose, and reading it out would be a classifier on text deciding what is good news —
    // the move ruling R72 declined for `tag`/`flag`/`badge`/`kind`/`optimal`, and R2 forbids for
    // recovering numbers from display strings.
    //
    // So the block draws the bar, the tick and the note, and the operator judges. What this test
    // still protects — and what it was really written for (R25) — is that no palette literal
    // reaches the DOM: the tone, whatever it is, comes from statusTone and nowhere else.
    const container = mount(<GaugeBlock slotName="tolerance" data={[{ label: 'Over', value: '9%', threshold: '4%' }]} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/bg-rose-|text-rose-|bg-emerald-|text-emerald-/);
    expect(html, 'the gauge must not colour a verdict it cannot derive').not.toContain('rf-status-');
    expect(html, 'the value still renders').toContain('9%');
  });
});
