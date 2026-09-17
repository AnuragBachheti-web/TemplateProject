import { humanizeSlotName } from './humanizeSlotName';
import { BlockCard, BlockTitle } from './BlockCard';
import { EmptyState, ErrorState } from './BlockStates';
import Badge from '../ui/Badge';

// Mirrors extraction/classifyBlocks.js's isCalendarGanttShaped — kept as its own local copy, same
// reasoning as HeatmapGridBlock.jsx's own DECORATIVE_KEY_SUFFIX_RE: this is a runtime component,
// that module is generation-only tooling, never imported here.
const GRID_COLUMN_RE = /^(\d+)\s*\/\s*span\s*(\d+)$/;

function parseCol(col) {
  const match = typeof col === 'string' ? GRID_COLUMN_RE.exec(col.trim()) : null;
  return match ? { start: Number(match[1]), span: Number(match[2]) } : null;
}

/**
 * A calendar/Gantt lane grid — named lanes (channels, tracks), each with its own events positioned
 * on a shared column grid via `col`, a literal CSS `grid-column` value ("<line> / span <count>")
 * this data already carries (the reference's own week-numbered promo calendar) — no layout math
 * needed beyond shifting every line by 1 to make room for the lane-name column, and finding the
 * grid's own total width (the rightmost column any block reaches).
 *
 * There is no real week/date header in this data — the mockup's own "Oct 6", "Oct 13" week labels
 * never survived normalization as business data (see normalizeCorpus.js) — so this renders bare
 * column numbers rather than fabricate calendar dates it cannot back honestly.
 *
 * A lane's own blocks never overlap each other in the real corpus (conflicts are cross-lane, e.g.
 * the same week's promo appearing on two different channels) — so, unlike a general-purpose Gantt,
 * this never needs to stack overlapping blocks within one lane's row.
 */
export default function CalendarGanttBlock({ slotName, data }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (!Array.isArray(data)) {
    return <ErrorState slotName={slotName} message={`expected an array, got ${typeof data}`} />;
  }
  if (data.length === 0) {
    return <EmptyState slotName={slotName} message="No lanes." />;
  }

  const colCount = Math.max(
    0,
    ...data.flatMap((row) => (Array.isArray(row?.blocks) ? row.blocks : []).map((b) => {
      const parsed = parseCol(b?.col);
      return parsed ? parsed.start + parsed.span - 1 : 0;
    })),
  );
  if (colCount === 0) {
    return <ErrorState slotName={slotName} message="no positioned blocks to plot" />;
  }

  const gridTemplateColumns = `112px repeat(${colCount}, minmax(44px, 1fr))`;
  const chartLabel = `Calendar, ${data.length} lane${data.length === 1 ? '' : 's'} across ${colCount} columns.`;

  return (
    <BlockCard>
      <BlockTitle className="mb-2">{humanizeSlotName(slotName)}</BlockTitle>
      <div className="overflow-x-auto" role="img" aria-label={chartLabel}>
        <div className="flex min-w-fit flex-col gap-1">
          {data.map((row, ri) => (
            <div
              key={row?.name ?? row?.label ?? ri}
              className="grid items-stretch gap-1"
              style={{ gridTemplateColumns, gridAutoRows: '34px' }}
            >
              <div className="min-w-0 self-center pr-2">
                <div className="truncate text-[11px] font-medium text-rf-text-primary">
                  {row?.name ?? row?.label ?? `Lane ${ri + 1}`}
                </div>
                {row?.note && <div className="truncate text-[10px] text-rf-text-tertiary">{row.note}</div>}
              </div>
              {(Array.isArray(row?.blocks) ? row.blocks : []).map((block, bi) => {
                const parsed = parseCol(block?.col);
                if (!parsed || typeof block.label !== 'string') return null;
                return (
                  <div
                    key={bi}
                    className="flex min-w-0 flex-col justify-center gap-0.5 rounded-md border border-rf-border-subtle bg-rf-surface-raised px-2 py-0.5"
                    style={{ gridColumn: `${parsed.start + 1} / span ${parsed.span}` }}
                    title={[block.label, block.sub].filter(Boolean).join(' · ')}
                  >
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="truncate text-[10.5px] font-medium text-rf-text-primary">{block.label}</span>
                      {typeof block.conflicts === 'number' && block.conflicts > 0 && (
                        <Badge tone="warning">{block.conflicts}</Badge>
                      )}
                    </div>
                    {block.sub && <span className="truncate text-[9.5px] text-rf-text-tertiary">{block.sub}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </BlockCard>
  );
}
