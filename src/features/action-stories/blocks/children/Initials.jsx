import { DEPTH_CHILD, depthAttrs } from '../renderDepth';

import { typeRole } from '../typeRole';
import { surfaceTier } from '../surfaceTier';
/**
 * The identity chip on a roster row.
 *
 * `proposal.agents` carries `initials` on 27 of 81 rows; where the reference does not state them
 * they are derived from the name's own words, which is a display decision about data already in
 * hand and not an invented value. A roster row with no chip at all reads as a bare list and loses
 * the "who/what is credited" quality the reference's pinned identity strip has.
 */
function initialsFor(name, explicit) {
  if (typeof explicit === 'string' && explicit.trim() !== '') return explicit.trim().slice(0, 3);
  if (typeof name !== 'string') return '—';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function Initials({ name, initials }) {
  return (
    <span
      {...depthAttrs(DEPTH_CHILD)}
      data-initials
      aria-hidden="true"
      {...typeRole('label', `inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-rf-border-subtle ${surfaceTier('nested').className} text-rf-text-secondary`)}
    >
      {initialsFor(name, initials)}
    </span>
  );
}
