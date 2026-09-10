import { humanizeSlotName } from './humanizeSlotName';
import { flattenDisplayValue } from './flattenDisplayValue';
import { flattenNestedEntry } from './nestedEntryText';
import { severityTone } from './severityTone';
import { EmptyState, ErrorState } from './BlockStates';

// Candidate field names an item might carry each concept under — kept in sync with (but
// independently of) extraction/classifyBlocks.js's ITEM_LEVEL_CANDIDATES; that module is
// generation-only tooling, never imported at runtime, so this is its own small copy.
// 'theme'/'verdict'/'lens'/'term' and 'date'/'when' (timeline items with no title of their own,
// e.g. S10.1/execute.history, S9.13/reason.trigger) are last-resort headlines, tried only after
// the strong identity fields — better than falling all the way through to a bare "Item N".
const HEADLINE_KEYS = ['title', 'name', 'label', 'product', 'theme', 'verdict', 'lens', 'term', 'date', 'when'];
const DETAIL_KEYS = [
  'note',
  'detail',
  'summary',
  'body',
  'reason',
  'rationale',
  'rule',
  'quote',
  'text',
  'sub',
  'what',
  'definition',
];
const IDENTIFIER_KEYS = ['sku', 'id', 'caseId', 'ref'];
const STATE_KEYS = ['status', 'state'];
const SEVERITY_KEYS = ['severity'];

// Same rule extraction/classifyBlocks.js uses to decide a key is styling, not content — kept as
// its own local copy (this is a runtime component; that module is generation-only tooling, never
// imported here). Without this, "extra fields" below would render raw color/icon keys like `hue`
// or `icon` as if they were real data.
const DECORATIVE_KEY_SUFFIX_RE = /(Bg|Fg|Tone|Tint|Border|Cursor|Icon|Glow|Edge|Dot|Shadow|Opacity|Mark|Hue|Fill|Stroke)$/;
const DECORATIVE_EXACT_KEYS = new Set([
  'icon', 'tone', 'tint', 'bg', 'border', 'mark', 'hue', 'fill', 'stroke', 'cursor', 'shadow', 'opacity', 'edge', 'glow',
]);
function isDecorativeKey(key) {
  return DECORATIVE_EXACT_KEYS.has(key) || DECORATIVE_KEY_SUFFIX_RE.test(key);
}

function pickKey(item, keys) {
  return keys.find((key) => item[key] !== undefined && item[key] !== null);
}

/**
 * Some items nest a whole second list under their own key — a diff (`{field, before, after}`
 * rows), a plan (`{label, value}` rows), a set of criteria (plain strings), a lineage/signal chain
 * (`{icon, label}` rows). Rendering only headline/detail/state/severity would silently drop all of
 * that. This surfaces every array field the headline/detail/etc. picks didn't already consume, as
 * a small indented sub-list — generic across shapes rather than special-cased per workflow.
 */
function findNestedLists(item, usedKeys) {
  const lists = [];
  for (const [key, value] of Object.entries(item)) {
    if (usedKeys.has(key) || !Array.isArray(value) || value.length === 0) continue;
    const entries = value.map(flattenNestedEntry).filter(Boolean);
    if (entries.length > 0) lists.push([key, entries]);
  }
  return lists;
}

/**
 * Every field the headline/detail/identifier/state/severity picks and the nested-list scan above
 * didn't already consume — a second metric, a formatted figure, a status badge's own display
 * value — used to just vanish with no visual trace (see extraction/audit.js's A.3
 * "classified-but-incomplete" check; this is exactly what broke S9.1/analyze's `rows`, where
 * `role`/`vel`/`cm`/`turns`/`gmroi`/`cpw` all disappeared, leaving only a bare product name).
 * Rendered as a compact "extra fields" line rather than dropped. Arrays are skipped here — an
 * empty one has nothing to show, and a non-empty one is already covered by findNestedLists above.
 */
