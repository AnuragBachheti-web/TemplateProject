import { DEPTH_CHILD, depthAttrs } from '../renderDepth';

import { typeRole } from '../typeRole';
/**
 * The short qualifying words a card carries — a tag, a flag, a kind, a badge.
 *
 * These are business words ("Lowest risk", "Recommended", "Over exit cap"), not presentation: the
 * reference styled them, Phase 2's boundary stripped the styling, and the words survived. Rendering
 * them as chips rather than as another line of prose is what makes a card readable at a glance.
 *
 * Takes an explicit ARRAY from its parent. It does not inspect a row to discover which of its keys
 * happen to look chip-like — the parent knows, from its own typed contract, which fields are
 * qualifiers (I2/I4). Blank entries are dropped so a card with one chip and three empty fields does
 * not render three empty pills.
 */
export default function ChipRow({ chips }) {
  const present = (chips ?? []).filter((c) => typeof c === 'string' && c.trim() !== '');
  if (present.length === 0) return null;

  return (
    <div {...depthAttrs(DEPTH_CHILD)} data-chip-row className="flex flex-wrap items-center gap-1.5">
      {present.map((chip) => (
        <span
          key={chip}
          {...typeRole('micro', 'inline-flex items-center rounded-full border border-rf-border-subtle bg-rf-surface-sunken px-2 py-[1px] text-rf-text-secondary')}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}
