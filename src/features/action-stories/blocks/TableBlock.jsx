import { Fragment, useState, useRef, useEffect, useCallback } from 'react';
import Checkbox from '../ui/Checkbox';
import { humanizeSlotName } from './humanizeSlotName';
import { slotLabel } from './slotLabel';
import { flattenDisplayValue } from './flattenDisplayValue';
import { deltaTone } from './deltaTone';
import { BlockCard } from './BlockCard';
import { EmptyState, ErrorState } from './BlockStates';
import { isHiddenKey as isHiddenColumn } from './decorativeKeys';
import { splitColumns, isControlColumn } from './tableColumns';
import { isFigureColumn, proseColumnMinCh } from './tableColumnLayout';
import { cellText } from './cellText';
import { typeRole } from './typeRole';
import { isFigureText } from './figureShape';

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isNumericValue(v) {
  return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)));
}

// `__raw` (and any future `__`-prefixed internal companion — see decorativeKeys.js's own doc
// comment) is never a real column to show: extraction/dcLogicSandbox.js's attachRawRecords attaches
// it alongside a row's own formatted display fields so a downstream consumer that needs real
// numbers can reach them. Previously excluded here via a local, hardcoded
// `HIDDEN_COLUMN_KEYS = new Set(['__raw'])` — replaced with the shared, generic `isHiddenKey` so a
// second internal field introduced later doesn't need its own new hardcoded entry in a fourth place.

// `isNestedControlColumn` now lives in tableColumns.js — the same generic shape
// extraction/classifyBlocks.js detects at classification time, re-checked at render time (no
// manifest field carries this). It moved because the column RULE has to ask the same question the
// cell asks: a column whose every cell would render "—" is not a column. Phase 5E, R74.

/** A row-level segmented control (S9.11/decide.slate's own `modes`: Roll/Test) — options and their
 * labels come entirely from the row's own data, never hardcoded. Purely local UI state: which
 * option reads as "selected" for display purposes, seeded from whichever option the data itself
 * hints is current (the highest `weight`, a convention already used throughout this reference
 * corpus to mark the active choice — see e.g. slate[].modes[].weight) and otherwise the first
 * option; clicking another option is a local, per-viewer choice, not a write to any backend. */
