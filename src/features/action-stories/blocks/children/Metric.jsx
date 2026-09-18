import { deltaTone } from '../deltaTone';
import { DEPTH_CHILD, depthAttrs } from '../renderDepth';
import { cellText } from '../cellText';
import { isFigureText } from '../figureShape';

import { typeRole } from '../typeRole';
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
// THE VALUE IS `prose`, NOT `figure`, and the distinction is about who supplies it rather than how
// it looks. StatListBlock passes a formatted money figure here, but CardSetBlock passes "whatever
// scalar the named parts did not claim" — on S10.3/decide that is a 3,400px draft of a dispute
// letter. `figure` means never-wrap, so it ran off the card on one line and the layout gate caught
// it. A role is chosen by what a cell is GUARANTEED to hold, never by what it usually holds; only
// TableBlock's numeric branch can guarantee a figure, so only it claims one.
export default function Metric({ label, value, meta, extra }) {
  const tone = deltaTone(value);

  return (
    <div {...depthAttrs(DEPTH_CHILD)} data-metric className="min-w-0">
      {label !== undefined && label !== null && label !== '' && (
        <div {...cellText('identifier', label, typeRole('body', 'text-rf-text-tertiary').className)}>{label}</div>
      )}
      {/* PHASE 5E PART 2. The role comes from the VALUE'S SHAPE, not from the field's name. This
          was `prose` while being drawn as a figure (mono, tabular-nums) — a styling that disagreed
          with its declared role, which is the seam R78 is about. The first fix made it always
          `figure`, and the browser gate immediately found the other half of the mistake: a metric's
          value is not always a figure. S10.3/decide's next_actions carries a 250-character
          sentence here, and the figure role never wraps, so it ran 4,544px wide inside a 620px
          card. Same answer as TableBlock's cells and deltaTone's gate — one definition, asked in
          one way, wherever the question comes up. */}
      {value !== undefined && value !== null && value !== '' && (
        isFigureText(value)
          ? <div {...cellText('figure', value, typeRole('figure', tone ?? 'text-rf-text-primary').className)}>{value}</div>
          : <div {...cellText('prose', value, typeRole('body', tone ?? 'text-rf-text-primary').className)}>{value}</div>
      )}
      {/* PHASE 5B. `extra` is the metricGrid variant's second figure line — the reference stacks
          label / value / range / note (S9.1-3-decide:220-227) where this renders three. It is a
          LIST supplied by the caller, not a field this child reads: Metric still knows nothing
          about which slot it serves or which variant is in play. */}
      {(extra ?? []).filter((line) => typeof line === 'string' && line.trim() !== '').map((line) => (
        <div key={line} {...cellText('figure', line, typeRole('micro', 'mt-[1px] text-rf-text-secondary').className)}>{line}</div>
      ))}
      {meta !== undefined && meta !== null && meta !== '' && (
        <div {...cellText('prose', meta, typeRole('micro', 'mt-[1px] text-rf-text-tertiary').className)}>{meta}</div>
      )}
    </div>
  );
}
