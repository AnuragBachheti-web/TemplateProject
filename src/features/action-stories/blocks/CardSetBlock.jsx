import ChipRow from './children/ChipRow';
import { humanizeSlotName } from './humanizeSlotName';
import Metric from './children/Metric';
import SubRowList from './children/SubRowList';
import { EmptyState } from './BlockStates';
import { BlockCard, BlockTitle, CompactEyebrow } from './BlockCard';
import { DEPTH_BLOCK, depthAttrs } from './renderDepth';

/**
 * A NAMED CHOICE OR GROUP, with its supporting figures — the richest row-level composition in the
 * vocabulary, and the reason the child mechanism exists at all.
 *
 * One concept, three slots (I6):
 *
 *   alternatives   8 objects   the scenarios an operator switches between
 *                              ("Conservative / Balanced / Aggressive", each with CM and GMROI)
 *   next_actions   8 objects   the routes out of this decision
 *                              ("Approve 41-SKU slate", with the reference's own explanation)
 *   item_groups    6 objects   the selectable groups of items
 *                              ("Grow 18 SKUs with proven headroom", with rev/cm/cap and its rows)
 *
 * All three are: a name, a sentence explaining it, short qualifying words, some figures, and
 * sometimes a nested row set. `alternatives` and `item_groups` were rendered as TABLES — which puts
 * a paragraph of prose in a cell and makes every card the same width as the widest figure — and
 * `next_actions` as an itemQueue, which flattened its figures into a detail line.
 *
 * TYPED CONTRACT. The three slots name the same parts differently, and the mapping is declared HERE
 * rather than discovered per row (I4): nothing below inspects a value to decide what it is. Two
 * slots calling a headline `name` and a third calling it `title` is a vocabulary difference in the
 * reference, not a shape to sniff (I2) — so it is a fixed key list, read in a fixed order.
 *
 * FIGURES are whatever remains after the named parts and the nested rows are taken. That is a
 * declared complement, not a heuristic: the key lists below are exhaustive for these three slots,
 * and a field the reference adds later appears as a figure rather than disappearing — which is the
 * failure mode that matters (a silently dropped field), inverted.
 */
const HEADLINE_KEYS = ['name', 'title', 'label'];
const BODY_KEYS = ['sub', 'detail', 'note', 'body', 'blurb'];
const CHIP_KEYS = ['flag', 'tag', 'kind', 'chip', 'badge', 'effectLabel', 'toggleLabel'];
const NESTED_KEYS = ['rows', 'items', 'changes', 'candidates'];
/** Never a figure: layout leftovers and per-row flags the card renders through another part. */
const NOT_A_FIGURE = new Set([...HEADLINE_KEYS, ...BODY_KEYS, ...CHIP_KEYS, ...NESTED_KEYS, 'isFocus', 'foot', 'hist', 'rules', 'gate']);

/** The first key in `keys` that the row actually carries a usable value for. */
function firstOf(row, keys) {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return undefined;
}


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

export default function CardSetBlock({ slotName, data, compact = false }) {
  const rows = Array.isArray(data) ? data.filter((r) => r !== null && typeof r === 'object') : [];
  if (rows.length === 0) return <EmptyState slotName={slotName} message="No options to choose from." />;

  const cards = (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => {
        const headline = firstOf(row, HEADLINE_KEYS) ?? `Option ${i + 1}`;
        const body = firstOf(row, BODY_KEYS);
        const chips = CHIP_KEYS.map((k) => row[k]).filter((v) => typeof v === 'string');
        // `isFocus` is the reference's flag for the group the screen drills into — real signal, and
        // the first draft dropped it because a boolean is not a figure. ItemQueue used to print it
        // as "Is Focus: No", which is worse than either. It is a QUALIFIER, so it becomes a chip.
        if (row.isFocus === true) chips.push('Focused');
        const nested = NESTED_KEYS.map((k) => row[k]).find(Array.isArray);
        // Scalars the named parts did not claim, in the reference's own key order.
        const figures = Object.entries(row).filter(
          ([k, v]) => !NOT_A_FIGURE.has(k) && (typeof v === 'string' || typeof v === 'number') && String(v).trim() !== '',
        );

        return (
          <article
            key={i}
            data-card
            className="rounded-xl border border-rf-border-subtle bg-rf-surface-canvas px-3 py-2.5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="min-w-0 text-[12.5px] font-medium leading-snug text-rf-text-primary">{headline}</h4>
              <ChipRow chips={chips} />
            </div>

            {body !== undefined && (
              <p className="mt-1 text-[11.5px] leading-snug text-rf-text-secondary">{body}</p>
            )}

            {figures.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
                {figures.map(([key, value]) => (
                  // The reference's key IS the figure's name (`cm`, `gmroi`, `rev`); humanized for
                  // display by the same helper every other block uses, never renamed in the payload.
                  <Metric key={key} label={humanizeSlotName(key)} value={String(value)} />
                ))}
              </div>
            )}

            {nested !== undefined && <SubRowList rows={nested} />}
          </article>
        );
      })}
    </div>
  );

  return (
    <div {...depthAttrs(DEPTH_BLOCK, 'cardSet')}>
      <Framed slotName={slotName} compact={compact}>{cards}</Framed>
    </div>
  );
}