function RowControl({ options }) {
  const initialIndex = (() => {
    let best = 0;
    let bestWeight = -Infinity;
    options.forEach((opt, i) => {
      const w = typeof opt.weight === 'number' ? opt.weight : 0;
      if (w > bestWeight) {
        bestWeight = w;
        best = i;
      }
    });
    return best;
  })();
  const [selected, setSelected] = useState(initialIndex);

  return (
    <div {...typeRole('micro', 'inline-flex overflow-hidden rounded-md border border-rf-border-subtle')}>
      {options.map((opt, i) => (
        <button
          key={i}
          type="button"
          onClick={() => setSelected(i)}
          aria-pressed={selected === i}
          className={`px-2 py-0.5 transition-colors ${
            selected === i
              ? 'bg-rf-text-primary text-rf-surface-canvas'
              : 'bg-transparent text-rf-text-tertiary hover:bg-rf-surface-sunken'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Past this many rows, a table gets: a scroll region with a sticky header (so the header stays
// visible while scrolling instead of scrolling away with the data) and client-side pagination.
// Below it, every row just renders inline — no scroll chrome, no page controls, matching the
// project's own "progressive enhancement, not complexity for tiny datasets" rule; every one of the
// 105 real fixtures today is single/low-digit rows, so this almost never activates yet, but a
// production backend returning hundreds of rows now has somewhere safe to land.
const LARGE_TABLE_ROW_THRESHOLD = 12;
const PAGE_SIZE = 25;

function compareForSort(a, b) {
  const aNum = isNumericValue(a) ? Number(a) : null;
  const bNum = isNumericValue(b) ? Number(b) : null;
  if (aNum !== null && bNum !== null) return aNum - bNum;
  const aText = flattenDisplayValue(a);
  const bText = flattenDisplayValue(b);
  return aText.localeCompare(bText, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * The one table implementation every `table`-classified block uses. Adds real interactivity
 * (client-side sort, pagination past a row-count threshold, a sticky header once scrolling is
 * possible) on top of the original static rendering — AUDIT_REPORT.md §8's "no sorting, filtering,
 * pagination, sticky header" gap. `useState` here is a deliberate, narrow exception to "blocks are
 * plain functions, no hooks" (SliderBlock.jsx is the only prior one) — sort/page position is
 * per-render UI state, never business data, and stays entirely inside this one component; see
 * TableBlock.test.jsx (a real-render test, not the bare-function-call style every stateless block
 * uses) for why that's the right tradeoff here.
 *
 * @param {boolean} [compact] - true when this table is already inside a shared panel (a rail
 *   section, or an explicit `layout.group` — see StageSections.jsx) — renders the table itself
 *   without BlockCard's own border/shadow, so it doesn't nest a second card inside the panel
 *   that's already providing one (the same rule every other block type follows).
 */
/**
 * Optional row selection (`selectable`/`selectedIds`/`onToggleRow`/`rowIdOf`) is the ONE addition
 * this block needed for Approve-selected. It is inert unless a caller opts in, so every existing
 * render is byte-identical: no extra column, no extra DOM, no behaviour change. TableBlock knows
 * nothing about approval — it renders a checkbox column and reports which row ids are ticked.
 */
export default function TableBlock({ slotName, data, compact, selectable = false, selectedIds, onToggleRow, rowIdOf }) {
  const [sort, setSort] = useState(null); // { key, direction: 'asc'|'desc' } | null
  const [page, setPage] = useState(0);

  // Scroll-shadow affordance (RENDERED_UI_FORENSIC_AUDIT.md §3.6/§11): a table wider than its
  // container already scrolls (`overflow-x-auto`/`overflow-auto` below), but nothing signaled that
  // — confirmed silently "clipping" columns on 3 different workflows (S9.16/Decide, S9.4/Decide,
  // S9.6/Analyze) with no visual cue a reader would ever notice without already knowing to scroll.
  // Declared before any early return so hook call order never depends on `data`'s shape.
  const scrollRef = useRef(null);
  const [scrollShadow, setScrollShadow] = useState({ left: false, right: false });
  const updateScrollShadow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
    setScrollShadow((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);
  useEffect(() => {
    updateScrollShadow();
    window.addEventListener('resize', updateScrollShadow);
    return () => window.removeEventListener('resize', updateScrollShadow);
  }, [updateScrollShadow, data]);

  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (!Array.isArray(data)) {
    return <ErrorState slotName={slotName} message={`expected a table, got ${typeof data}`} />;
  }
  if (data.length === 0) {
    return <EmptyState slotName={slotName} message="No rows." />;
  }

  const allRows = data.filter(isPlainObject);
  if (allRows.length === 0) {
    return <ErrorState slotName={slotName} message="expected rows of objects" />;
  }

  // COLUMNS ARE THE FIELDS THE RECORDS SHARE — see tableColumns.js for the rule and the corpus
  // measurement behind its threshold (ruling R74/R75).
  //
  // This WAS the union of every row's keys, on the reasoning that the classifier only ever types a
  // uniform-shaped array as `table` so the union would equal row 0's keys anyway. That premise was
  // false for 29 of the corpus's 116 tables: prop_s10_1_decide's slate carries 4-7 fields per
  // record and unioned to fifteen columns in an 834px region, wrapping a 213-character paragraph
  // over forty-four lines. A field a minority of rows carry now moves to that row's detail line
  // rather than becoming a column of dashes — it moves, it is never dropped (R75).
  const { columns, detail: detailKeys } = splitColumns(allRows, isHiddenColumn);

  // A nested-control column (S9.11/decide.slate's own `modes`) is never sortable/flattened to text
  // like an ordinary cell — tracked separately so the header/cell rendering below can special-case it.
  const controlColumns = new Set(columns.filter((col) => isControlColumn(allRows, col)));

  // ALIGNMENT AND MINIMUM WIDTH ARE THE COLUMN'S, not the cell's — see tableColumnLayout.js for both
  // defects that came of deciding them per cell. Computed once here, over ALL rows rather than the
  // visible page, so paging or sorting a table never re-aligns it or changes its column widths
  // underneath the reader.
  const columnLayout = new Map(columns.map((col) => {
    if (controlColumns.has(col)) return [col, { figure: false, minCh: null }];
    const figure = isFigureColumn(allRows, col);
    return [col, { figure, minCh: figure ? null : proseColumnMinCh(allRows, col, humanizeSlotName(col)) }];
  }));
  /** A prose column declares its floor; a figure column is `whitespace-nowrap` and sizes itself. */
  const minWidthStyle = (col) => {
    const minCh = columnLayout.get(col)?.minCh;
    return minCh === null || minCh === undefined ? undefined : { minWidth: `${minCh}ch` };
  };

  const isLarge = allRows.length > LARGE_TABLE_ROW_THRESHOLD;

  const sortedRows = sort
    ? [...allRows].sort((a, b) => {
        const cmp = compareForSort(a[sort.key], b[sort.key]);
        return sort.direction === 'asc' ? cmp : -cmp;
      })
    : allRows;

  const pageCount = isLarge ? Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE)) : 1;
  const clampedPage = Math.min(page, pageCount - 1);
  const rows = isLarge ? sortedRows.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE) : sortedRows;

  function toggleSort(key) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null; // third click clears sort, back to declared row order
    });
    setPage(0);
  }

  // Row identity for selection. A caller supplies `rowIdOf` when the slate carries a real business
  // id; the positional fallback is all a mockup-derived slate can offer, and matches what the API
  // layer's own slateItemId does so both sides agree on what "item_3" means.
  const idOf = (row, i) => rowIdOf?.(row, i) ?? row?.id ?? row?.item_id ?? row?.sku ?? row?.code ?? `item_${i}`;
  const selectedSet = new Set(Array.isArray(selectedIds) ? selectedIds : []);

  const table = (
    <>
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={updateScrollShadow}
          className={isLarge ? 'max-h-[420px] overflow-auto' : 'overflow-x-auto'}
        >
        <table {...typeRole('small', 'w-full border-collapse')}>
          <caption {...typeRole('label', 'border-b border-rf-border-subtle px-4 py-2.5 text-left text-rf-text-secondary')}>
            {slotLabel(slotName)} · {allRows.length}
          </caption>
          <thead>
            <tr className="bg-rf-surface-sunken">
              {selectable && (
                <th
                  scope="col"
                  // `text-left` because a `th` defaults to `center` and this column's checkbox sits
                  // left. Nothing visible sits in this header, so it was never the reported defect —
                  // but it is the same disagreement, and leaving one behind invites the next reader
                  // to conclude the rule is applied selectively.
                  className={`w-10 border-b border-rf-border-subtle px-3 py-2 text-left ${isLarge ? 'sticky top-0 z-10 bg-rf-surface-sunken' : ''}`}
                >
                  <span className="sr-only">Select</span>
                </th>
              )}
              {columns.map((col) => {
                const isSorted = sort?.key === col;
                return (
                  <th
                    key={col}
                    scope="col"
                    aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    // PROSE, not `identifier`, for two reasons and both matter.
                    //
                    // The principled one: a column header must never be clamped. Clamping "Days
                    // payable outstanding" to two lines can hide WHICH COLUMN this is, and a
                    // reader who cannot name the column cannot read the figures under it. A taller
                    // header row is a cheap price for that.
                    //
                    // The mechanical one, found by looking at a screenshot rather than at a
                    // measurement: `identifier` clamps via `display:-webkit-box`, which overrides a
                    // `th`'s own `display: table-cell` and collapses the whole header row into a
                    // single stacked column. Every height and width the layout gate measured was
                    // still within tolerance — the table was simply the wrong shape, and no probe
                    // asked about shape.
                    style={minWidthStyle(col)}
                    {...cellText('prose', humanizeSlotName(col), typeRole('label', `border-b border-rf-border-subtle px-4 py-2 text-rf-text-tertiary ${
                      columnLayout.get(col)?.figure ? 'text-right' : 'text-left'
                    } ${
                      isLarge ? 'sticky top-0 z-10 bg-rf-surface-sunken' : ''
                    }`).className)}
                  >
                    {controlColumns.has(col) ? (
                      <span>{humanizeSlotName(col)}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleSort(col)}
                        // `w-full` + `justify-end` so the header of a figure column sits over its
                        // own figures: a button is a flex box, and `text-right` on the `th` cannot
                        // move a shrink-to-fit child that is already hard against the left edge.
                        className={`flex w-full items-center gap-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring ${
                          columnLayout.get(col)?.figure ? 'justify-end' : ''
                        }`}
                      >
                        {humanizeSlotName(col)}
                        <span aria-hidden="true" className="text-rf-text-tertiary">
                          {isSorted ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
                        </span>
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              // The fields this record carries that are not columns. Rendered beneath its own row,
              // so every value that used to sit in a column of dashes is still on the page and
              // still attached to the row it belongs to.
              const detail = detailKeys
                .map((key) => [key, flattenDisplayValue(row[key]), isFigureText(row[key]), deltaTone(row[key])])
                .filter(([, text]) => text !== '' && text !== undefined && text !== null);
              return (
                <Fragment key={i}>
                  <tr className="border-b border-rf-border-subtle last:border-0 hover:bg-rf-surface-sunken">
                    {selectable && (
                      <td className="px-3 py-2 align-middle">
                        <Checkbox
                          checked={selectedSet.has(idOf(row, i))}
                          onChange={() => onToggleRow?.(idOf(row, i))}
                          label={`Select row ${i + 1}`}
                          hideLabel
                        />
                      </td>
                    )}
                    {columns.map((col) => {
                      const value = row[col];
                      if (controlColumns.has(col)) {
                        return (
                          // `text-left` stated rather than inherited from the UA default, so this
                          // column declares its alignment the same way every other one does. A `th`
                          // defaults to `center` and a `td` to `start`; a contract that holds only
                          // because two different defaults happen to agree is not a contract.
                          <td key={col} {...typeRole('small', 'px-4 py-2 text-left')}>
                            <RowControl options={value} />
                          </td>
                        );
                      }
                      // R87/R88. WHAT COUNTS AS A FIGURE IS figureShape.js, not
                      // `Number.isFinite(Number(v))` — that test calls "−$4.6K" prose, and this
                      // corpus's figures are all pre-formatted display strings. Typography and tone
                      // now ask the same question, so they cannot answer it differently.
                      const numeric = isFigureText(value);
                      const text = flattenDisplayValue(value);
                      const isMissing = value === null || value === undefined || text === '';
                      // Colored from the cell's OWN sign/wording only (deltaTone) — a real API has no
                      // reason to send a column-level color, but it will keep sending signed deltas
                      // ("+3%", "−$450") the same way these fixtures already do. See deltaTone.js.
                      const tone = !isMissing ? deltaTone(value) : null;
                      // A numeric cell is a FIGURE and a textual one is PROSE — the column's role, not
                      // this block's opinion, and the two rules come from the one module (cellText.js).
                      // `max-w-xs truncate` used to sit on the textual branch: it cut 538 cells across
                      // 52 objects, some by nearly 300px, with a `title` only past an arbitrary 24
                      // characters. Prose wraps now, so there is nothing left to reach for.
                      // ALIGNMENT IS THE COLUMN'S, and it was the cell's — which is how a header
                      // ended up an entire column-width from the figures under it (see
                      // tableColumnLayout.js). Typography and tone stay per-cell, exactly as R87/R88
                      // set them: a figure is still mono and still keeps the colour of its own sign
                      // even where it sits in a column that reads as prose.
                      const alignRight = columnLayout.get(col)?.figure === true;
                      return (
                        <td
                          key={col}
                          style={minWidthStyle(col)}
                          {...cellText(numeric ? 'figure' : 'prose', text, typeRole(numeric ? 'figure' : 'body', `px-4 py-2 ${
                            isMissing ? 'text-rf-text-disabled' : tone ? tone.text : 'text-rf-text-primary'
                          } ${alignRight ? 'text-right' : 'text-left'}`).className)}
                        >
                          {isMissing ? <span aria-hidden="true">—</span> : text}
                          {isMissing && <span className="sr-only">No value</span>}
                        </td>
                      );
                    })}
                  </tr>
                  {detail.length > 0 && (
                    <tr className="border-b border-rf-border-subtle last:border-0">
                      <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 pb-2 pt-0">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {detail.map(([key, text, numeric, tone]) => (
                            <span key={key} className="text-rf-text-secondary">
                              {/* PHASE 6. `micro`, not `label`. A detail line's key is dense inline
                                  annotation — micro's own stated job — and not a section eyebrow,
                                  which is what `label` is for and why it is uppercase with
                                  tracking. Reading "BADGE: recommended METRIC: ..." inline was the
                                  eyebrow treatment applied to something that is not one. */}
                              <span {...typeRole('micro', 'text-rf-text-tertiary')}>{humanizeSlotName(key)}:</span>{' '}
                              {/* A FIGURE KEEPS THE COLOUR ITS OWN SIGN GIVES IT wherever it lands.
                                  This line changes a value's POSITION, not its meaning, and S10.1's
                                  "−$2,210 / day" reading neutral grey purely because it moved would
                                  be the move losing information. Same module as the cell (deltaTone,
                                  5B), and figures only — the extra classes go through cellText's own
                                  third argument so the wrap rule and its affordance are not lost. */}
                              <span
                                {...cellText(
                                  numeric ? 'figure' : 'prose',
                                  text,
                                  typeRole(numeric ? 'figure' : 'body', tone && numeric ? tone.text : '').className,
                                )}
                              >
                                {text}
                              </span>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
        {/* Edge fades — purely decorative (aria-hidden), pointer-events-none so they never intercept
            a real scroll/click. Only shown on the side there's genuinely more to see; both fade out
            (opacity-0) the instant that edge is reached, so they never look like a permanent border. */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-rf-surface-canvas to-transparent transition-opacity duration-fast ${scrollShadow.left ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-rf-surface-canvas to-transparent transition-opacity duration-fast ${scrollShadow.right ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
      {isLarge && pageCount > 1 && (
        <div {...typeRole('small', 'flex items-center justify-between border-t border-rf-border-subtle px-3 py-1.5 text-rf-text-secondary')}>
          <span>
            Page {clampedPage + 1} of {pageCount}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={clampedPage === 0}
              className="rounded px-2 py-0.5 text-rf-text-secondary hover:bg-rf-surface-sunken disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={clampedPage >= pageCount - 1}
              className="rounded px-2 py-0.5 text-rf-text-secondary hover:bg-rf-surface-sunken disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );

  if (compact) {
    return (
      <div className="overflow-hidden rounded-xl border border-rf-border-subtle">{table}</div>
    );
  }

  return (
    <BlockCard padding="none" className="overflow-hidden">
      {table}
    </BlockCard>
  );
}
