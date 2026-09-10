import { humanizeSlotName } from './humanizeSlotName';
import { flattenDisplayValue } from './flattenDisplayValue';
import { flattenNestedEntry } from './nestedEntryText';
import { EmptyState, ErrorState } from './BlockStates';

// Same rule extraction/classifyBlocks.js uses to decide a key is styling, not content — kept as
// its own local copy (this is a runtime component; that module is generation-only tooling, never
// imported here).
const DECORATIVE_KEY_SUFFIX_RE = /(Bg|Fg|Tone|Tint|Border|Cursor|Icon|Glow|Edge|Dot|Shadow|Opacity|Mark|Hue|Fill|Stroke)$/;
const DECORATIVE_EXACT_KEYS = new Set([
  'icon', 'tone', 'tint', 'bg', 'border', 'mark', 'hue', 'fill', 'stroke', 'cursor', 'shadow', 'opacity', 'edge', 'glow',
]);
function isDecorativeKey(key) {
  return DECORATIVE_EXACT_KEYS.has(key) || DECORATIVE_KEY_SUFFIX_RE.test(key);
}

// The keys the primary value is picked from — anything else on the item (once decorative keys are
// out of the way) used to be silently dropped even though it's real content (see
// extraction/audit.js's A.3 "classified-but-incomplete" check).
const PICKED_VALUE_KEYS = new Set(['label', 'value', 'note', 'detail', 'amount', 'pct']);

// A nested array (e.g. a group's own `items`, a cohort grid's own `cells`) needs the same compact
// per-entry summary ObjectBlock and ItemQueueBlock's sub-lists use — flattenDisplayValue alone
// returns '' for an array of plain (non-JSX) objects, which used to make this look "empty" and
// get silently dropped even though every item has real label/value content.
function entryText(value) {
  if (Array.isArray(value)) return value.map(flattenNestedEntry).filter(Boolean).join(', ');
  return flattenDisplayValue(value);
}

function extraEntries(item) {
  if (item === null || typeof item !== 'object') return [];
  return Object.entries(item)
    .filter(([key, value]) => !PICKED_VALUE_KEYS.has(key) && !isDecorativeKey(key) && value !== null && value !== undefined)
    .map(([key, value]) => [key, entryText(value)])
    .filter(([, text]) => text !== '');
}

export default function LabelValueListBlock({ slotName, data }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (!Array.isArray(data)) {
    return <ErrorState slotName={slotName} message={`expected a list, got ${typeof data}`} />;
  }
  if (data.length === 0) {
    return <EmptyState slotName={slotName} message="No rows." />;
  }

  return (
    <div className="rounded-lg border border-rf-border-subtle bg-rf-surface-canvas p-3">
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-rf-text-tertiary">
        {humanizeSlotName(slotName)}
      </p>
      <ul className="flex flex-col divide-y divide-rf-border-subtle">
        {data.map((item, i) => (
          <li key={i} className="flex flex-col gap-0.5 py-1.5 text-[12.5px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-rf-text-secondary">{item?.label}</span>
              <span className="truncate font-medium text-rf-text-primary">
                {flattenDisplayValue(item?.value ?? item?.note ?? item?.detail ?? item?.amount ?? item?.pct)}
              </span>
            </div>
            {extraEntries(item).map(([key, text]) => (
              <div key={key} className="flex items-center justify-between gap-3 text-[10.5px] text-rf-text-tertiary">
                <span>{humanizeSlotName(key)}</span>
                <span className="truncate">{text}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
