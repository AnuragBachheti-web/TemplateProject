import { typeRole } from '../typeRole';

/**
 * A LABEL/VALUE ROW — one treatment, wherever a pane states a fact as a pair.
 *
 * ============================================================================================
 * WHAT THIS FIXES (Phase 8, defect 5)
 * ============================================================================================
 *
 * "Guardrail Verdict — Within limits", "Decision Persona — Keeper" and the rest floated. Measured
 * in Chrome on S9.1/decide before this phase: `border-top: 0px` and `border-bottom: 0px` on every
 * one of them, and padding that was `7px/7px` on a single row and `0px/0px` on the three beside it.
 * They were pairs of words with no row structure at all — no divider, no alignment discipline, no
 * spacing rhythm — so a rail read as a list of fragments rather than a table of facts.
 *
 * The guardrail checks in the same rail already had a divider. This is that treatment, made the
 * rule instead of one block's local choice (invariant I2).
 *
 * ONE RULE, STATED ONCE:
 *   - the label sits left, quiet; the value sits right, primary
 *   - `py-2`, so every row has the same rhythm whatever it contains
 *   - a hairline beneath, and `last:border-0` so the final row does not draw a line into whitespace
 *
 * That last clause is the same principle R120 put on the card header: a divider under nothing is a
 * stray line, and an empty structure rendering as a visible artefact is a defect this project has
 * met more than once.
 */
export default function RailRow({ label, value, tone = null, children, below = null }) {
  return (
    <div data-rail-row className="border-b border-rf-border-subtle py-2 last:border-0">
      <div {...typeRole('small', 'flex min-w-0 items-baseline justify-between gap-3')}>
        {/* A CALLER'S OWN LABEL NODE IS RENDERED AS IT IS. Wrapping it in a second constrained
            span was a real regression: TextBlock's label already carries `max-w-[45%] shrink`, and
            nesting that inside another `min-w-0` squeezed it until "Recommendation Identity"
            clamped to "Recommen dation...". A primitive owns the ROW; it does not get to re-decide
            how a caller sized the thing it was handed. */}
        {typeof label === 'string'
          ? <span className="min-w-0 text-rf-text-tertiary">{label}</span>
          : label}
        {children ?? (
          <span className={`shrink-0 text-right ${tone ?? 'text-rf-text-primary'}`}>{value}</span>
        )}
      </div>
      {below}
    </div>
  );
}
