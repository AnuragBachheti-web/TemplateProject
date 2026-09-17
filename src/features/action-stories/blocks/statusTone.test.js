import { describe, it, expect } from 'vitest';
import { severityTone } from './statusTone';

describe('severityTone — uses rf-status-* design tokens (regression: was hardcoded Tailwind literals)', () => {
  it('maps every recognized severity word to an rf-status-* or rf-* token class, never a raw palette literal', () => {
    const words = ['crit', 'critical', 'blocking', 'high', 'act', 'medium', 'opp', 'low', 'watch'];
    for (const word of words) {
      const tone = severityTone(word);
      expect(tone.dot).toMatch(/^bg-rf-/);
      expect(tone.text).toMatch(/^text-rf-/);
      // No hardcoded Tailwind palette literal (rose/amber/emerald/slate-N00) should remain.
      expect(tone.dot).not.toMatch(/rose|amber|emerald|slate/);
    }
  });

  it('groups both real-world severity vocabularies onto the same 3 real tones + 1 neutral', () => {
    expect(severityTone('crit')).toEqual(severityTone('critical'));
    expect(severityTone('critical')).toEqual(severityTone('blocking'));
    expect(severityTone('blocking')).toEqual(severityTone('high'));
    expect(severityTone('act')).toEqual(severityTone('medium'));
    expect(severityTone('opp')).toEqual(severityTone('low'));
  });

  it('falls back to the neutral "watch" tone for an unrecognized or non-string value', () => {
    expect(severityTone('something-unknown')).toEqual(severityTone('watch'));
    expect(severityTone(undefined)).toEqual(severityTone('watch'));
    expect(severityTone(42)).toEqual(severityTone('watch'));
  });

  it('is case-insensitive', () => {
    expect(severityTone('CRITICAL')).toEqual(severityTone('critical'));
  });
});
