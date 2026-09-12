import { humanizeSlotName } from './humanizeSlotName';
import { parseMagnitude } from './chartGeometry';
import { BlockCard, BlockTitle, CompactEyebrow } from './BlockCard';
import { EmptyState, ErrorState } from './BlockStates';
import Tooltip from '../ui/Tooltip';

const MAGNITUDE_KEYS = ['value', 'h', 'height', 'pct', 'amount'];
const THRESHOLD_KEYS = ['threshold', 'limit', 'limitPct', 'ceiling', 'floor', 'target', 'cap'];

function firstParseable(item, keys) {
  for (const key of keys) {
    if (item?.[key] === undefined) continue;
    const value = parseMagnitude(item[key]);
    if (Number.isFinite(value)) return { key, value, display: item[key] };
  }
  return null;
}

/**
 * A row measured against a threshold — extraction/classifyBlocks.js's `gauge` blockType (see its
 * own isGaugeShaped doc comment: a magnitude plus a sibling ceiling/floor/target/cap/limit field).
 * Renders as a small horizontal meter per row: a fill bar for the row's own value, and a tick mark
 * for the threshold it's being measured against — generic across whatever domain the underlying
 * data happens to be (a volume-loss tolerance, a spend cap, a service-level floor); nothing here
 * assumes a specific workflow's own labels or units.
 *
 * @param {boolean} [compact] - same convention as every other block: true when this gauge is a
 *   member of an explicitly-authored or heuristic shared panel, so it renders without its own
 *   nested BlockCard.
 */
export default function GaugeBlock({ slotName, data, compact }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (!Array.isArray(data)) {
    return <ErrorState slotName={slotName} message={`expected an array, got ${typeof data}`} />;
  }
  if (data.length === 0) {
    return <EmptyState slotName={slotName} message="No gauges." />;
  }

  const rows = data
    .map((item, i) => ({
      label: typeof item?.label === 'string' ? item.label : String(i + 1),
      magnitude: firstParseable(item, MAGNITUDE_KEYS),
      threshold: firstParseable(item, THRESHOLD_KEYS),
    }))
    .filter((row) => row.magnitude && row.threshold);

  if (rows.length === 0) {
    return <ErrorState slotName={slotName} message="no usable value/threshold pair" />;
  }

  const rowsNode = (
    <div className="flex flex-col gap-2.5">
      {rows.map((row, i) => {
        // A generous headroom above whichever of value/threshold is larger, so the fill and the
        // threshold tick both stay legible instead of one pinned at the very edge.
        const scaleMax = Math.max(row.magnitude.value, row.threshold.value, 1) * 1.15;
        const fillPct = Math.min(100, Math.max(0, (row.magnitude.value / scaleMax) * 100));
        const thresholdPct = Math.min(100, Math.max(0, (row.threshold.value / scaleMax) * 100));
        const over = row.magnitude.value > row.threshold.value;
        return (
          <div key={i} className="min-w-0">
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[11.5px]">
              <span className="min-w-0 truncate text-rf-text-secondary">{row.label}</span>
              <span className={`shrink-0 font-mono font-semibold tabular-nums ${over ? 'text-rf-status-critical' : 'text-rf-text-primary'}`}>
                {row.magnitude.display}
              </span>
            </div>
            <div className="relative h-1.5 w-full rounded-full bg-rf-surface-sunken">
              <div
                className={`h-full rounded-full transition-[width] duration-200 ${over ? 'bg-rf-status-critical' : 'bg-rf-status-success'}`}
                style={{ width: `${fillPct}%` }}
              />
              {/* Previously an `aria-hidden` tick with the actual threshold value stashed in a
                  visually-hidden `sr-only` span — a sighted user had no way to see WHAT the tick
                  marked at all, only its bare position. A Tooltip fixes both audiences with one
                  mechanism: hover or keyboard-focus the tick and its value shows, for everyone.
                  The outer span (not Tooltip's own wrapper) carries the `absolute`/`left:%`
                  positioning against THIS bar — Tooltip's own `position:relative` wrapper is only
                  for its popup bubble, and must never become the containing block a percentage
                  offset resolves against, or the tick collapses to the bar's left edge. */}
              <span className="absolute top-1/2 -translate-y-1/2" style={{ left: `${thresholdPct}%` }}>
                <Tooltip content={`Threshold: ${row.threshold.display}`}>
                  <span className="block h-3 w-px bg-rf-text-tertiary" />
                </Tooltip>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (compact) {
    return (
      <div className="py-1.5">
        <CompactEyebrow>{humanizeSlotName(slotName)}</CompactEyebrow>
        {rowsNode}
      </div>
    );
  }

  return (
    <BlockCard>
      <BlockTitle className="mb-2">{humanizeSlotName(slotName)}</BlockTitle>
      {rowsNode}
    </BlockCard>
  );
}
