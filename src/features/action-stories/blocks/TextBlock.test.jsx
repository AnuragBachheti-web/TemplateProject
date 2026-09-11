// Density fix (visual-forensic follow-up): a hero-role block used to always draw its own bordered
// card, even when `compact` (already inside a shared panel — a GridPanel cell, or a ComposedPanel
// member) — producing a card nested inside the panel that's already providing one. Called as a
// plain function, same convention as every other stateless block's tests.
import { describe, it, expect } from 'vitest';
import TextBlock from './TextBlock';
import { BlockCard } from './BlockCard';

function classNames(el, acc = []) {
  if (el === null || el === undefined || typeof el !== 'object') return acc;
  if (Array.isArray(el)) {
    el.forEach((c) => classNames(c, acc));
    return acc;
  }
  if (typeof el.props?.className === 'string') acc.push(el.props.className);
  classNames(el.props?.children, acc);
  return acc;
}

const HERO_TEXT = 'Realify will propose the move set and wait for you. Nothing reaches a channel without your approval.';

describe('TextBlock — hero role respects `compact` (no nested card inside a shared panel)', () => {
  it('draws its own bordered card when a standalone hero block (not compact)', () => {
    const el = TextBlock({ slotName: 'rationale', data: HERO_TEXT, role: 'hero' });
    expect(classNames(el).some((c) => c.includes('border') && c.includes('rounded-2xl'))).toBe(true);
  });

  it('renders bare (no border/background) when the same hero block is compact', () => {
    const el = TextBlock({ slotName: 'rationale', data: HERO_TEXT, role: 'hero', compact: true });
    expect(classNames(el).some((c) => c.includes('border'))).toBe(false);
    expect(classNames(el).some((c) => c.includes('bg-rf-surface-canvas'))).toBe(false);
  });

  it('a manifest-declared role="hero" is sufficient on its own, independent of slotName vocabulary', () => {
    const el = TextBlock({ slotName: 'notInTheVocabList', data: HERO_TEXT, role: 'hero' });
    expect(classNames(el).some((c) => c.includes('rounded-2xl'))).toBe(true);
  });

  it('the slotName vocabulary (heroTitle/rationale/...) still works without an explicit role (backward compatibility)', () => {
    const el = TextBlock({ slotName: 'heroTitle', data: HERO_TEXT });
    expect(classNames(el).some((c) => c.includes('rounded-2xl'))).toBe(true);
  });
});

describe('TextBlock — role="heroSub" (a headline\'s own paired subheadline)', () => {
  it('renders as a plain quiet paragraph, never its own eyebrow or card, compact or not', () => {
    const sub = 'Grow the proven, cut the depth on the tail, exit the floor breaches, range four gaps.';
    const notCompact = TextBlock({ slotName: 'heroSub', data: sub, role: 'heroSub' });
    const compact = TextBlock({ slotName: 'heroSub', data: sub, role: 'heroSub', compact: true });
    for (const el of [notCompact, compact]) {
      expect(classNames(el).some((c) => c.includes('rounded-2xl'))).toBe(false);
      expect(classNames(el).some((c) => c.includes('Realify signal'))).toBe(false);
    }
  });
});

describe('TextBlock — ordinary scalar text (no hero signal) is unaffected', () => {
  it('renders its usual compact bare row, ignoring an absent role', () => {
    const el = TextBlock({ slotName: 'display_mode', data: 'Suggest', compact: true });
    expect(classNames(el).some((c) => c.includes('items-baseline'))).toBe(true); // the bare label/value row
    expect(el.type).not.toBe(BlockCard);
  });

  it('wraps in its own BlockCard when standalone (not compact, no hero signal)', () => {
    // A plain-function call can't see BlockCard's OWN internal className (that only exists once
    // BlockCard itself is actually invoked/rendered) — asserting the element TYPE is BlockCard is
    // the correct, non-invasive way to prove this path still wraps in a real card.
    const card = TextBlock({ slotName: 'display_mode', data: 'Suggest' });
    expect(card.type).toBe(BlockCard);
  });
});

describe('TextBlock — hero eligibility: semantic role first, length only a safety net for the fallback', () => {
  it('role="hero" gets hero treatment even for a short (< HERO_MIN_LENGTH) value', () => {
    const short = 'breakeven M10 · exposure $92.5K of $75K'; // 40 chars — confirmed real case (S9.16/Decide)
    const el = TextBlock({ slotName: 'rationale', data: short, role: 'hero' });
    expect(classNames(el).some((c) => c.includes('rounded-2xl'))).toBe(true);
  });

  it('the slotName-vocabulary fallback (no explicit role) still requires HERO_MIN_LENGTH — a short value gets ordinary treatment', () => {
    const short = 'breakeven M10 · exposure $92.5K of $75K';
    const el = TextBlock({ slotName: 'rationale', data: short });
    expect(classNames(el).some((c) => c.includes('rounded-2xl'))).toBe(false);
  });
});

describe('TextBlock — compact row overflow fix (RENDERED_UI_FORENSIC_AUDIT.md §3.3/§3.4)', () => {
  it('the value span can shrink (no `shrink-0`) so `truncate` actually has something to do', () => {
    const el = TextBlock({ slotName: 'guardrail_cta_label', data: 'Approve 4 moves & continue', compact: true });
    const classes = classNames(el);
    const valueSpanClasses = classes.find((c) => c.includes('flex-1'));
    expect(valueSpanClasses).toBeTruthy();
    expect(valueSpanClasses).not.toContain('shrink-0');
    expect(valueSpanClasses).toContain('truncate');
    expect(valueSpanClasses).toContain('min-w-0');
  });

  it('the label span is bounded (max-w) instead of absorbing unlimited shrink pressure', () => {
    const el = TextBlock({ slotName: 'guardrailCtaLabel', data: 'x', compact: true });
    const classes = classNames(el);
    expect(classes.some((c) => c.includes('max-w-[45%]'))).toBe(true);
  });

  it('renders a real long value (confirmed overflow case) without throwing, still truncatable', () => {
    const longValues = [
      'Showing 5 of 12 · ranked by capital tied up',
      'Decide · 56 SKUs across 4 moves · balanced slate',
      'Available from the Approve dial upward. At Suggest, every quarter comes back through this four-step flow.',
    ];
    for (const data of longValues) {
      expect(() => TextBlock({ slotName: 'x', data, compact: true })).not.toThrow();
    }
  });
});
