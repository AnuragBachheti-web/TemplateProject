import { flattenDisplayValue } from '../flattenDisplayValue';
import { DEPTH_CHILD, depthAttrs } from '../renderDepth';

/**
 * The nested row set a card can carry — `item_groups[].rows`, `next_actions[].changes`.
 *
 * THIS IS WHERE THE DEPTH LIMIT IS SPENT. A card is depth 3 (a block), this list is depth 4 (its
 * child), and the list's own rows are DOM — not another block, not a re-entry into the slot
 * pipeline. That is the difference the cap counts (see renderDepth.js): a child may render a list
 * internally, but it may not render a block, so "a card containing a table containing a card"
 * cannot happen.
 *
 * Each row is reduced to one line by flattenDisplayValue — the leaf formatter, NOT
 * flattenNestedEntry. That distinction is I5: this is the fallback path for a value with no richer
 * representation, and it is reached only for the nested rows a card genuinely cannot lay out.
 */
export default function SubRowList({ rows, max = 4 }) {
  const usable = (rows ?? []).filter((r) => r !== null && r !== undefined);
  if (usable.length === 0) return null;

  const shown = usable.slice(0, max);
  const hidden = usable.length - shown.length;

  return (
    <ul {...depthAttrs(DEPTH_CHILD)} data-sub-rows className="mt-1 flex flex-col gap-[2px]">
      {shown.map((row, i) => {
        const text = typeof row === 'object' ? Object.values(row).map(flattenDisplayValue).filter(Boolean).join(' · ') : flattenDisplayValue(row);
        if (!text) return null;
        return (
          <li key={i} className="truncate text-[11px] text-rf-text-tertiary">
            {text}
          </li>
        );
      })}
      {hidden > 0 && (
        <li className="text-[10.5px] text-rf-text-tertiary">
          +{hidden} more
        </li>
      )}
    </ul>
  );
}
