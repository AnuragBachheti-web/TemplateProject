import ChipRow from './children/ChipRow';
import { humanizeSlotName } from './humanizeSlotName';
import { slotLabel } from './slotLabel';
import Metric from './children/Metric';
import SubRowList from './children/SubRowList';
import { EmptyState } from './BlockStates';
import { BlockCard, BlockTitle, CompactEyebrow } from './BlockCard';
import { DEPTH_BLOCK, depthAttrs } from './renderDepth';
import { formatValue } from './formatValue';
import { assertVariant } from './variants';
import { cellText } from './cellText';

import { typeRole } from './typeRole';
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
/**
 * THE THREE CARD VARIANTS (Phase 5B), one per slot, which is why cardSet sits exactly at I2's cap
 * of three rather than over it. All three are the same concept — a named choice with supporting
 * figures — drawn three ways by the reference.
 *
 *   groupCard     item_groups   a nested `rules` list, a `foot` paragraph, an inline `hist` chart
 *                               (S9.18-3-decide:235-239, S10.4-3-decide:305-307, S9.7-3-decide:267-277)
 *   routeCard     next_actions  `attachments` as pill chips and the `gate` chip
 *                               (S10.3-3-decide:393-397 and :321-325)
 *   scenarioCard  alternatives  the headline comes from `n`, labelled by `tag`
 *                               (S9.14-3-decide:227-230)
 *
 * NO COLOUR ON `tag`, `flag`, `badge` OR `kind`. The reference tints all four, and the payload
 * carries no status behind any of them — `item_groups[].tag` is grow/reduce/exit while
 * `alternatives[].tag` is tight/planned/stretch, so one map cannot serve both, and `flag` is free
 * prose ("Over exit cap", "defensible"). Inferring polarity from wording would be a classifier on
 * prose, inside a component, deciding what is good news. Ruling R72: they render uncoloured.
 */
const HEADLINE_KEYS = ['name', 'title', 'label'];
/** scenarioCard's fallback headline, when the row names itself with neither name/title/label. */
const SCENARIO_HEADLINE_KEYS = ['n'];
/** groupCard's extra nested-list keys, on top of NESTED_KEYS. */
const GROUP_NESTED_KEYS = ['rules'];
/** routeCard's chip-list key, rendered as pills rather than flattened into a detail line. */
const CHIP_LIST_KEYS = ['attachments'];
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

