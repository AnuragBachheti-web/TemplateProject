import { deltaTone } from '../deltaTone';
import { DEPTH_CHILD, depthAttrs } from '../renderDepth';

/**
 * One measured figure and its label — the atom `statList` is built from, and the atom `cardSet`
 * reuses for the figures on a card.
 *
 * WHY A CHILD RATHER THAN MARKUP INSIDE EACH BLOCK. `totals_rows`, `progress_rows`, `inputs` and
 * `basis` are four slots carrying the identical concept (a label and a value), and `cardSet` carries
 * the same concept again inside a row. Four copies of "how a figure looks" is how the 835-slotName
 * sprawl started, one level down.
 *
 * The value is coloured from its OWN sign and wording via deltaTone — the shared signal every other
 * block already uses — never from anything the payload says, because the payload carries no colour.
 */
export default function Metric({ label, value, meta }) {
  const tone = deltaTone(value);

  return (
    <div {...depthAttrs(DEPTH_CHILD)} data-metric className="min-w-0">
      {label !== undefined && label !== null && label !== '' && (
        <div className="truncate text-[11px] text-rf-text-tertiary">{label}</div>
      )}
      {value !== undefined && value !== null && value !== '' && (
        <div className={`font-mono text-[13px] tabular-nums ${tone ?? 'text-rf-text-primary'}`}>{value}</div>
      )}
      {meta !== undefined && meta !== null && meta !== '' && (
        <div className="mt-[1px] truncate text-[10.5px] text-rf-text-tertiary">{meta}</div>
      )}
    </div>
  );
}
