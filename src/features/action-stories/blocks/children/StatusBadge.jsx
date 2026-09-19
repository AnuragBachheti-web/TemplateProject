import { checkStatusTone } from '../statusTone';
import { DEPTH_CHILD, depthAttrs } from '../renderDepth';

import { typeRole } from '../typeRole';
import { surfaceTier } from '../surfaceTier';
/**
 * A guardrail check's pass/warn/fail/blocked/info status, as an affordance rather than a word in a
 * sentence.
 *
 * THIS COMPONENT IS THE POINT OF PHASE 3B. Phase 2 derived the status enum from the reference's own
 * `ok` boolean and icon/tone families, read at extraction time and discarded so only the semantic
 * word crossed the boundary — 85 rows across 20 objects. With no block able to render it, it fell
 * through labelValueList's generic key/value pass and appeared as the literal text "· warn", which
 * is the render delta Phase 2 had to pin rather than fix. The data shipped; the affordance did not.
 *
 * `data-check-status` carries the SEMANTIC word, not the colour. That is what lets T25 assert one
 * badge per row with the right status without knowing anything about how it looks, and it is what
 * keeps the status→tone decision in exactly one module (statusTone.js, I3).
 *
 * A CHILD, NOT A BLOCK. Deliberately absent from BLOCK_REGISTRY and BLOCK_TYPES, so no slot can
 * target it and it cannot re-enter the slot pipeline (I4). It renders DOM and stops.
 */
export default function StatusBadge({ status }) {
  const tone = checkStatusTone(status);

  return (
    <span
      {...depthAttrs(DEPTH_CHILD)}
      data-check-status={status}
      {...typeRole('micro', `inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rf-border-subtle ${surfaceTier('nested').className} px-2 py-[2px]`)}
      title={tone.label}
    >
      <span aria-hidden="true" className={`h-[6px] w-[6px] rounded-full ${tone.dot}`} />
      <span className={tone.text}>{tone.label}</span>
    </span>
  );
}
