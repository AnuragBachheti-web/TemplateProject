import { describe, it, expect } from 'vitest';
import { deltaTone } from './deltaTone';

describe('deltaTone — colors a FIGURE from its own sign only, never a color field', () => {
  it('reads an explicit "+" prefix as positive', () => {
    expect(deltaTone('+12%')).toEqual({
      text: 'text-rf-status-success-text',
      dot: 'bg-rf-status-success',
      color: 'var(--rf-status-success)',
    });
  });

  it('reads an explicit "-" or unicode "−" prefix as negative', () => {
    expect(deltaTone('-$2,210')).toEqual({
      text: 'text-rf-status-critical-text',
      dot: 'bg-rf-status-critical',
      color: 'var(--rf-status-critical)',
    });
    expect(deltaTone('−7')).toEqual(deltaTone('-7'));
  });

  it('reads a genuinely negative number as negative', () => {
    expect(deltaTone(-450)).toEqual(deltaTone('-450'));
  });

  it('does NOT color a bare positive number or string — only an explicit signal counts', () => {
    expect(deltaTone(42)).toBeNull();
    expect(deltaTone('42')).toBeNull();
    expect(deltaTone('$26.3K')).toBeNull();
    expect(deltaTone('18 / 25')).toBeNull();
  });

  it('READS NO ENGLISH AT ALL — the direction-word branches are gone (Phase 5E Part 2, R88)', () => {
    // REPLACES 'falls back to plain-English direction words when there is no leading sign', which
    // asserted these exact strings took a tone. The premise was that "Increased 12% WoW" carries
    // the same signal as "+12%". It does not, because the regex that finds "increased" in that
    // sentence also finds "up" in a product name.
    //
    // Measured across every rendered table cell in the corpus: 275 cells took a tone, 245 from a
    // leading sign and 30 from these branches, and ALL THIRTY WERE WRONG — a 254-character
    // paragraph green, a toggle labelled "Drop" red five times, "Ridgeline mug top-up → FBA-East"
    // green, and "Defect rate 640 PPM above the Tier 3 ceiling and rising" green, which is the
    // opposite of what it says. See lensAccent.test.jsx's T96c for the corpus strings themselves.
    expect(deltaTone('Increased 12% week over week')).toBeNull();
    expect(deltaTone('Sales rose sharply')).toBeNull();
    expect(deltaTone('Conversion decreased this month')).toBeNull();
    expect(deltaTone('Traffic fell 8%')).toBeNull();
  });

  it('and a sentence is not rescued by a leading sign either (R88\'s figure gate)', () => {
    // The old guard here asked whether a SUBSTRING could false-positive ("Startup" contains "up").
    // With no word matching left, the real question is whether prose can reach the sign branch at
    // all — it cannot, because a tone is now a property of a figure and figureShape.js decides.
    expect(deltaTone('Acme Inc. renewed its contract')).toBeNull();
    expect(deltaTone('Startup costs were flat')).toBeNull();
    expect(deltaTone('− the supplier withdrew the quote and reissued it at a higher index')).toBeNull();
  });

  it('returns null for anything with no directional signal at all', () => {
    expect(deltaTone(null)).toBeNull();
    expect(deltaTone(undefined)).toBeNull();
    expect(deltaTone('')).toBeNull();
    expect(deltaTone('Assortment')).toBeNull();
    expect(deltaTone('18 / 25'), 'a ratio has no direction').toBeNull();
    expect(deltaTone({ hue: '#3b82f6' })).toBeNull(); // an object is never inspected for a color field
  });

  it('only ever returns rf-status-* tokens, never a hardcoded Tailwind palette literal', () => {
    for (const tone of [deltaTone('+1'), deltaTone('-1')]) {
      expect(tone.text).toMatch(/^text-rf-/);
      expect(tone.dot).toMatch(/^bg-rf-/);
      expect(tone.text).not.toMatch(/rose|emerald|amber|green|red/);
    }
  });
});
