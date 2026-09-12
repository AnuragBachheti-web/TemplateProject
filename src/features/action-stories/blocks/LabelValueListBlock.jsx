import { humanizeSlotName } from './humanizeSlotName';
import { flattenNestedEntry } from './nestedEntryText';
import { deltaTone } from './deltaTone';
import { BlockCard, BlockTitle, CompactEyebrow } from './BlockCard';
import { EmptyState, ErrorState } from './BlockStates';
import { isHiddenKey } from './decorativeKeys';

// The keys an explicit, well-known value concept lives under — checked in this priority order
// first, exactly as before. Real fixture data uses many OTHER field names for the same idea
// (`meta`, `n`, `w`, `key`, `numeric`, ...) that can never be enumerated exhaustively — see
// resolvePrimaryValue below for how those are handled generically instead of by growing this list.
const PRIORITY_VALUE_KEYS = ['value', 'note', 'detail', 'amount', 'pct'];

// Past this length, a flattened field reads as real prose (an explanation, a "why"), not a short
// figure — it keeps its own full-width line below the primary row instead of being squeezed inline
// next to it. Below it (a percentage, a count, a short code), it's compact enough to sit inline.
const INLINE_MAX_LENGTH = 18;

/**
 * Decides which of an item's own fields is "the" value for its row. `label` is always the row's
 * own left-hand identity, never a value candidate. The explicit priority keys win when present
 * (unchanged behavior for every fixture already using this vocabulary); otherwise the first
 * remaining non-decorative field is promoted — this is what makes `{label, meta}`, `{label, n, w}`,
 * `{label, key, numeric}` all resolve to a real primary value instead of leaving it blank and
 * demoting every one of those fields to a stacked "extra entry" line (RENDERED_UI_FORENSIC_AUDIT.md
 * §3.2 — confirmed inflating `cols`, `moveBar`, `inputs`, and several rail blocks to 2–3 lines/row).
 * @returns {{ key: string|null, raw: * }}
 */
function resolvePrimaryValue(item) {
  for (const key of PRIORITY_VALUE_KEYS) {
    if (item[key] !== null && item[key] !== undefined) return { key, raw: item[key] };
  }
  const fallbackKey = Object.keys(item).find(
    (k) => k !== 'label' && !isHiddenKey(k) && item[k] !== null && item[k] !== undefined,
  );
  return fallbackKey !== undefined ? { key: fallbackKey, raw: item[fallbackKey] } : { key: null, raw: undefined };
}

/**
 * Every field the row's own label/primary-value pick didn't already consume, split into two
 * buckets: short enough to sit INLINE on the same line as the primary value (a percentage, a
 * count, a short code — `{label, n, w}`'s `w`, `{label, key, numeric}`'s `numeric`), or long enough
 * that it's real prose and keeps its own secondary line (a `why`/`note` explanation) — preserving
 * every field either way, never dropping one, just choosing where it reads best.
 *
 * `isHiddenKey` (not just `isDecorativeKey`) is what excludes extraction's own `__raw` companion —
 * previously missing here, so an item carrying one leaked it as a garbled extra entry (and,
 * via resolvePrimaryValue's own fallback above, could in principle even have been promoted to the
 * row's primary value if it were the only remaining candidate key).
 */
function extraEntries(item, usedKeys) {
  if (item === null || typeof item !== 'object') return { inline: [], long: [] };
  const entries = Object.entries(item)
    .filter(([key, value]) => !usedKeys.has(key) && !isHiddenKey(key) && value !== null && value !== undefined)
    .map(([key, value]) => [key, flattenNestedEntry(value)])
    .filter(([, text]) => text !== '');
  return {
    inline: entries.filter(([, text]) => text.length <= INLINE_MAX_LENGTH),
    long: entries.filter(([, text]) => text.length > INLINE_MAX_LENGTH),
  };
}

/**
 * @param {boolean} [compact] - true when this list is already nested inside a shared panel (e.g.
 *   the Guardrails rail — see StageSections.jsx) — renders without its own outer card border/title
 *   bar, matching the reference's "Policy check" pattern (a bare row list inside one panel), not a
 *   card-inside-a-card.
 */
export default function LabelValueListBlock({ slotName, data, compact }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (!Array.isArray(data)) {
    return <ErrorState slotName={slotName} message={`expected a list, got ${typeof data}`} />;
  }
  if (data.length === 0) {
    return <EmptyState slotName={slotName} message="No rows." />;
  }

  const list = (
    <ul className="flex flex-col divide-y divide-rf-border-subtle">
      {data.map((item, i) => {
        const primary = resolvePrimaryValue(item ?? {});
        const primaryTone = deltaTone(primary.raw);
        const usedKeys = new Set(['label', primary.key].filter((k) => k !== null));
        const { inline, long } = extraEntries(item, usedKeys);
        return (
          <li key={i} className="flex flex-col gap-0.5 py-1.5 text-[12.5px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-rf-text-secondary">{item?.label}</span>
              <span
                className={`flex min-w-0 items-baseline gap-1.5 truncate font-medium ${
                  primaryTone ? primaryTone.text : 'text-rf-text-primary'
                }`}
              >
                {flattenNestedEntry(primary.raw)}
                {inline.map(([key, text]) => {
                  const tone = deltaTone(text);
                  return (
                    <span
                      key={key}
                      className={`shrink-0 text-[10.5px] font-normal ${tone ? tone.text : 'text-rf-text-tertiary'}`}
                    >
                      · {text}
                    </span>
                  );
                })}
              </span>
            </div>
            {long.map(([key, text]) => {
              const tone = deltaTone(text);
              return (
                <div key={key} className="flex items-center justify-between gap-3 text-[10.5px] text-rf-text-tertiary">
                  <span>{humanizeSlotName(key)}</span>
                  <span className={`truncate ${tone ? tone.text : ''}`}>{text}</span>
                </div>
              );
            })}
          </li>
        );
      })}
    </ul>
  );

  if (compact) {
    return (
      <div className="py-1.5">
        <CompactEyebrow>{humanizeSlotName(slotName)}</CompactEyebrow>
        {list}
      </div>
    );
  }

  return (
    <BlockCard>
      <BlockTitle className="mb-2">{humanizeSlotName(slotName)}</BlockTitle>
      {list}
    </BlockCard>
  );
}
