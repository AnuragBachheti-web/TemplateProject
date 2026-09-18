import { humanizeSlotName } from './humanizeSlotName';
import { BlockCard, BlockTitle } from './BlockCard';
import { EmptyState, ErrorState } from './BlockStates';
import { HERO_SLOT_NAMES, HERO_MIN_LENGTH } from '../layout/heroSlot';
import { enumLabel } from './enumLabel';

/**
 * @param {boolean} [compact] - true when this block is grouped with sibling scalars inside a
 *   shared panel (see StageSections.jsx) — renders as a bare label/value row instead of its own
 *   bordered card, so a run of short values reads as one compact strip, not a wall of cards
 *   (AUDIT_REPORT.md's own "scalar-card wall" finding, and this task's #16/#28).
 * @param {string} [role] - a manifest-declared semantic role (see classifyBlocks.js's
 *   `planSections`/`role` field) — `"hero"` always gets the rich "Realify signal" treatment below,
 *   regardless of slotName. `layout/heroSlot.js`'s HERO_SLOT_NAMES vocabulary is the fallback for a
 *   manifest generated before `role` existed (or hand-authored without it) — either signal alone is
 *   sufficient; this is never an AND. `"heroSub"` is a headline's own paired subheadline — a plain,
 *   quieter paragraph directly under it, never its own eyebrow/card (two stacked "Realify signal"
 *   labels for one story beat would be noise, not hierarchy). A scalar block with neither signal
 *   (the common case) ignores both and falls through to its own ordinary compact/card rendering.
 */
export default function TextBlock({ slotName, data, title, compact, role }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (typeof data !== 'string') {
    return <ErrorState slotName={slotName} message={`expected text, got ${typeof data}`} />;
  }
  if (data.trim() === '') {
    return <EmptyState slotName={slotName} message="Empty." />;
  }

  // A contract enum is a machine token, and the frontend owns what an operator reads — the same
  // split formatValue.js owns for numbers. Every other slot's text passes through untouched.
  const text = enumLabel(slotName, data);

  if (role === 'heroSub') {
    return <p className="text-[13.5px] leading-snug text-rf-text-secondary">{text}</p>;
  }

  // A manifest-declared `role: "hero"` is a semantic judgment made once, at generation time,
  // already knowing this is the stage's own headline — it's authoritative on its own, never
  // second-guessed by a length check (RENDERED_UI_FORENSIC_AUDIT.md §3.8: a 40-character primary
  // insight is still the most important sentence on its screen, whatever its character count).
  // `HERO_MIN_LENGTH` stays as a safety net ONLY for the slotName-vocabulary fallback path — a
  // bare name match with no explicit `role` behind it is a weaker signal, worth guarding against a
  // short, coincidentally-named value getting hero treatment it doesn't deserve.
  const isHero = role === 'hero' || (HERO_SLOT_NAMES.has(slotName) && text.length >= HERO_MIN_LENGTH);
  if (isHero) {
    const eyebrow = (
      <p className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-rf-text-tertiary">
        <span aria-hidden="true" className="h-[6px] w-[6px] rounded-full bg-rf-brand-blue-500" />
        Realify signal · {title ?? humanizeSlotName(slotName)}
      </p>
    );
    const headline = (
      <p className="mt-2 font-serif text-[19px] font-normal leading-snug text-rf-text-primary" style={{ fontVariationSettings: "'opsz' 144" }}>
        {text}
      </p>
    );
    // `compact` means this hero block is already inside a shared panel (a GridPanel cell — grouped
    // with a quieter companion like Display Mode — or a ComposedPanel member): the eyebrow + big
    // serif text carry the visual weight on their own; a second border/background/shadow around it
    // would be a card nested inside the panel that's already providing one (exactly the "card wall"
    // pattern this composition system exists to avoid — see StageSections.jsx's own doc comment).
    if (compact) {
      return (
        <div className="py-1">
          {eyebrow}
          {headline}
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-rf-border-subtle border-l-[3px] border-l-rf-brand-blue-500 bg-rf-surface-canvas px-5 py-4 shadow-xs">
        {eyebrow}
        {headline}
      </div>
    );
  }

  if (compact) {
    // RENDERED_UI_FORENSIC_AUDIT.md §3.3/§3.4: `shrink-0` on the value span refused to let it
    // shrink — the exact precondition `truncate` needs to ever fire — so a long value simply
    // overflowed the rail column instead of ellipsizing. All of the resulting shrink pressure then
    // fell on the label alone, over-truncating it too. Both spans now genuinely participate in
    // flex sizing: the label gets a bounded `max-w-[45%]` (enough for a real humanized slot name,
    // never the whole row) and the value gets the rest via `flex-1`, each independently
    // `min-w-0 truncate` so either one — a long label OR a long value — ellipsizes on its own
    // side without pushing the other off the row or past the container's own edge.
    return (
      <div className="flex min-w-0 items-baseline gap-3 py-[7px]">
        <span className="min-w-0 max-w-[45%] shrink truncate text-[12px] text-rf-text-secondary">{title ?? humanizeSlotName(slotName)}</span>
        <span className="min-w-0 flex-1 truncate text-right text-[12.5px] font-medium text-rf-text-primary">{text}</span>
      </div>
    );
  }

  return (
    <BlockCard padding="compact">
      <BlockTitle>{title ?? humanizeSlotName(slotName)}</BlockTitle>
      <p className="mt-1 text-[14px] font-medium text-rf-text-primary">{text}</p>
    </BlockCard>
  );
}
