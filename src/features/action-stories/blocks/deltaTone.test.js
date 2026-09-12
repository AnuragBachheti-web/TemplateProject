import { describe, it, expect } from 'vitest';
import { deltaTone } from './deltaTone';

describe('deltaTone — colors a value from its own sign/wording only, never a color field', () => {
  it('reads an explicit "+" prefix as positive', () => {
    expect(deltaTone('+12%')).toEqual({
      text: 'text-rf-status-success',
      dot: 'bg-rf-status-success',
      color: 'var(--rf-status-success)',
    });
  });

  it('reads an explicit "-" or unicode "−" prefix as negative', () => {
    expect(deltaTone('-$2,210')).toEqual({
      text: 'text-rf-status-critical',
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

  it('falls back to plain-English direction words when there is no leading sign', () => {
    expect(deltaTone('Increased 12% week over week')?.text).toBe('text-rf-status-success');
    expect(deltaTone('Sales rose sharply')?.text).toBe('text-rf-status-success');
    expect(deltaTone('Conversion decreased this month')?.text).toBe('text-rf-status-critical');
    expect(deltaTone('Traffic fell 8%')?.text).toBe('text-rf-status-critical');
  });

  it('never matches an unrelated word that merely contains a direction word as a substring', () => {
    expect(deltaTone('Acme Inc. renewed its contract')).toBeNull(); // not "inc"
    expect(deltaTone('Startup costs were flat')).toBeNull(); // not "up"
  });

  it('returns null for anything with no directional signal at all', () => {
    expect(deltaTone(null)).toBeNull();
    expect(deltaTone(undefined)).toBeNull();
    expect(deltaTone('')).toBeNull();
    expect(deltaTone('Assortment')).toBeNull();
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
