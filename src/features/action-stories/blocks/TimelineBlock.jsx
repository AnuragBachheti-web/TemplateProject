import { rowLabelOf } from '../manifests/blockTypes';
import { EmptyState } from './BlockStates';
import { BlockCard, BlockTitle, CompactEyebrow } from './BlockCard';
import { slotLabel } from './slotLabel';
import { DEPTH_BLOCK, depthAttrs } from './renderDepth';

import { typeRole } from './typeRole';
/**
 * A CHRONOLOGY: a time or cadence label, and what happened or will happen under it.
 *
 * Owns two slots (I6):
 *
 *   trigger  14 objects  "What raised this" — the events that queued the proposal
 *   flags     2 objects  the standing rules that will raise one later
 *
 * WHY THIS IS NOT A TABLE, which is what it was. The reference renders it as a stacked pair — a mono
 * uppercase eyebrow carrying the timestamp, then the description wrapped as prose beneath it
 * (S10.1-1-reason:338-343, inside a card titled "What raised this"). A table's column headers assert
 * that its two fields are PARALLEL columns; here the first is a label FOR the second. "When | What"
 * as headers is a claim about the data that is not true of it.
 *
 * WHY IT IS NOT ONE OF THE FOUR BLOCKS THAT ALREADY EXIST:
 *
 *   statList  renders a figure — mono, tabular-nums, right-weighted. `what` is a sentence, and
 *             putting prose in a tabular-numeric column is precisely what statList must not do.
 *   cardSet   wraps every row in its own bordered card with chips and figures. The reference shows a
 *             flat stacked list inside ONE card; three cards where the reference has three lines is
 *             a different object, not a restyling of the same one.
 *   checklist requires a status enum. Nothing here passes or fails.
 *   roster    requires an identity. A timestamp is not one.
 *
 * NO CHILDREN. An eyebrow and a paragraph are text, not composed components, so this is a depth-3
 * leaf and the child set stays at five (renderDepth.js). Depth 4 is still reached on every template
 * by the blocks that genuinely compose.
 *
 * TYPED CONTRACT: `[{when, what}]` (trigger) or `[{when, rule, action}]` (flags). The identity keys
 * are read in a FIXED ORDER, exactly as CardSetBlock reads HEADLINE_KEYS — never by inspecting a
 * value to discover what it is (I2).
 */

/** The description, in declared order. `rowLabelOf` is the last resort, not the first choice. */
const BODY_KEYS = ['what', 'rule'];

export default function TimelineBlock({ slotName, data, compact = false }) {
  const rows = Array.isArray(data) ? data.filter((r) => r !== null && typeof r === 'object') : [];
  if (rows.length === 0) return <EmptyState slotName={slotName} message="Nothing recorded." />;

  const list = (
    <ol className="flex flex-col gap-2.5">
      {rows.map((row, i) => {
        const when = typeof row.when === 'string' && row.when.trim() !== '' ? row.when : undefined;
        // A row that states no `what`/`rule` falls back to its own identity. That is NOT a shape
        // branch to cope with bad data: it is one component reading its declared fields in order.
        //
        // THIS COMMENT USED TO DESCRIBE A LIVE DEFECT, and Phase 5A fixed it (ruling R56 — a comment
        // describing a fixed defect tells a future reader the opposite of the truth, with
        // authority). It read: prop_s9_11_reason's `trigger` comes from `opportunity` and carries
        // {label, value, pct, meta} — a metric shape claimed into a chronology slot — so it renders
        // by label with no eyebrow; the corpus is frozen this phase (I7) and T34 pins that outcome
        // so the defect stays visible. That was R31, and it was right for a renderer-subject phase.
        //
        // Phase 5A's subject was the claim ledger, which is where the defect lived. The claim is
        // withdrawn (R48), that object has no `trigger` at all, and `opportunity` is carried in
        // __corpus__/shapeLedger.js's DEFERRED_SHAPES with the shape it actually needs. The fallback
        // below stays because it is correct on its own terms, not because bad data depends on it.
        const body = BODY_KEYS.map((k) => row[k]).find((v) => typeof v === 'string' && v.trim() !== '')
          ?? rowLabelOf(row);
        const follow = typeof row.action === 'string' && row.action.trim() !== '' ? row.action : undefined;

        return (
          <li key={i} className="flex flex-col gap-[3px]">
            {when !== undefined && (
              <span
                data-timeline-when
                {...typeRole('label', 'text-rf-text-tertiary')}
              >
                {when}
              </span>
            )}
            {body !== undefined && (
              <span {...typeRole('small', 'text-rf-text-secondary')}>{body}</span>
            )}
            {follow !== undefined && (
              <span {...typeRole('small', 'text-rf-text-tertiary')}>{follow}</span>
            )}
          </li>
        );
      })}
    </ol>
  );

  return (
    <div {...depthAttrs(DEPTH_BLOCK, 'timeline')}>
      {compact ? (
        <div className="py-1.5">
          <CompactEyebrow>{slotLabel(slotName)}</CompactEyebrow>
          {list}
        </div>
      ) : (
        <BlockCard>
          <BlockTitle>{slotLabel(slotName)}</BlockTitle>
          {list}
        </BlockCard>
      )}
    </div>
  );
}
