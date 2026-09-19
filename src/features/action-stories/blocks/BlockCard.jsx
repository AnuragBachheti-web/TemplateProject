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
 * A block's own title, as a real `<h3>` — every block's card title used to be a styled `<p>`
 * (AUDIT_REPORT.md §6/§16: "exactly one `<h1>` in the whole application... every block's own title
 * is a styled `<p>`, not a semantic heading"). `<h3>` because the page's real hierarchy is now
 * `<h1>` (StagePage, the workflow name) → `<h2>` (StageSections, a section title, when present) →
 * `<h3>` (this — one block's own title) — a screen-reader user navigating by heading now finds a
 * landmark for every real region of the page, not just one.
 *
 * Mono, uppercase, wide tracking — the reference's own micro-label treatment for every panel
 * header in the source mockups (`font-family:var(--font-mono);font-size:9.5px;letter-spacing:
 * 0.14em;text-transform:uppercase`), not a styled Inter paragraph.
 */
export function BlockTitle({ children, className = '' }) {
  return (
    <h3 {...labelLevel('blockTitle', className)}>
      {children}
    </h3>
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
