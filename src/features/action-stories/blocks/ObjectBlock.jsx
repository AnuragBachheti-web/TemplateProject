import { humanizeSlotName } from './humanizeSlotName';
import { flattenNestedEntry } from './nestedEntryText';
import { BlockCard, BlockTitle } from './BlockCard';
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

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Turns any value into displayable text for one dt/dd row. A bare style-string value (a color, a
 * CSS keyword) is deliberately excluded here — ObjectBlock is *correct* to show nothing for it,
 * same as any other block treats a decorative-only field — everything else, including a nested
 * plain object or array at any depth, is handed to flattenNestedEntry (shared with
 * LabelValueListBlock/ItemQueueBlock — see its own doc comment for exactly what it recovers and
 * the previous one-level limit this replaces; extraction/audit.js's A.3 "classified-but-incomplete"
 * check is what originally found this gap).
 */
function renderEntryValue(v) {
  if (isStyleString(v)) return '';
  return flattenNestedEntry(v);
}

/** @param {boolean} [compact] - see TextBlock.jsx's own doc comment for what this means and why. */
export default function ObjectBlock({ slotName, data, compact }) {
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

  const rows = (
    <dl className="flex flex-col gap-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-3 text-[12.5px]">
          <dt className="text-rf-text-secondary">{humanizeSlotName(key)}</dt>
          <dd className="truncate font-medium text-rf-text-primary">{value}</dd>
        </div>
      ))}
    </dl>
  );

  if (compact) {
    return (
      <div className="py-1.5">
        <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-rf-text-tertiary">{humanizeSlotName(slotName)}</p>
        {rows}
      </div>
    );
  }

  return (
    <BlockCard>
      <BlockTitle className="mb-2">{humanizeSlotName(slotName)}</BlockTitle>
      {rows}
    </BlockCard>
  );
}
