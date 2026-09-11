import { humanizeSlotName } from './humanizeSlotName';
import { flattenDisplayValue } from './flattenDisplayValue';
import { parseMagnitude } from './chartGeometry';
import { sequentialColor, sequentialTextColor } from './chartPalette';
import { BlockCard, BlockTitle } from './BlockCard';
import { EmptyState, ErrorState } from './BlockStates';

// Same rule extraction/classifyBlocks.js uses to decide a key is styling, not content — kept as
// its own local copy (this is a runtime component; that module is generation-only tooling, never
// imported here).
const DECORATIVE_KEY_SUFFIX_RE = /(Bg|Fg|Tone|Tint|Border|Cursor|Icon|Glow|Edge|Dot|Shadow|Opacity|Mark|Hue|Fill|Stroke)$/;
const DECORATIVE_EXACT_KEYS = new Set([
  'icon', 'tone', 'tint', 'bg', 'fg', 'border', 'mark', 'hue', 'fill', 'stroke', 'cursor', 'shadow', 'opacity', 'edge', 'glow', 'weight',
]);
function isDecorativeKey(key) {
  return DECORATIVE_EXACT_KEYS.has(key) || DECORATIVE_KEY_SUFFIX_RE.test(key);
}
function isNumericLike(v) {
  return v !== undefined && v !== null && Number.isFinite(parseMagnitude(v));
}
function cellFields(cell) {
  if (cell === null || typeof cell !== 'object') return [];
  return Object.entries(cell).filter(([k]) => !isDecorativeKey(k));
}

/**
 * A 2D matrix (an RFM grid, a cohort retention table) rendered as a CSS grid with a sequential
 * color scale — no charting library needed, and more accessible than forcing a matrix through one.
 * Every row's own label is column 0; each cell shows up to 2 of its own fields and is colored by
 * whichever field is the first numeric one found anywhere in the data (the "primary" metric) — the
 * full set of a cell's fields is always available on hover via its `title`.
 */
export default function HeatmapGridBlock({ slotName, data }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (!Array.isArray(data)) {
    return <ErrorState slotName={slotName} message={`expected an array, got ${typeof data}`} />;
  }
  if (data.length === 0) {
    return <EmptyState slotName={slotName} message="No rows." />;
  }

  const rows = data.map((row) => ({ label: row?.label, cells: Array.isArray(row?.cells) ? row.cells : row?.grid ?? [] }));
  const colCount = Math.max(0, ...rows.map((r) => r.cells.length));
  if (colCount === 0) {
    return <ErrorState slotName={slotName} message="no cells to plot" />;
  }

  // The "primary" metric a heatmap colors by must be picked by which field name is *consistently*
  // numeric across the whole grid, not merely the first numeric-looking field found in whichever
  // cell happens to be visited first — object key insertion order is not a stable contract a real
  // API is expected to preserve, so a positional pick would silently change the chosen metric (and
  // therefore every cell's color) if a future response ever reordered its own JSON keys
  // (AUDIT_REPORT.md §9's HeatmapGrid row). Tallying numeric-hit counts per field name across every
  // cell and taking the field with the most hits (ties broken alphabetically) is deterministic
  // regardless of per-cell key order.
  const hitCounts = new Map(); // field name -> number of cells where it looks numeric
  for (const row of rows) {
    for (const cell of row.cells) {
      for (const [key, v] of cellFields(cell)) {
        if (!isNumericLike(v)) continue;
        hitCounts.set(key, (hitCounts.get(key) ?? 0) + 1);
      }
    }
  }
  let metricKey = null;
  let bestCount = 0;
  for (const key of [...hitCounts.keys()].sort()) {
    const count = hitCounts.get(key);
    if (count > bestCount) {
      metricKey = key;
      bestCount = count;
    }
  }

  const metricValues = metricKey
    ? rows.flatMap((r) => r.cells.map((c) => parseMagnitude(c?.[metricKey]))).filter(Number.isFinite)
    : [];
  const min = metricValues.length ? Math.min(...metricValues) : 0;
  const max = metricValues.length ? Math.max(...metricValues) : 1;
  const span = max - min || 1;

  const gridItems = [];
  rows.forEach((row, ri) => {
    gridItems.push(
      <div key={`label-${ri}`} className="flex items-center pr-2 text-[11px] text-rf-text-secondary">
        {row.label}
      </div>,
    );
    for (let ci = 0; ci < colCount; ci++) {
      const cell = row.cells[ci];
      if (!cell) {
        gridItems.push(<div key={`cell-${ri}-${ci}`} />);
        continue;
      }
      const fields = cellFields(cell);
      const metricValue = metricKey ? cell[metricKey] : undefined;
      const t = isNumericLike(metricValue) ? (parseMagnitude(metricValue) - min) / span : 0.5;
      gridItems.push(
        <div
          key={`cell-${ri}-${ci}`}
          className="flex flex-col items-center justify-center gap-0 rounded px-1 py-1.5 text-center leading-tight"
          style={{ background: sequentialColor(t), color: sequentialTextColor(t) }}
          title={fields.map(([k, v]) => `${humanizeSlotName(k)}: ${flattenDisplayValue(v)}`).join(' · ')}
        >
          {fields.slice(0, 2).map(([k, v]) => (
            <span key={k} className="text-[10px]">
              {flattenDisplayValue(v)}
            </span>
          ))}
        </div>,
      );
    }
  });

  // `title` gives a sighted mouse user per-cell detail on hover, but isn't reliably announced by
  // assistive tech and has no keyboard-focus trigger (AUDIT_REPORT.md §16: "not screen-reader-
  // equivalent") — the outer role="img" + a matrix-shape summary is the same fallback pattern
  // every other chart block uses.
  const chartLabel = `Heatmap grid, ${rows.length} rows by ${colCount} columns${metricKey ? `, colored by ${humanizeSlotName(metricKey)}` : ''}.`;

  return (
    <BlockCard>
      <BlockTitle className="mb-2">{humanizeSlotName(slotName)}</BlockTitle>
      <div className="overflow-x-auto" role="img" aria-label={chartLabel}>
        <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${colCount}, minmax(52px, 1fr))` }}>
          {gridItems}
        </div>
      </div>
    </BlockCard>
  );
}
