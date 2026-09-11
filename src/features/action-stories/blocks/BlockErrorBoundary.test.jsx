// @vitest-environment jsdom
//
// Every other block test in this codebase calls a block as a plain function and inspects the
// returned element tree — deliberately not exercising React's real render lifecycle (see
// SliderBlock.jsx's own comment on why blocks stay hookless/testable that way). An error boundary
// is the one thing in this feature that genuinely cannot be tested that way: getDerivedStateFromError
// and componentDidCatch only fire through a real commit, so this one file opts into a real DOM
// (jsdom, added as a devDependency for exactly this) and React's actual client renderer.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import BlockErrorBoundary from './BlockErrorBoundary';
import StageRenderer from '@/features/action-stories/components/StageRenderer';

// React 19's act() requires this flag set before any render, or it warns that "the current
// testing environment is not configured to support act(...)" even though it still works.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Bomb() {
  throw new Error('boom from a block render');
}

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return { container, root };
}

describe('BlockErrorBoundary', () => {
  let consoleErrorSpy;
  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    document.body.innerHTML = '';
  });

  it('renders children normally when nothing throws', () => {
    const { container } = mount(
      <BlockErrorBoundary slotName="ok" blockType="text">
        <div data-testid="ok-content">fine</div>
      </BlockErrorBoundary>,
    );
    expect(container.textContent).toContain('fine');
  });

  it('catches a render-phase exception and shows a safe fallback instead of an empty page', () => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = mount(
      <BlockErrorBoundary slotName="broken_slot" blockType="barChart">
        <Bomb />
      </BlockErrorBoundary>,
    );
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    expect(container.textContent).toContain('couldn’t be displayed');
  });

  it('never leaks the raw error message or stack trace into the rendered fallback', () => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = mount(
      <BlockErrorBoundary slotName="broken_slot" blockType="barChart">
        <Bomb />
      </BlockErrorBoundary>,
    );
    expect(container.textContent).not.toContain('boom from a block render');
    expect(container.textContent).not.toContain('.jsx');
    expect(container.textContent).not.toContain('at Bomb');
  });

  it('logs developer-facing diagnostic detail to the console (slot, type, the real error)', () => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mount(
      <BlockErrorBoundary slotName="broken_slot" blockType="barChart">
        <Bomb />
      </BlockErrorBoundary>,
    );
    const logged = consoleErrorSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(logged).toContain('broken_slot');
    expect(logged).toContain('barChart');
  });
});

describe('StageRenderer — block-level failure isolation (regression: one bad block used to white-screen the whole stage)', () => {
  it('a crash in one block does not prevent its sibling blocks from rendering', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // barChart's own runtime accepts an array of numbers; a deliberately pathological non-array
    // object that still passes classification-time validation but breaks a real render (e.g. a
    // circular-reference-adjacent shape Recharts chokes on) isn't easy to construct safely here, so
    // this proves isolation directly: three ordinary blocks around one that is monkey-patched to
    // throw, all inside one real StageRenderer mount.
    const manifest = {
      code: 'TEST',
      stageKey: 'reason',
      name: 'Test stage',
      blocks: [
        { slotName: 'before', blockType: 'text', binding: 'data.before' },
        { slotName: 'broken', blockType: 'number', binding: 'data.broken' },
        { slotName: 'after', blockType: 'text', binding: 'data.after' },
      ],
    };
    const fixture = { data: { before: 'Block A renders fine', broken: 42, after: 'Block C renders fine' } };

    // Force the middle block to throw by making its registry entry explode — imported dynamically
    // so the mock only affects this test.
    return import('@/features/action-stories/blocks').then(({ BLOCK_REGISTRY }) => {
      const original = BLOCK_REGISTRY.number;
      BLOCK_REGISTRY.number = () => {
        throw new Error('simulated render crash');
      };
      try {
        const { container } = mount(<StageRenderer manifest={manifest} fixture={fixture} />);
        expect(container.textContent).toContain('Block A renders fine');
        expect(container.textContent).toContain('Block C renders fine');
        expect(container.querySelector('[role="alert"]')).toBeTruthy();
      } finally {
        BLOCK_REGISTRY.number = original;
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      }
    });
  });
});
