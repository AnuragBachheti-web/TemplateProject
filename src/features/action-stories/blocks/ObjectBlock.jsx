import { humanizeSlotName } from './humanizeSlotName';
import { flattenDisplayValue } from './flattenDisplayValue';
import { flattenNestedEntry } from './nestedEntryText';
import { EmptyState, ErrorState } from './BlockStates';

// A style-only string carries no information worth a row of its own — a lone descriptor object
// like `sel` mixes real content (a title, a case id) with the same *Bg/*Tone/*Border siblings the
// mockups use everywhere else, and those aren't filtered out ahead of time here the way a
// classified array's item fields are (see ItemQueueBlock's `pick()`). This is a runtime-local
// copy of the same idea as extraction/classifyBlocks.js's isPureStyleValue — that module is
// generation-only tooling, never imported here.
const STYLE_VALUE_RE = /^(var\(--|#[0-9a-f]{3,8}$|rgba?\(|color-mix\(|linear-gradient\()/i;

function isStyleString(v) {
  return typeof v === 'string' && STYLE_VALUE_RE.test(v);
}

function isRenderablePrimitive(v) {
  return (typeof v === 'string' && !isStyleString(v)) || typeof v === 'number' || typeof v === 'boolean';
}

function isReactDescriptor(v) {
  return v !== null && typeof v === 'object' && 'type' in v && typeof v.props === 'object';
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Turns any value into displayable text for one dt/dd row, instead of ObjectBlock only accepting
 * primitives/JSX-descriptors and dropping everything else (a nested plain object, an array) with
 * no visual trace — see extraction/audit.js's A.3 "classified-but-incomplete" check.
 */
function renderEntryValue(v) {
  if (isRenderablePrimitive(v)) return flattenDisplayValue(v);
  if (isReactDescriptor(v)) return flattenDisplayValue(v);
  if (Array.isArray(v)) {
    // A per-item summary (flattenNestedEntry — the same "label + value" style summarizer
    // ItemQueueBlock's own sub-lists use), not a recursive dump of every field of every item: a
    // 9-bar chart's own pixel-position bookkeeping (x/y/w/h/cx/nx/linkY/...) would otherwise turn
    // one dt/dd row into an unreadable wall of numbers instead of "PRICE $24.00, COGS −$10.56, …".
    return v.map(flattenNestedEntry).filter(Boolean).join(', ');
  }
  if (isPlainObject(v)) {
    // One level of nesting only — a lone descriptor's own descriptor. Anything deeper than this
    // isn't worth guessing a layout for inline.
    const joined = Object.entries(v)
      .map(([k, sub]) => {
        const text = renderEntryValue(sub);
        return text ? `${k}: ${text}` : '';
      })
      .filter(Boolean)
      .join(', ');
    return joined;
  }
  return '';
}

export default function ObjectBlock({ slotName, data }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (!isPlainObject(data)) {
    return <ErrorState slotName={slotName} message={`expected an object, got ${Array.isArray(data) ? 'array' : typeof data}`} />;
  }

  const entries = Object.entries(data)
    .map(([key, v]) => [key, renderEntryValue(v)])
    .filter(([, text]) => text !== '');

  if (entries.length === 0) {
    return <EmptyState slotName={slotName} message="No details." />;
  }

  return (
    <div className="rounded-lg border border-rf-border-subtle bg-rf-surface-canvas p-3">
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-rf-text-tertiary">
        {humanizeSlotName(slotName)}
      </p>
      <dl className="flex flex-col gap-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-3 text-[12.5px]">
            <dt className="text-rf-text-secondary">{humanizeSlotName(key)}</dt>
            <dd className="truncate font-medium text-rf-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
