import Metric from './children/Metric';
import { EmptyState } from './BlockStates';
import { BlockCard, BlockTitle, CompactEyebrow } from './BlockCard';
import { slotLabel } from './slotLabel';
import { DEPTH_BLOCK, depthAttrs } from './renderDepth';
import { formatValue } from './formatValue';
import { assertVariant } from './variants';

/**
 * A MEASURED FIGURE AGAINST ITS LABEL — a rollup, a set of inputs, a provenance count, a progress
 * tally. One concept, four slots (I6):
 *
 *   totals_rows             23 objects  the stage's rollup ("90-day revenue  +$41K")
 *   progress_rows           15 objects  the execution tally ("Stages complete  0 of 4")
 *   inputs                  12 objects  what the analysis read ("Orders · 90 days  18,402 rows")
 *   basis                    2 objects  provenance for the confidence figure
 *   recommendation_metrics   9 objects  the figures behind the recommendation (Phase 3C)
 *
 * `recommendation_metrics` joined in Phase 3C: the reference renders `heroMetrics` as an eyebrow, a
 * 20px value and a prose note (S10.2-3-decide:209-213) — byte-for-byte the same pattern as `recon`
 * (S10.1-2-analyze:286-288), which is the metric grid the visual comparison was actually asking for.
 * It adds a fifth SLOT but no new objects: all 9 are decide-stage and already rendered a statList
 * via `totals_rows` or `basis`.
 *
 * `basis` at 2 objects does NOT get its own block. It is the same concept as the other three, and a
 * blockType per slot is the 835-slotName accident arriving through the data door — which is exactly
 * what I6 forbids and why 51 slots do not need 51 blocks.
 *
 * WHY NOT labelValueList. Three of these four were on it, and it renders a row's keys generically
 * through flattenNestedEntry — so a figure, its unit note and its percentage all became one run of
 * text. These are FIGURES: they want a tabular-numeric column and a label above it, and that layout
 * is the information. Row-level composition is what makes that possible (each row is a `Metric`
 * child), and it is why decide's flatten count reaches zero.
 *
 * TYPED CONTRACT: `[{label, value?, meta?, pct?, detail?}]`.
 */

/**
 * THE SHARED WRAPPER every other block already uses — card, title, and a compact eyebrow variant.
 *
 * The first draft of these four blocks rendered bare lists, which silently dropped "Inputs",
 * "Totals Rows", "Guardrail Checks", "Agents" and "Progress Rows" from their panes. The slot's own
 * name is information — a pane can hold two stat lists — and the T13 baseline is what caught it.
 */
function Framed({ slotName, compact, children }) {
  if (compact) {
    return (
      <div className="py-1.5">
        <CompactEyebrow>{slotLabel(slotName)}</CompactEyebrow>
        {children}
      </div>
    );
  }
  return (
    <BlockCard>
      <BlockTitle className="mb-2">{slotLabel(slotName)}</BlockTitle>
      {children}
    </BlockCard>
  );
}

/**
 * `metricGrid` (Phase 5B) — the reference's four-line metric: label, value, the P10-P90 `range` on
 * its own mono line, then the caveat `note` (S9.1-3-decide.dc.html:220-227).
 *
 * WHY IT IS A VARIANT AND NOT THE DEFAULT. The other four statList slots — totals_rows,
 * progress_rows, inputs, basis — carry no `range`, and a fourth line on a two-field row is dead
 * space. The reference draws those as three lines and this one as four.
 *
 * `range` is the field 5A found a passing data test guarding while nothing drew it:
 * referenceFidelity.test.js has asserted "+$17K to +$66K" is present since Phase 2, and the block
 * dropped it because `Metric` takes one meta line and `range` loses the `?? ` chain to `note`. That
 * is the whole reason T61 exists.
 */
const EXTRA_FIGURE_KEYS = ['range', 'delta'];

export default function StatListBlock({ slotName, data, compact = false, variant }) {
  assertVariant('statList', variant);
  const rows = Array.isArray(data) ? data.filter((r) => r !== null && typeof r === 'object') : [];
  if (rows.length === 0) return <EmptyState slotName={slotName} message="No figures recorded." />;

  // THE COLUMN COUNT IS THE VARIANT'S, NEVER THE DATA'S. `reconStrip` is 4-up because the reference
  // draws a reconciliation on one line (see variants.js); the default stays 3-up because the four
  // slots it serves are rail-width. Deriving this from `rows.length` would be the shape-guessing
  // this project deleted three times — a block choosing its own layout by measuring content.
  const columns = compact
    ? 'grid-cols-2'
    : variant === 'reconStrip' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3';

  const grid = (
    <div className={`grid gap-x-4 ${compact ? 'gap-y-2' : 'gap-y-2.5'} ${columns}`}>
      {rows.map((row, i) => (
        <Metric
          key={i}
          label={row.label}
          // formatValue renders an absent value as an em dash — correct for NumberBlock, which is
          // showing you a figure that is missing, and wrong here, where Metric omits the figure line
          // entirely. Calling it unconditionally turned every value-less row into a bare "—".
          value={row.value === undefined || row.value === null ? undefined : formatValue(row.value)}
          // `meta`, `detail` and `note` are the same concept under three names across the five
          // slots; the percentage is appended as its own suffix rather than becoming a second
          // unlabelled line. `note` joined in Phase 3C for `recommendation_metrics`, where all 39
          // rows carry one and the chain would otherwise have dropped it (R30) — additive, because
          // no other statList slot carries `note`.
          meta={row.meta ?? row.detail ?? row.note ?? (row.pct !== undefined && row.pct !== null ? formatValue({ value: row.pct, unit: 'pct' }) : undefined)}
          // The variant, and only the variant, adds the second figure line. The default is
          // byte-identical to what shipped before this phase.
          extra={variant === 'metricGrid' ? EXTRA_FIGURE_KEYS.map((k) => row[k]) : undefined}
        />
      ))}
    </div>
  );

  return (
    <div {...depthAttrs(DEPTH_BLOCK, 'statList')}>
      <Framed slotName={slotName} compact={compact}>{grid}</Framed>
    </div>
  );
}
