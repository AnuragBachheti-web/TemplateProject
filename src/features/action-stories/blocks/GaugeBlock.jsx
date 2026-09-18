import { humanizeSlotName } from './humanizeSlotName';
import { parseMagnitude } from './chartGeometry';
import { BlockCard, BlockTitle, CompactEyebrow } from './BlockCard';
import { EmptyState, ErrorState } from './BlockStates';
import Tooltip from '../ui/Tooltip';
import { formatValue } from './formatValue';
import { limitTone } from './statusTone';
import { assertVariant } from './variants';
import { cellText } from './cellText';

import { typeRole } from './typeRole';
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
/**
 * `meteredRow` (Phase 5B) — the reference's own gauge row: label and value on one line, a bar
 * filled from `pct` with a tick at `limitPct`, and `note` on a mono line beneath
 * (S9.18-3-decide.dc.html:311-323).
 *
 * IT ALSO CORRECTS A MIS-SCALING 5A RECORDED AND COULD NOT FIX. The default plots the row's
 * `value` (95.6, a percentage) against `limitPct` (63, a position on a chosen axis) — two numbers
 * on different scales, drawn as if comparable. The reference pairs `pct` with `limitPct`, which ARE
 * the same scale, and prints `value` as the figure beside them. That is what this does.
 *
 * `pct` and `limitPct` are bar GEOMETRY, and using them to draw a bar is the one correct use of
 * them — the defect Phase 3A's R15 named was treating such a value as a MEASUREMENT. The
 * measurement here is `value`, and the limit it is measured against exists only as prose inside
 * `note` ("floor 95% · scale 90-98%"), which R2 forbids parsing into a number. So the note is
 * rendered, verbatim, rather than mined.
 */
export default function GaugeBlock({ slotName, data, compact, variant }) {
  assertVariant('gauge', variant);
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
      // The variant's own three fields, read because the variant declares them — never sniffed.
      bar: firstParseable(item, ['pct']),
      limit: firstParseable(item, ['limitPct']),
      note: typeof item?.note === 'string' ? item.note : undefined,
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
        // THE VARIANT PAIRS pct WITH limitPct — same scale, as the reference does. The default
        // pairs `value` with `limitPct`, which are not, and 5A recorded that as this phase's to fix.
        const metered = variant === 'meteredRow' && row.bar && row.limit;
        const fillPct = metered
          ? Math.min(100, Math.max(0, row.bar.value))
          : Math.min(100, Math.max(0, (row.magnitude.value / scaleMax) * 100));
        const thresholdPct = metered
          ? Math.min(100, Math.max(0, row.limit.value))
          : Math.min(100, Math.max(0, (row.threshold.value / scaleMax) * 100));
        // NO DIRECTIONAL TONE. See limitTone's own comment: whether being past the tick is good or
        // bad depends on the limit being a floor or a ceiling, and that word exists only inside the
        // prose `note`. The bar, the tick and the note are rendered; the verdict is the operator's.
        const tone = limitTone();
        return (
          <div key={i} className="min-w-0">
            <div {...typeRole('small', 'mb-1 flex items-baseline justify-between gap-2')}>
              <span {...cellText('identifier', row.label, 'text-rf-text-secondary')}>{row.label}</span>
              <span {...typeRole('figure', `shrink-0 ${tone.text}`)}>
                {row.magnitude.display === undefined ? null : formatValue(row.magnitude.display)}
              </span>
            </div>
            <div className="relative h-1.5 w-full rounded-full bg-rf-surface-sunken">
              <div
                className={`h-full rounded-full transition-[width] duration-base ${tone.fill}`}
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
                <Tooltip content={`Threshold: ${formatValue(row.threshold.display)}`}>
                  <span className="block h-3 w-px bg-rf-text-tertiary" />
                </Tooltip>
              </span>
            </div>
            {/* The limit in the reference's own words. It exists nowhere as a typed number, and R2
                forbids parsing one out of this string, so it is shown rather than mined. */}
            {variant === 'meteredRow' && row.note !== undefined && (
              <div {...cellText('prose', row.note, typeRole('micro', 'mt-1 text-rf-text-tertiary').className)}>{row.note}</div>
            )}
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
