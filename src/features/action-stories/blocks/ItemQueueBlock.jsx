import { humanizeSlotName } from './humanizeSlotName';
import { slotLabel } from './slotLabel';
import { flattenDisplayValue } from './flattenDisplayValue';
import { flattenNestedEntry } from './nestedEntryText';
import { severityTone } from './statusTone';
import { deltaTone } from './deltaTone';
import { BlockCard, BlockTitle, CompactEyebrow } from './BlockCard';
import { EmptyState, ErrorState } from './BlockStates';
import { isHiddenKey } from './decorativeKeys';
import { cellText } from './cellText';

import { typeRole } from './typeRole';
// Candidate field names an item might carry each concept under — kept in sync with (but
// independently of) extraction/classifyBlocks.js's ITEM_LEVEL_CANDIDATES; that module is
// generation-only tooling, never imported at runtime, so this is its own small copy.
// 'theme'/'verdict'/'lens'/'term' and 'date'/'when' (timeline items with no title of their own,
// e.g. S10.1/execute.history, S9.13/reason.trigger) are last-resort headlines, tried only after
// the strong identity fields — better than falling all the way through to a bare "Item N".
const HEADLINE_KEYS = ['title', 'name', 'label', 'product', 'theme', 'verdict', 'lens', 'term', 'date', 'when'];
// 'meta' joins this list (RENDERED_UI_FORENSIC_AUDIT.md §3/§13): confirmed real descriptive text
// on destination cards ("12 exit SKUs · $27K at cost · 3 recovery cards") and guard rows ("none
// yet · guard is not armed") — previously fell through to a plain "Meta: ..." extra-field line
// despite being exactly the kind of prose this list already exists to recognize.
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
  'meta',
];
const IDENTIFIER_KEYS = ['sku', 'id', 'caseId', 'ref'];
const STATE_KEYS = ['status', 'state'];
const SEVERITY_KEYS = ['severity'];

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
    if (usedKeys.has(key) || isHiddenKey(key) || !Array.isArray(value) || value.length === 0) continue;
    const entries = value.map(flattenNestedEntry).filter(Boolean);
    if (entries.length > 0) lists.push([key, entries]);
  }
  return lists;
}

/**
 * Every field the headline/detail/identifier/state/severity picks and the nested-list scan above
 * didn't already consume — a second metric, a formatted figure, a status badge's own display
 * value, or (the gap this fixes) a nested plain object (e.g. S9.6/decide.focus's `before`/`after`,
 * S10.1/analyze.drill's own descriptor) — used to just vanish with no visual trace (see
 * extraction/audit.js's A.3 "classified-but-incomplete" check; this is exactly what broke
 * S9.1/analyze's `rows`, where `role`/`vel`/`cm`/`turns`/`gmroi`/`cpw` all disappeared, leaving
 * only a bare product name). Rendered as a compact "extra fields" line rather than dropped. Arrays
 * are skipped here — an empty one has nothing to show, and a non-empty one is already covered by
 * findNestedLists above; a nested *object* has no such existing coverage, so it goes through
 * flattenNestedEntry here instead of being silently excluded.
 *
 * `isHiddenKey` (decorative-by-name OR internal-by-`__`-convention, see decorativeKeys.js's own
 * doc comment) is what keeps extraction's own `__raw` companion — a row's real numbers behind a
 * formatted display string, never meant to be shown — from reaching this exact "extra fields" text.
 * Previously this only checked `isDecorativeKey`, so `__raw` fell straight through and rendered as
 * a garbled "Raw: Name: Hero, N: 14, X: 78, ..." line on every item that carried one.
 */
function findExtraFields(item, usedKeys) {
  const fields = [];
  for (const [key, value] of Object.entries(item)) {
    if (usedKeys.has(key) || isHiddenKey(key)) continue;
    if (value === null || value === undefined || Array.isArray(value)) continue;
    const text = flattenNestedEntry(value);
    if (!text) continue;
    fields.push([key, text]);
  }
  return fields;
}

