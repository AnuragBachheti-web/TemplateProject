import Metric from './children/Metric';
import { EmptyState } from './BlockStates';
import { BlockCard, BlockTitle, CompactEyebrow } from './BlockCard';
import { humanizeSlotName } from './humanizeSlotName';
import { DEPTH_BLOCK, depthAttrs } from './renderDepth';

/**
 * A MEASURED FIGURE AGAINST ITS LABEL — a rollup, a set of inputs, a provenance count, a progress
 * tally. One concept, four slots (I6):
 *
 *   totals_rows    23 objects   the stage's rollup ("90-day revenue  +$41K")
 *   progress_rows  15 objects   the execution tally ("Stages complete  0 of 4")
 *   inputs         12 objects   what the analysis read ("Orders · 90 days  18,402 rows")
 *   basis           2 objects   provenance for the confidence figure
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
        <CompactEyebrow>{humanizeSlotName(slotName)}</CompactEyebrow>
        {children}
      </div>
    );
  }
  return (
    <BlockCard>
      <BlockTitle className="mb-2">{humanizeSlotName(slotName)}</BlockTitle>
      {children}
    </BlockCard>
  );
}

export default function StatListBlock({ slotName, data, compact = false }) {
  const rows = Array.isArray(data) ? data.filter((r) => r !== null && typeof r === 'object') : [];
  if (rows.length === 0) return <EmptyState slotName={slotName} message="No figures recorded." />;

  const grid = (
    <div className={compact ? 'grid grid-cols-2 gap-x-4 gap-y-2' : 'grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3'}>
      {rows.map((row, i) => (
        <Metric
          key={i}
          label={row.label}
          value={row.value}
          // `meta` and `detail` are the same concept under two names across the four slots; the
          // percentage is appended as its own suffix rather than becoming a second unlabelled line.
          meta={row.meta ?? row.detail ?? (row.pct !== undefined && row.pct !== null ? `${row.pct}%` : undefined)}
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
