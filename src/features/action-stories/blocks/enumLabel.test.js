import { describe, it, expect } from 'vitest';
import { enumLabel } from './enumLabel';

describe('enumLabel — contract tokens become operator copy', () => {
  it('maps every axis slot the templates render', () => {
    expect(enumLabel('decision_mode', 'assist')).toBe('Assist');
    expect(enumLabel('decision_lens', 'ads')).toBe('Ads');
    expect(enumLabel('decision_persona', 'merchandiser')).toBe('Merchandiser');
    expect(enumLabel('decision_contract_class', 'regulated')).toBe('Regulated');
    expect(enumLabel('guardrail_verdict', 'within_limits')).toBe('Within limits');
  });

  it('leaves free-text slots completely untouched', () => {
    const prose = 'Keep 162 · grow 18 · reduce 22 · exit 12';
    expect(enumLabel('recommendation', prose)).toBe(prose);
    expect(enumLabel('narrative', 'not_applicable')).toBe('not_applicable');
  });

  it('passes an unknown token through rather than blanking it', () => {
    // A contract value this map has not learned yet must read as itself, never as empty.
    expect(enumLabel('decision_lens', 'logistics')).toBe('logistics');
  });

  it('is total — a non-string never throws', () => {
    expect(enumLabel('decision_mode', undefined)).toBeUndefined();
    expect(enumLabel('decision_mode', 42)).toBe(42);
  });
});