export default function CardSetBlock({ slotName, data, compact = false, variant }) {
  assertVariant('cardSet', variant);
  const rows = Array.isArray(data) ? data.filter((r) => r !== null && typeof r === 'object') : [];
  if (rows.length === 0) return <EmptyState slotName={slotName} message="No options to choose from." />;

  const cards = (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => {
        // scenarioCard leads with the number the reference leads with. Without it these three
        // cards read "Option 1/2/3" — the row names itself with `n` and `tag`, and neither is in
        // HEADLINE_KEYS, which is a vocabulary gap rather than an anonymous row.
        const scenarioHeadline = variant === 'scenarioCard' ? firstOf(row, SCENARIO_HEADLINE_KEYS) : undefined;
        const headline = firstOf(row, HEADLINE_KEYS) ?? scenarioHeadline ?? `Option ${i + 1}`;
        // A KEY PROMOTED TO THE HEADLINE IS NO LONGER A FIGURE. `n` is not in NOT_A_FIGURE — it was
        // never a headline before this variant — so the figure complement picked it up again and the
        // card read "4" at the top and "N 4" underneath. That is the duplicate-fact defect Phase 4
        // deleted `decision_mode` for and 5C deleted `stage_status` for, arriving through a variant.
        // Caught by looking at a screenshot: every measurement passed.
        const usedAsHeadline = scenarioHeadline !== undefined && firstOf(row, HEADLINE_KEYS) === undefined
          ? SCENARIO_HEADLINE_KEYS.find((k) => row[k] === scenarioHeadline)
          : undefined;
        const body = firstOf(row, BODY_KEYS);
        const chips = CHIP_KEYS.map((k) => row[k]).filter((v) => typeof v === 'string');
        // `isFocus` is the reference's flag for the group the screen drills into — real signal, and
        // the first draft dropped it because a boolean is not a figure. ItemQueue used to print it
        // as "Is Focus: No", which is worse than either. It is a QUALIFIER, so it becomes a chip.
        if (row.isFocus === true) chips.push('Focused');
        const nestedKeys = variant === 'groupCard' ? [...NESTED_KEYS, ...GROUP_NESTED_KEYS] : NESTED_KEYS;
        const nested = nestedKeys.map((k) => row[k]).find(Array.isArray);
        // routeCard's attachments are CHIPS, not a sub-row list: short labels the reference draws
        // as pills. The default flattened them into nothing at all — they are in neither
        // NESTED_KEYS nor the figure complement.
        const chipList = variant === 'routeCard'
          ? CHIP_LIST_KEYS.map((k) => row[k]).find(Array.isArray) ?? []
          : [];
        // The gate, and the group footer. Both are plain strings the default set aside as
        // NOT_A_FIGURE and then never rendered.
        const gate = variant === 'routeCard' && typeof row.gate === 'string' ? row.gate : undefined;
        const foot = variant === 'groupCard' && typeof row.foot === 'string' ? row.foot : undefined;
        const histogram = variant === 'groupCard' && Array.isArray(row.hist) ? row.hist : undefined;
        // Scalars the named parts did not claim, in the reference's own key order.
        const figures = Object.entries(row).filter(
          ([k, v]) => !NOT_A_FIGURE.has(k) && k !== usedAsHeadline
            && (typeof v === 'string' || typeof v === 'number') && String(v).trim() !== '',
        );

        return (
          <article
            key={i}
            data-card
            className="rounded-xl border border-rf-border-subtle bg-rf-surface-canvas px-3 py-2.5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h4 {...typeRole('body', 'min-w-0 text-rf-text-primary')}>{headline}</h4>
              <ChipRow chips={chips} />
            </div>

            {body !== undefined && (
              <p {...typeRole('body', 'mt-1 text-rf-text-secondary')}>{body}</p>
            )}

            {figures.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
                {figures.map(([key, value]) => (
                  // The reference's key IS the figure's name (`cm`, `gmroi`, `rev`); humanized for
                  // display by the same helper every other block uses, never renamed in the payload.
                  <Metric key={key} label={humanizeSlotName(key)} value={formatValue(value)} />
                ))}
              </div>
            )}

            {chipList.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {chipList.map((chip, ci) => {
                  const label = typeof chip === 'string' ? chip : chip?.label;
                  if (typeof label !== 'string' || label.trim() === '') return null;
                  return (
                    <span
                      key={`${label}-${ci}`}
                      {...cellText('identifier', label, typeRole('micro', 'inline-flex items-center rounded-full border border-rf-border-subtle px-2.5 py-[3px] text-rf-text-secondary').className)}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            )}

            {gate !== undefined && (
              <p className="mt-2">
                <span {...cellText('identifier', gate, typeRole('label', 'inline-flex items-center rounded-full bg-rf-surface-sunken px-2.5 py-[3px] text-rf-text-secondary').className)}>
                  {gate}
                </span>
              </p>
            )}

            {/* The magnitude histogram the reference draws inside the card. Every bar's height is
                DERIVED from its own `n` against the row's own maximum — the mockup's `h` pixel
                values are geometry and the hygiene pass strips them, which is the contract working
                rather than a gap. */}
            {histogram !== undefined && histogram.length > 0 && (
              // h-24 so the BAR TRACK below gets roughly the 70px the reference gives it
              // (S9.7-3-decide:272, `height:70px`) once the count and the label have taken theirs.
              <div data-card-histogram className="mt-2.5 flex h-24 items-end gap-1">
                {histogram.map((bar, bi) => {
                  const max = Math.max(...histogram.map((b) => Number(b?.n) || 0), 1);
                  const height = Math.max(2, Math.round(((Number(bar?.n) || 0) / max) * 100));
                  return (
                    // `h-full` on the COLUMN, not just on the row. A percentage height resolves
                    // against a definite parent height, and without it the bar computed to zero:
                    // the counts and the labels rendered and nothing appeared between them. The
                    // layout gate passed it — no clipped text, regions scrolling, cards equal
                    // height, all true — and only the screenshot showed the chart was missing.
                    <span key={`${bar?.label ?? bi}`} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1">
                      <span {...cellText('figure', String(bar?.n ?? ''), typeRole('micro', 'text-rf-text-tertiary').className)}>{bar?.n}</span>
                      {/* THE BAR NEEDS ITS OWN TRACK. A percentage height resolves against the
                          parent's height, so with the bar as a direct sibling of the count and the
                          label its 100% meant "the whole column including that text" — every bar
                          came out within a few pixels of every other, and a 14 looked the same as a
                          4. The track is a flex child with a resolved height and nothing else in
                          it, so the percentage finally means what it says. */}
                      <span className="flex w-full flex-1 items-end">
                        <span className="w-full rounded-t-sm bg-rf-border-strong" style={{ height: `${height}%` }} />
                      </span>
                      <span {...cellText('figure', String(bar?.label ?? ''), typeRole('micro', 'text-rf-text-tertiary').className)}>{bar?.label}</span>
                    </span>
                  );
                })}
              </div>
            )}

            {nested !== undefined && <SubRowList rows={nested} />}

            {foot !== undefined && (
              <p {...cellText('prose', foot, typeRole('body', 'mt-2 border-t border-rf-border-subtle pt-2 text-rf-text-secondary').className)}>{foot}</p>
            )}
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
