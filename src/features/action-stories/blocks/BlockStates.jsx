import { slotLabel } from './slotLabel';

import { typeRole } from './typeRole';
import { surfaceTier } from './surfaceTier';
/**
 * Shared empty/error presentation for every block type.
 *
 * "Empty" is a real, expected outcome once actionStoriesService.js is backed by a real endpoint
 * (see actionStoriesService.js's SAMPLE DATA note / INTEGRATION.md) — a queue with nothing in it
 * today is a legitimate response, not a bug. StageRenderer already keeps a genuinely broken block
 * (a binding that resolves to nothing, or a value validateBlockData rejects) from ever reaching a
 * block component at all, so "error" here is a component's own last-resort guard for a value that
 * doesn't match what its own blockType promises — belt-and-suspenders for the day this block gets
 * rendered from somewhere other than StageRenderer, or the real API sends a shape validateBlockData
 * doesn't yet know to catch.
 */
export function EmptyState({ slotName, message = 'Nothing here yet.' }) {
  return (
    <div className={`rounded-xl border border-dashed border-rf-border-default ${surfaceTier('card').className} px-4 py-3`}>
      <p {...typeRole('label', 'text-rf-text-tertiary')}>
        {slotLabel(slotName)}
      </p>
      <p {...typeRole('body', 'mt-1 text-rf-text-tertiary')}>{message}</p>
    </div>
  );
}

/**
 * A chart that does not have enough points to be a chart yet (blocks/chartEvidence.js).
 *
 * DISTINCT FROM EmptyState ON PURPOSE. "Nothing here yet." is a claim about the DATA — the queue is
 * empty, come back later. This is a claim about the EVIDENCE: the points exist, there are just too
 * few of them to draw a shape an operator should read anything into. Collapsing the two would tell
 * someone their three data points don't exist.
 *
 * Says the count, because "not enough" without a number is not actionable.
 */
export function ThinEvidenceState({ slotName, points }) {
  return (
    <div className={`rounded-xl border border-dashed border-rf-border-default ${surfaceTier('card').className} px-4 py-3`}>
      <p {...typeRole('label', 'text-rf-text-tertiary')}>
        {slotLabel(slotName)}
      </p>
      <p {...typeRole('body', 'mt-1 text-rf-text-tertiary')}>
        Not enough evidence to chart — {points} {points === 1 ? 'point' : 'points'}.
      </p>
    </div>
  );
}

export function ErrorState({ slotName, message }) {
  return (
    <div className="rounded-xl border border-dashed border-rf-status-critical/40 bg-rf-status-critical/10 px-4 py-3">
      <p {...typeRole('label', 'text-rf-status-critical-text')}>
        {slotLabel(slotName)}
      </p>
      <p {...typeRole('body', 'mt-1 text-rf-status-critical-text')}>{message}</p>
    </div>
  );
}
