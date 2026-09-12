// @vitest-environment jsdom
//
// End-to-end regression test for the canonical case DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md's forensic
// pass used to trace the reference-fidelity gap: S9.11 Decide. Exercises the REAL, on-disk manifest
// and fixture (not a hand-built fixture) through the REAL StageRenderer, so a regression anywhere in
// extraction -> classification -> manifest generation -> composition -> rendering shows up here —
// see DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §3 for the original failure this guards against (the
// reference's "Price slate" table + tolerance slider degrading into a bare number + a 9-bar chart
// with no SKU identity, no Roll/Test control, and no relationship between the slider and the table).
//
// Every assertion here is possible with ZERO workflow-specific code anywhere in the rendering
// pipeline — nothing in extraction/classifyBlocks.js, extraction/generateManifests.js,
// layout/composeSections.js, or StageRenderer.jsx knows this workflow is "S9.11"; every one of these
// outcomes falls out of the same generic rules any other workflow's own Decide-stage slider + table
// would get (S9.2 and S9.12 have their own real reference sliders, produced by the same pipeline).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import StageRenderer from './components/StageRenderer';
import manifests from './manifests/S9.11.json';
import fixture from './data/raw/S9.11/decide.json';

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

describe("S9.11 Decide — end-to-end regression (the forensic audit's canonical case)", () => {
  const manifest = manifests.find((m) => m.stageKey === 'decide');
  const slateBlock = manifest.blocks.find((b) => b.slotName === 'slate');
  const tolBlock = manifest.blocks.find((b) => b.slotName === 'tol');

  it('1. a real range control was extracted (min/max/step survive, not just the current value)', () => {
    const tolData = fixture.data.tol;
    expect(tolData.min).toBe(1);
    expect(tolData.max).toBe(8);
    expect(tolData.step).toBe(0.5);
    expect(typeof tolData.value).toBe('number');
  });

  it('2. the manifest classifies the control as a real slider block', () => {
    expect(tolBlock.blockType).toBe('slider');
  });

  it('3. the raw slate records survive extraction (real numeric old/nu/p10/p90/cm, not only formatted strings)', () => {
    const row = fixture.data.slate[0].__raw;
    expect(row).toBeTruthy();
    expect(typeof row.old).toBe('number');
    expect(typeof row.nu).toBe('number');
    expect(typeof row.p10).toBe('number');
    expect(typeof row.p90).toBe('number');
    expect(typeof row.pref).toBe('string');
  });

  it('4. the slate is classified as a real table, not a chart or a generic card wall', () => {
    expect(slateBlock.blockType).toBe('table');
  });

  it("5. each row's Roll/Test modes survive as a reachable nested control, not flattened away", () => {
    expect(Array.isArray(fixture.data.slate[0].modes)).toBe(true);
    expect(fixture.data.slate[0].modes.map((m) => m.label)).toEqual(['Roll', 'Test']);
  });

  it('6. the manifest carries real, generated dependency metadata for the control', () => {
    expect(Array.isArray(tolBlock.dependencies)).toBe(true);
    expect(tolBlock.dependencies).toContain('slate');
    expect(tolBlock.dependencies.length).toBeGreaterThan(5);
  });

  it('7. composition groups the control and its dependents into one panel (shared layout.group)', () => {
    expect(tolBlock.layout?.group).toBeTruthy();
    expect(slateBlock.layout?.group).toBe(tolBlock.layout.group);
    expect(slateBlock.section).toBe(tolBlock.section);
  });

  it('8. rendering: the table shows real SKU identity and a data-driven Roll/Test control, the slider has real bounds, and rail content renders', () => {
    const container = mount(<StageRenderer manifest={manifest} fixture={fixture} />);
    expect(container.textContent).toContain('NW-KNF-0480');
    expect(container.textContent).toContain('Alder chef knife 8in');
    const buttons = [...container.querySelectorAll('button')].map((b) => b.textContent);
    expect(buttons).toContain('Roll');
    expect(buttons).toContain('Test');
    const slider = container.querySelector('input[type="range"]');
    expect(slider).toBeTruthy();
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('8');
    expect(slider.step).toBe('0.5');
    expect(container.textContent).toMatch(/Summary/i);
  });

  it('9. interaction: dragging the slider updates its dependent content (a real recompute, not a decorative control)', () => {
    const container = mount(<StageRenderer manifest={manifest} fixture={fixture} />);
    const table = container.querySelector('table');
    const before = table.textContent;
    const slider = container.querySelector('input[type="range"]');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(slider, '1');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const after = container.querySelector('table').textContent;
    expect(after).not.toBe(before);
  });

  it('10. no workflow-specific condition exists anywhere in the pipeline that this test depends on', () => {
    const files = [
      'extraction/classifyBlocks.js',
      'extraction/generateManifests.js',
      'src/features/action-stories/layout/composeSections.js',
      'src/features/action-stories/components/StageRenderer.jsx',
      'src/features/action-stories/blocks/TableBlock.jsx',
      'src/features/action-stories/blocks/SliderBlock.jsx',
    ];
    // Looks specifically for the forbidden shape (`if (...S9.11...)`, `case "S9.11":`, a workflow
    // code compared with ===/==) — not merely a line that mentions "S9.11" anywhere (several files
    // legitimately cite it as a documentation EXAMPLE in a comment or a generated markdown string,
    // which is not the anti-pattern being guarded against here).
    const CONDITIONAL_ON_WORKFLOW_RE = /(if|case|switch)\s*\(?[^)\n]*(['"]S9\.11['"]|===\s*['"]S9\.11['"])/;
    for (const file of files) {
      const src = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
      const offendingLine = src.split('\n').find((line) => CONDITIONAL_ON_WORKFLOW_RE.test(line));
      expect(offendingLine, `${file} appears to contain a workflow-specific conditional: ${offendingLine}`).toBeUndefined();
    }
  });
});
