import { surfaceTier } from './surfaceTier';
import { labelLevel } from './labelLevel';
/**
 * The card shell every block renders inside — previously the exact literal string
 * ``rounded-lg ${surfaceTier('card').className}`` (or its `px-4 py-3` variant)
 * was duplicated verbatim across all 13 block components (AUDIT_REPORT.md §17: "a future 'add a
 * subtle shadow to every card' change touches 13 files instead of 1"). One shared wrapper, kept
 * intentionally tiny — it owns only the shell, never a block's own internal layout, so this stays
 * a real reuse win rather than a second abstraction blocks have to fight.
 *
 * Radius/shadow match the reference design system directly (`_ds/.../tokens/{spacing,elevation}.css`:
 * cards are `--r-lg` (16px), resting at `shadow-card` — "cards rest at xs and lift to md on hover").
 *
 * `padding` lets a block choose its own established rhythm (`"compact"` = `px-4 py-3`, used by the
 * single-value blocks; `"normal"` = `p-3`, used by list/table/chart blocks) rather than forcing one
 * spacing scale on every block type.
 */
export function BlockCard({ children, padding = 'normal', className = '' }) {
  const paddingClass = padding === 'compact' ? 'px-4 py-3' : padding === 'none' ? '' : 'p-3.5';
  return (
    <div
      className={`rounded-xl ${surfaceTier('card').className} ${paddingClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

/**
 * A BLOCK'S HEADER ZONE — the title, an optional right-aligned meta, and the rule beneath them.
 *
 * ============================================================================================
 * WHAT THIS FIXES (Phase 8, defect 2)
 * ============================================================================================
 *
 * A card's name and its contents were the same visual object. "Next Actions", "Item Groups",
 * "Recommendation Identity" sat as bold text at the top of a body with nothing between them and it
 * — no divider, no ground, no shared spacing — and every block chose its own margin (`mb-2` here,
 * nothing there). One treatment now, and it lives in one component so it cannot vary.
 *
 * A HEADER EXISTS OR IT DOES NOT — NEVER A HEADER WITH NOTHING IN IT (ruling R120). That is the
 * general form of a defect this project has hit repeatedly: an empty structure rendering as a
 * visible artefact. A divider under no title is a stray line across a card, which is very close to
 * what defect 6 reported as a white band. So a block with no title gets no header zone, no divider
 * and no spacing, rather than an empty one.
 *
 * `<h3>` because the page's hierarchy is `<h1>` (StagePage, the workflow) -> `<h2>` (a section) ->
 * `<h3>` (one block's own title), so a screen-reader user navigating by heading finds a landmark
 * for every real region.
 */
export function BlockTitle({ children, meta = null, className = '' }) {
  const empty = children === null || children === undefined || children === false
    || (typeof children === 'string' && children.trim() === '');
  if (empty) return null;
  return (
    <div
      data-card-header
      className={`mb-3 flex items-baseline justify-between gap-3 border-b border-rf-border-subtle pb-2.5 ${className}`.trim()}
    >
      <h3 {...labelLevel('blockTitle', 'min-w-0')}>{children}</h3>
      {meta ? <span {...labelLevel('section', 'shrink-0')}>{meta}</span> : null}
    </div>
  );
}

/**
 * The compact-mode label every list/chart/object block (GaugeBlock, BarChartBlock,
 * LabelValueListBlock, ItemQueueBlock, ObjectBlock) puts above its own content when grouped inside
 * a shared panel — previously five near-identical copies of the same literal string
 * (`"mb-1(.5) font-mono text-[9.5px] uppercase tracking-[0.1em] text-rf-text-tertiary"`), two of
 * them off by a stray `mb-1.5` vs the other three's `mb-1` for no reason. One shared primitive, same
 * "a future spacing/type tweak touches 1 file instead of 5" reasoning as BlockTitle above — this is
 * deliberately a *different* variant from BlockTitle (tertiary not secondary text, 0.1em not 0.14em
 * tracking, a real `<p>` not an `<h3>`) because it labels a block's own compact-mode content, not a
 * full card's heading; not merged into BlockTitle itself; not a lesser/generic wrapper.
 */
export function CompactEyebrow({ children }) {
  return <p {...labelLevel('section', 'mb-1')}>{children}</p>;
}
