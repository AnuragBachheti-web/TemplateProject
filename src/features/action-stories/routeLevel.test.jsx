// @vitest-environment jsdom
//
// Route-level rendering — AUDIT_REPORT.md §20/§24 P1 #5: none of Shell/StagePage/ActionStoriesHome
// had any test coverage; the race-condition-guard logic (the `cancelled` flag + AbortController)
// in particular is exactly the kind of thing worth a real test given how easy it is to regress
// silently. Uses a real MemoryRouter + React's real client renderer (jsdom), reading actual
// on-disk fixtures (S9.1) — no mocking of the data layer, since the whole point is to prove the
// real pipeline (service -> StagePage -> StageRenderer) works end to end through routing.
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import Shell from './components/Shell';
import ActionStoriesHome from './pages/ActionStoriesHome';
import StagePage from './pages/StagePage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mountAt(initialPath) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/action-stories" element={<Shell />}>
            <Route index element={<ActionStoriesHome />} />
            <Route path=":code/:stageKey" element={<StagePage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  });
  return { container, root };
}

// StagePage's data fetch is async (real module loads, chained through Promise.all and a couple of
// microtask turns of wrapping) — flush repeatedly under `act` until the DOM settles, rather than
// guessing a fixed number of ticks.
async function flush(times = 10) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

describe('route-level rendering — a real workflow/stage URL renders real content end to end', () => {
  it('renders the sidebar, header, and stage body for /action-stories/S9.1/reason', async () => {
    const { container } = mountAt('/action-stories/S9.1/reason');
    await flush();

    // Sidebar: real workflow list loaded.
    expect(container.textContent).toContain('Action Stories');
    expect(container.querySelectorAll('nav a').length).toBeGreaterThan(0);

    // Page header: the real stage name/code.
    expect(container.querySelector('h1')).toBeTruthy();
    expect(container.textContent).toContain('S9.1');

    // No leftover "Loading…" or raw error text once settled.
    expect(container.textContent).not.toMatch(/Loading…/);
  });

  it('renders real section headers end to end for a sectioned stage (S9.1/decide — the audit\'s own "wall of cards" example)', async () => {
    const { container } = mountAt('/action-stories/S9.1/decide');
    await flush();

    // "Analysis" is gone: heroMetrics (previously its only member) is now part of the composed
    // "recommendation" panel (region: main, no header of its own — see StageSections.jsx) instead
    // of its own section. "Totals"/"Basis" are new (FORENSIC_AUDIT_S9.1.md's `rollup`/`provenance`
    // rail sections) — this exact list is the regression-guard for the semantic-placement fix.
    const headings = [...container.querySelectorAll('h2')].map((h) => h.textContent);
    expect(headings).toEqual(['Guardrails', 'Summary', 'Totals', 'Basis', 'Details']);

    // Section landmarks are real, labeled regions — not just visual headers. The untitled
    // "recommendation" panel has no aria-label of its own (see StageSections.jsx) and so is
    // deliberately absent from this list, same as any other unsectioned/untitled bucket always was.
    const landmarks = [...container.querySelectorAll('section[aria-label]')].map((s) => s.getAttribute('aria-label'));
    expect(landmarks).toEqual(['Guardrails', 'Summary', 'Totals', 'Basis', 'Details']);
  });

  it('renders the S9.1 recommendation panel as one composed unit in main content: hero headline, subtitle, metrics chart, and move bar all present, none of them in the rail', async () => {
    const { container } = mountAt('/action-stories/S9.1/decide');
    await flush();

    const composedPanel = container.querySelector('[data-composed-panel]');
    expect(composedPanel).toBeTruthy();
    expect(composedPanel.textContent).toContain('Keep 162'); // heroTitle
    expect(composedPanel.textContent).toContain('Grow the proven'); // heroSub

    // The hero headline/subtitle never render inside the rail's Summary panel anymore.
    const rail = container.querySelector('aside[aria-label="Context"]');
    expect(rail.textContent).not.toContain('Keep 162');
    expect(rail.textContent).not.toContain('Grow the proven');
  });

  it('renders the Action Story\'s own real instance headline as a subtitle, distinct from the workflow name', async () => {
    const { container } = mountAt('/action-stories/S9.1/reason');
    await flush();

    expect(container.querySelector('h1').textContent).toBe('Assortment'); // workflow/category identity
    expect(container.textContent).toContain('Quarterly assortment review — 214 active SKUs'); // instance identity
  });

  it('reclaims the rail\'s width for main content on a stage with no rail (RENDERED_UI_FORENSIC_AUDIT.md §3.9/§8)', async () => {
    const { container } = mountAt('/action-stories/S9.1/reason'); // Reason has no rail (below the sectioning threshold)
    await flush();

    expect(container.querySelector('aside[aria-label="Context"]')).toBeFalsy();
    // The 2-column rail template must not apply when there's no rail content to share space with.
    const bodyGrid = [...container.querySelectorAll('.grid')].find((el) => el.className.includes('px-6'));
    expect(bodyGrid).toBeTruthy();
    expect(bodyGrid.className).not.toContain('lg:grid-cols-[minmax(0,1fr)_300px]');
  });

  it('renders a safe error state for a workflow that does not exist, not a crash', async () => {
    const { container } = mountAt('/action-stories/NOT-A-REAL-CODE/reason');
    await flush();
    await flush();
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    // Never the raw internal message ("No manifest found for workflow...").
    expect(container.textContent).not.toContain('No manifest found');
  });
});

describe('route-level rendering — responsive sidebar drawer (regression: fixed w-64, never collapsed)', () => {
  it('the mobile menu button opens the drawer, and navigating closes it again', async () => {
    const { container } = mountAt('/action-stories/S9.1/reason');
    await flush();

    const nav = container.querySelector('nav[aria-label="Workflows"]');
    const menuButton = container.querySelector('[aria-label="Open workflow menu"]');
    expect(nav.className).toContain('-translate-x-full'); // closed by default
    expect(menuButton).toBeTruthy();

    act(() => {
      menuButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('nav[aria-label="Workflows"]').className).toContain('translate-x-0');
    const backdrop = container.querySelector('[aria-label="Close menu"]');
    expect(backdrop).toBeTruthy(); // backdrop present while open

    // Clicking the backdrop closes the drawer again.
    act(() => {
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('nav[aria-label="Workflows"]').className).toContain('-translate-x-full');
    expect(container.querySelector('[aria-label="Close menu"]')).toBeFalsy(); // backdrop gone once closed
  });
});

describe('route-level rendering — stale-response race guard', () => {
  it('navigating away before a fetch resolves does not throw or set state on an unmounted tree', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container, root } = mountAt('/action-stories/S9.1/reason');
    // Unmount immediately, before the async fetch has any chance to resolve.
    act(() => {
      root.unmount();
    });
    await flush();
    await flush();
    // React would log a "Can't perform a React state update on an unmounted component" warning to
    // console.error if the cancelled/AbortController guard had regressed.
    const loggedUnmountWarning = consoleErrorSpy.mock.calls.some((args) =>
      args.some((a) => typeof a === 'string' && a.includes('unmounted')),
    );
    expect(loggedUnmountWarning).toBe(false);
    consoleErrorSpy.mockRestore();
    document.body.removeChild(container);
  });
});
