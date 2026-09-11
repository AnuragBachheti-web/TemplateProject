import { Component } from 'react';
import { humanizeSlotName } from './humanizeSlotName';

/**
 * Catches a genuine JS exception thrown *inside* one block's own render (a Recharts internal
 * error on a pathological input, a null-deref the defensive checks in that block didn't
 * anticipate) — the one failure mode `StageRenderer.jsx`'s own resolve→validate pipeline cannot
 * catch, because it happens after a block has already been handed data its own validator accepted
 * (AUDIT_REPORT.md §14/§24 P0 #1: "no ErrorBoundary anywhere in src/ ... the whole stage goes
 * blank, not just the one bad block").
 *
 * Scope is deliberately one boundary PER block (StageRenderer wraps each block's node
 * individually, not the whole stage in one boundary) — a crash in block #7 of 23 must not take
 * blocks #1–6 and #8–23 down with it. This is the smallest correct fix: React's error boundaries
 * are the only supported mechanism for catching a render-phase exception (there is no hook
 * equivalent), so a class component is required here even though every other block in this
 * registry is a plain function — this component is not a block itself, it's the safety rail
 * around one.
 */
export default class BlockErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Diagnostic detail for developers (slotName, blockType, the real error + component stack)
    // goes to the console only — never into the DOM a real user sees, so a bad Recharts input
    // can't leak an internal stack trace or file path onto a production screen.
    console.error(
      `[BlockErrorBoundary] "${this.props.slotName}" (${this.props.blockType}) threw while rendering:`,
      error,
      info?.componentStack,
    );
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="rounded-2xl border border-dashed border-rose-300 bg-rose-50 px-4 py-3 dark:border-rose-500/40 dark:bg-rose-500/10"
        >
          <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-rose-700 dark:text-rose-400">
            {humanizeSlotName(this.props.slotName)}
          </p>
          <p className="mt-1 text-[12.5px] text-rose-700 dark:text-rose-400">
            This card couldn&rsquo;t be displayed. The rest of this screen is unaffected.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
