import Initials from './children/Initials';
import { EmptyState } from './BlockStates';
import { BlockCard, BlockTitle, CompactEyebrow } from './BlockCard';
import { humanizeSlotName } from './humanizeSlotName';
import { DEPTH_BLOCK, depthAttrs } from './renderDepth';

/**
 * WHO OR WHAT IS CREDITED — the named models on a proposal.
 *
 * Owns `agents` (proposal.agents): 81 rows across 26 objects, one per Action Story, which the
 * reference prints in the pinned identity strip on every reason-stage screen.
 *
 * WHY NOT itemQueue. A queue is a list of WORK — items awaiting a decision, each with a headline and
 * a detail line, and ItemQueueBlock flattens a row's remaining fields into that detail line. A
 * roster is a list of IDENTITIES: a name, what it did, and whether it led. The contract's own
 * comment draws this line already — "a persona is a HUMAN OPERATOR, the named models on a proposal
 * are agents" — and rendering an identity as a work item loses the distinction that comment exists
 * to protect.
 *
 * TYPED CONTRACT: `[{name, initials?, role?, lead?, stance?}]`.
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

export default function RosterBlock({ slotName, data, compact = false }) {
  const rows = Array.isArray(data) ? data.filter((r) => r !== null && typeof r === 'object' && r.name) : [];
  if (rows.length === 0) return <EmptyState slotName={slotName} message="No agents credited." />;

  const list = (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row, i) => (
        <li key={i} className="flex items-center gap-2.5">
          <Initials name={row.name} initials={row.initials} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[12.5px] text-rf-text-primary">{row.name}</span>
              {/* `lead` is the reference's own flag for the agent that drove the proposal. */}
              {row.lead === true && (
                <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.1em] text-rf-text-tertiary">
                  lead
                </span>
              )}
            </div>
            {(row.role ?? row.stance) && (
              <div className="truncate text-[11px] text-rf-text-tertiary">{row.role ?? row.stance}</div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div {...depthAttrs(DEPTH_BLOCK, 'roster')}>
      <Framed slotName={slotName} compact={compact}>{list}</Framed>
    </div>
  );
}
