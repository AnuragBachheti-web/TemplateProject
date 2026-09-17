import { describe, it, expect } from 'vitest';
import { badgeToneFromSeverity } from './badgeTone';

describe('badgeToneFromSeverity', () => {
  it('maps both the crit/act/opp/watch enum and the medium/high/low/critical/blocking words', () => {
    expect(badgeToneFromSeverity('crit')).toBe('critical');
    expect(badgeToneFromSeverity('critical')).toBe('critical');
    expect(badgeToneFromSeverity('blocking')).toBe('critical');
    expect(badgeToneFromSeverity('high')).toBe('critical');
    expect(badgeToneFromSeverity('act')).toBe('warning');
    expect(badgeToneFromSeverity('medium')).toBe('warning');
    expect(badgeToneFromSeverity('opp')).toBe('success');
    expect(badgeToneFromSeverity('low')).toBe('success');
    expect(badgeToneFromSeverity('watch')).toBe('neutral');
  });

  it('falls back to neutral for anything unrecognized or non-string', () => {
    expect(badgeToneFromSeverity('mystery')).toBe('neutral');
    expect(badgeToneFromSeverity(undefined)).toBe('neutral');
    expect(badgeToneFromSeverity(42)).toBe('neutral');
  });
});
