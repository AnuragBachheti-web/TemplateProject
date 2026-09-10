import { humanizeSlotName } from './humanizeSlotName';
import { flattenDisplayValue } from './flattenDisplayValue';
import { EmptyState, ErrorState } from './BlockStates';

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Runtime-local copy of "is this column worth showing" — same idea as
// extraction/classifyBlocks.js's decorative-key filtering, kept independent since that module is
// generation-only tooling, never imported here. A column named "icon" or ending in "Tone" is
// styling, not content, even though its value is a plain string that would otherwise render fine.
const DECORATIVE_KEY_RE = /(Bg|Fg|Tone|Tint|Border|Cursor|Icon|Glow|Edge|Dot|Shadow|Opacity|Mark|Hue|Fill|Stroke)$/;
const DECORATIVE_EXACT_KEYS = new Set([
  'icon',
  'tone',
  'tint',
  'bg',
  'border',
  'mark',
  'hue',
  'fill',
  'stroke',
  'cursor',
  'shadow',
  'opacity',
  'edge',
  'glow',
]);

function isDecorativeColumn(key) {
  return DECORATIVE_EXACT_KEYS.has(key) || DECORATIVE_KEY_RE.test(key);
}

function isNumericValue(v) {
  return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)));
}

export default function TableBlock({ slotName, data }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (!Array.isArray(data)) {
    return <ErrorState slotName={slotName} message={`expected a table, got ${typeof data}`} />;
  }
  if (data.length === 0) {
    return <EmptyState slotName={slotName} message="No rows." />;
  }

  const rows = data.filter(isPlainObject);
  if (rows.length === 0) {
    return <ErrorState slotName={slotName} message="expected rows of objects" />;
  }

  // Columns are the union of every row's own keys, not just row 0's — the manifest only ever
  // classifies a uniform-shaped array as `table` in the first place (see
  // extraction/classifyBlocks.js), so in practice every row shares the same set; unioning instead
  // of reading row 0 alone is just a defensive guard against a row that turns out to carry an
  // extra key none of the others do (that key would otherwise silently vanish for every row, not
  // just its own — see extraction/audit.js's A.3 "classified-but-incomplete" check).
  const columnOrder = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key) || isDecorativeColumn(key)) continue;
      seen.add(key);
      columnOrder.push(key);
    }
  }
  const columns = columnOrder;

  return (
    <div className="overflow-hidden rounded-lg border border-rf-border-subtle bg-rf-surface-canvas">
      <p className="border-b border-rf-border-subtle px-3 py-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-rf-text-tertiary">
        {humanizeSlotName(slotName)} · {rows.length}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-rf-surface-sunken">
              {columns.map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap border-b border-rf-border-subtle px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-rf-text-tertiary"
                >
                  {humanizeSlotName(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-rf-border-subtle last:border-0 hover:bg-rf-surface-sunken">
                {columns.map((col) => {
                  const value = row[col];
                  const numeric = isNumericValue(value);
                  return (
                    <td
                      key={col}
                      className={`px-3 py-1.5 text-rf-text-primary ${
                        numeric ? 'whitespace-nowrap text-right font-mono' : 'max-w-xs text-left'
                      }`}
                    >
                      {flattenDisplayValue(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
