import StatusBadge from './children/StatusBadge';
import { EmptyState } from './BlockStates';
import { BlockCard, BlockTitle, CompactEyebrow } from './BlockCard';
import { slotLabel } from './slotLabel';
import { DEPTH_BLOCK, depthAttrs } from './renderDepth';
import { formatValue } from './formatValue';

import { typeRole } from './typeRole';
/**
 * A GOVERNANCE CHECKLIST: did this check pass, and why.
 *
 * Owns `guardrail_checks` (guardrails.checks) — 85 rows across 20 objects, 19 of which declare the
 * slot. Every row carries a `status` from contract/decisionObject.js's GUARDRAIL_CHECK_STATUSES,
 * because Phase 3A made the contract validate it per row rather than as "an array when present".
 *
 * WHY THIS BLOCK EXISTS. These rows rendered through `labelValueList`, which shows every key of a
 * row generically — so the status enum appeared as the literal text "· warn" beside the value. The
 * data was right and the rendering was wrong, and that gap was Phase 2's pinned T13 delta. The
 * check's identity, its measured value and its note are all content; its status is an affordance.
 *
 * TYPED CONTRACT: `[{status, label|text, value?, pct?, note?}]`. A row identifies itself by `label`
 * (a metric check: 58 rows) OR `text` (a whole policy sentence with no separate value: 27 rows) —
 * both are legitimate and requiring `label` alone would have discarded a third of the corpus.
 *
 * No shape sniffing (I2): the slot decides this block, and every field below is read because the
 * contract says it is there — never because a value looked like something.
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

export default function ChecklistBlock({ slotName, data, compact = false }) {
  const rows = Array.isArray(data) ? data.filter((r) => r !== null && typeof r === 'object') : [];
  if (rows.length === 0) return <EmptyState slotName={slotName} message="No checks recorded." />;

  const list = (
    <ul className="flex flex-col divide-y divide-rf-border-subtle">
      {rows.map((row, i) => {
        // `label` is a metric check's name, `text` is a whole sentence. One of the two is required.
        const identity = row.label ?? row.text;
        const hasValue = row.value !== undefined && row.value !== null && row.value !== '';

        return (
          <li key={i} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
            <StatusBadge status={row.status} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span {...typeRole('small', 'min-w-0 text-rf-text-primary')}>{identity}</span>
                {hasValue && (
                  <span {...typeRole('figure', 'shrink-0 text-rf-text-primary')}>
                    {formatValue(row.value)}
                    {/* `pct` is the check's position against its own ceiling — a real number Phase 3A
                        typed (3 rows carry it). The first draft dropped it, which the T13 baseline
                        caught as content loss rather than as the intended badge change. */}
                    {typeof row.pct === 'number' && (
                      <span {...typeRole('micro', 'ml-1 text-rf-text-tertiary')}>{formatValue({ value: row.pct, unit: 'pct' })}</span>
                    )}
                  </span>
                )}
              </div>
              {row.note !== undefined && row.note !== null && row.note !== '' && (
                <p {...typeRole('small', 'mt-[2px] text-rf-text-tertiary')}>{row.note}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div {...depthAttrs(DEPTH_BLOCK, 'checklist')}>
      <Framed slotName={slotName} compact={compact}>{list}</Framed>
    </div>
  );
}