function findExtraFields(item, usedKeys) {
  const fields = [];
  for (const [key, value] of Object.entries(item)) {
    if (usedKeys.has(key) || isDecorativeKey(key)) continue;
    if (value === null || value === undefined || Array.isArray(value)) continue;
    const text = flattenDisplayValue(value);
    if (!text) continue;
    fields.push([key, text]);
  }
  return fields;
}

function Item({ item, index }) {
  if (item === null || typeof item !== 'object') {
    return (
      <li className="rounded-md border border-rf-border-subtle px-3 py-2 text-[12.5px] text-rf-text-primary">
        {flattenDisplayValue(item)}
      </li>
    );
  }

  const headlineKey = pickKey(item, HEADLINE_KEYS);
  const detailKey = pickKey(item, DETAIL_KEYS);
  const identifierKey = pickKey(item, IDENTIFIER_KEYS);
  const stateKey = pickKey(item, STATE_KEYS);
  const severityKey = pickKey(item, SEVERITY_KEYS);

  const headline = flattenDisplayValue(headlineKey && item[headlineKey]) || `Item ${index + 1}`;
  const detail = detailKey && flattenDisplayValue(item[detailKey]);
  const identifier = identifierKey && item[identifierKey];
  const state = stateKey && item[stateKey];
  const severity = severityKey && item[severityKey];
  const tone = severity ? severityTone(severity) : null;

  const usedKeys = new Set([headlineKey, detailKey, identifierKey, stateKey, severityKey].filter(Boolean));
  const nestedLists = findNestedLists(item, usedKeys);
  const extraFields = findExtraFields(item, usedKeys);

  return (
    <li className="relative overflow-hidden rounded-md border border-rf-border-subtle bg-rf-surface-raised py-2 pl-4 pr-3">
      {tone && <span className={`absolute inset-y-0 left-0 w-1 ${tone.dot}`} />}
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[12.5px] font-semibold text-rf-text-primary">{headline}</p>
        {state !== undefined && (
          <span className="flex-shrink-0 rounded-full bg-rf-surface-sunken px-2 py-0.5 text-[10px] font-semibold uppercase text-rf-text-secondary">
            {String(state)}
          </span>
        )}
      </div>
      {detail && <p className="mt-0.5 line-clamp-2 text-[11.5px] text-rf-text-secondary">{detail}</p>}
      {identifier !== undefined && (
        <p className="mt-0.5 font-mono text-[10.5px] text-rf-text-tertiary">{String(identifier)}</p>
      )}
      {extraFields.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {extraFields.map(([key, text]) => (
            <span key={key} className="text-[10.5px] text-rf-text-secondary">
              <span className="text-rf-text-tertiary">{humanizeSlotName(key)}:</span> {text}
            </span>
          ))}
        </div>
      )}
      {nestedLists.map(([key, entries]) => (
        <div key={key} className="mt-1.5 border-t border-rf-border-subtle pt-1.5">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-rf-text-tertiary">
            {humanizeSlotName(key)}
          </p>
          <ul className="mt-0.5 flex flex-col gap-0.5">
            {entries.map((entry, i) => (
              <li key={i} className="text-[11px] text-rf-text-secondary">
                {entry}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </li>
  );
}

export default function ItemQueueBlock({ slotName, data }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (!Array.isArray(data)) {
    return <ErrorState slotName={slotName} message={`expected a list, got ${typeof data}`} />;
  }
  if (data.length === 0) {
    return <EmptyState slotName={slotName} message="Nothing in the queue." />;
  }

  return (
    <div className="rounded-lg border border-rf-border-subtle bg-rf-surface-canvas p-3">
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-rf-text-tertiary">
        {humanizeSlotName(slotName)} · {data.length}
      </p>
      <ul className="flex flex-col gap-1.5">
        {data.map((item, i) => (
          <Item key={i} item={item} index={i} />
        ))}
      </ul>
    </div>
  );
}