function Item({ item, index }) {
  if (item === null || typeof item !== 'object') {
    return (
      <li {...typeRole('small', 'rounded-xl border border-rf-border-subtle px-3 py-2 text-rf-text-primary')}>
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
    <li className="relative overflow-hidden rounded-xl border border-rf-border-subtle bg-rf-surface-raised py-2 pl-4 pr-3">
      {tone && <span className={`absolute inset-y-0 left-0 w-1 ${tone.dot}`} />}
      <div className="flex items-center justify-between gap-2">
        <p {...cellText('identifier', headline, typeRole('small', 'text-rf-text-primary').className)}>{headline}</p>
        {state !== undefined && (
          <span {...typeRole('label', 'flex-shrink-0 rounded-full bg-rf-surface-sunken px-2 py-0.5 text-rf-text-secondary')}>
            {String(state)}
          </span>
        )}
      </div>
      {detail && <p {...cellText('prose', detail, typeRole('small', 'mt-0.5 text-rf-text-secondary').className)}>{detail}</p>}
      {identifier !== undefined && (
        <p {...typeRole('micro', 'mt-0.5 text-rf-text-tertiary')}>{String(identifier)}</p>
      )}
      {extraFields.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {extraFields.map(([key, text]) => {
            // Colored from the field's OWN sign/wording (deltaTone) — the same signal every other
            // block now shares, not a per-block guess. See deltaTone.js's doc comment.
            const tone = deltaTone(text);
            return (
              <span key={key} {...typeRole('micro', 'text-rf-text-secondary')}>
                <span className="text-rf-text-tertiary">{humanizeSlotName(key)}:</span>{' '}
                <span className={tone ? tone.text : undefined}>{text}</span>
              </span>
            );
          })}
        </div>
      )}
      {nestedLists.map(([key, entries]) => (
        <div key={key} className="mt-1.5 border-t border-rf-border-subtle pt-1.5">
          <p {...typeRole('label', 'text-rf-text-tertiary')}>
            {humanizeSlotName(key)}
          </p>
          <ul className="mt-0.5 flex flex-col gap-0.5">
            {entries.map((entry, i) => (
              <li key={i} {...typeRole('small', 'text-rf-text-secondary')}>
                {entry}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </li>
  );
}

// A DECORATIVE-value color token (`var(--mod-discover)`, `#3b82f6`, ...) on an otherwise-plain item
// is a real, meaningful signal even though it isn't "content" — it's the same per-item color
// coding a chart/legend uses elsewhere for this exact data (e.g. S9.1/analyze.roles' `hue`, which
// colors that same role's scatter-plot cluster). Used only for SimpleChipList's dot below; never
// promoted into a text field anywhere else.
const COLOR_KEY_CANDIDATES = ['hue', 'tint', 'bg', 'fill', 'dotBg'];
const CSS_COLOR_RE = /^(var\(--|#[0-9a-f]{3,8}$|rgba?\(|hsla?\()/i;

function colorOf(item) {
  for (const key of COLOR_KEY_CANDIDATES) {
    const v = item?.[key];
    if (typeof v === 'string' && CSS_COLOR_RE.test(v.trim())) return v;
  }
  return null;
}

// Mirrors layout/blockSizing.js's own `itemTextWeight` (same definition, independently copied —
// see this file's HEADLINE_KEYS comment for the convention: a block component never imports the
// layout layer, it stays a self-contained, dumb presentational unit). Nested arrays/objects are
// deliberately excluded from the weight — a rich `stats`/nested sub-list already reads fine inside
// a half-width card; it's the FLAT fields that determine whether a card is short enough to sit
// two-up.
function itemWeight(item) {
  if (item === null || typeof item !== 'object') return String(item ?? '').length;
  let total = 0;
  for (const [key, value] of Object.entries(item)) {
    if (isHiddenKey(key) || value === null || value === undefined) continue;
    if (typeof value === 'string') total += value.length;
    else if (typeof value === 'number' || typeof value === 'boolean') total += 4;
  }
  return total;
}

/**
 * True when every item is short enough (headline + a field or two, or a compact nested stats
 * list) that two full `<Item>` cards side by side still read comfortably — option-picker-shaped
 * content (e.g. S9.9/analyze's `candidates`: a name, a recovery figure, a rec flag, a compact
 * 4-value stats list) rather than a long narrative per row. Same weight threshold `blockSizing.js`
 * uses to decide this block's own outer panel span, applied one level down to its own items —
 * density-driven, never keyed on item count alone (RENDERED_UI_FORENSIC_AUDIT.md successor task's
 * "itemQueue/option-card sizing" requirement).
 */
function isCompactCard(data) {
  if (data.length < 2) return false;
  const avg = data.reduce((sum, item) => sum + itemWeight(item), 0) / data.length;
  return avg <= 80;
}

/**
 * True when an item carries nothing but a headline (every other concept this component knows how
 * to surface — detail/identifier/state/severity/nested lists/extra fields — is absent). A list
 * where EVERY item is this simple (e.g. S9.1/analyze.roles: `{name, hue}, only a legend label and
 * a color) reads far better as a dense, wrapped row of compact chips than as N full-width bordered
 * `<li>` rows stacked vertically — the exact "six large stacked pills" density complaint this
 * checks for. A list with even one richer item (a detail line, a status pill, ...) keeps the
 * existing per-row treatment unchanged, since collapsing THAT down to a bare chip would drop real
 * content, not just tighten layout.
 */
function isUniformlySimple(data) {
  return data.every((item) => {
    if (item === null || typeof item !== 'object') return true; // a bare scalar item is "simple" too
    const headlineKey = pickKey(item, HEADLINE_KEYS);
    const usedKeys = new Set([headlineKey].filter(Boolean));
    return (
      !pickKey(item, DETAIL_KEYS) &&
      !pickKey(item, IDENTIFIER_KEYS) &&
      !pickKey(item, STATE_KEYS) &&
      !pickKey(item, SEVERITY_KEYS) &&
      findNestedLists(item, usedKeys).length === 0 &&
      findExtraFields(item, usedKeys).length === 0
    );
  });
}

function SimpleChipList({ data }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {data.map((item, i) => {
        const color = colorOf(item);
        const label = flattenDisplayValue(item?.[pickKey(item ?? {}, HEADLINE_KEYS)] ?? item) || `Item ${i + 1}`;
        return (
          <span
            key={i}
            {...typeRole('small', 'inline-flex items-center gap-1.5 rounded-full border border-rf-border-subtle bg-rf-surface-canvas px-2.5 py-1 text-rf-text-primary')}
          >
            {color && <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: color }} />}
            {label}
          </span>
        );
      })}
    </div>
  );
}

/**
 * @param {boolean} [compact] - see LabelValueListBlock/TextBlock's own doc comments — bare content,
 *   no own card, when already inside a shared panel.
 */
export default function ItemQueueBlock({ slotName, data, compact }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (!Array.isArray(data)) {
    return <ErrorState slotName={slotName} message={`expected a list, got ${typeof data}`} />;
  }
  if (data.length === 0) {
    return <EmptyState slotName={slotName} message="Nothing in the queue." />;
  }

  const body = isUniformlySimple(data) ? (
    <SimpleChipList data={data} />
  ) : (
    <ul className={isCompactCard(data) ? 'grid grid-cols-1 gap-1.5 sm:grid-cols-2' : 'flex flex-col gap-1.5'}>
      {data.map((item, i) => (
        <Item key={i} item={item} index={i} />
      ))}
    </ul>
  );

  if (compact) {
    return (
      <div className="py-1.5">
        <CompactEyebrow>
          {slotLabel(slotName)} · {data.length}
        </CompactEyebrow>
        {body}
      </div>
    );
  }

  return (
    <BlockCard>
      <BlockTitle className="mb-2">
        {slotLabel(slotName)} · {data.length}
      </BlockTitle>
      {body}
    </BlockCard>
  );
}
