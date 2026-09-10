// A function component is just a function returning a React element (a plain object tree) —
// calling it directly and inspecting `.type` needs no DOM, so these run under vitest's plain
// 'node' environment with no new dependencies (no jsdom, no @testing-library/react).
import { describe, it, expect } from 'vitest';

import TextBlock from './TextBlock';
import NumberBlock from './NumberBlock';
import FlagBlock from './FlagBlock';
import LabelValueListBlock from './LabelValueListBlock';
import TableBlock from './TableBlock';
import ItemQueueBlock from './ItemQueueBlock';
import SeriesBlock from './SeriesBlock';
import ObjectBlock from './ObjectBlock';
import SliderBlock from './SliderBlock';
import { findNearestStep } from './sliderSteps';
import { EmptyState, ErrorState } from './BlockStates';

const CASES = [
  { Component: TextBlock, empty: '', wrongType: 42, valid: 'hello' },
  { Component: NumberBlock, empty: undefined, wrongType: 'nope', valid: 42 },
  { Component: FlagBlock, empty: undefined, wrongType: 'nope', valid: true },
  { Component: LabelValueListBlock, empty: [], wrongType: 'nope', valid: [{ label: 'a', value: 1 }] },
  { Component: TableBlock, empty: [], wrongType: 'nope', valid: [{ name: 'A', sku: 'X-1', qty: 3 }] },
  { Component: ItemQueueBlock, empty: [], wrongType: 'nope', valid: [{ title: 'a' }] },
  { Component: SeriesBlock, empty: [], wrongType: 42, valid: [1, 2, 3] },
  { Component: ObjectBlock, empty: {}, wrongType: [1, 2], valid: { title: 'a' } },
];

describe.each(CASES)('$Component.name empty/error states', ({ Component, empty, wrongType, valid }) => {
  it('renders EmptyState for null', () => {
    expect(Component({ slotName: 'x', data: null }).type).toBe(EmptyState);
  });

  it('renders EmptyState for a valid-but-empty value', () => {
    expect(Component({ slotName: 'x', data: empty }).type).toBe(EmptyState);
  });

  it('renders ErrorState for the wrong type', () => {
    expect(Component({ slotName: 'x', data: wrongType }).type).toBe(ErrorState);
  });

  it('renders real content (neither EmptyState nor ErrorState) for valid data', () => {
    const el = Component({ slotName: 'x', data: valid });
    expect(el.type).not.toBe(EmptyState);
    expect(el.type).not.toBe(ErrorState);
  });
});

// SliderBlock isn't in the shared matrix above: a {min, max, value} object doesn't have a
// meaningful "valid but empty" state the way an array or a string does, so its own rules
// (missing fields, min >= max, value out of range) get their own tests instead.
describe('SliderBlock', () => {
  const valid = { min: 1, max: 8, value: 4 };

  it('renders EmptyState for null/undefined', () => {
    expect(SliderBlock({ slotName: 'x', data: null }).type).toBe(EmptyState);
    expect(SliderBlock({ slotName: 'x', data: undefined }).type).toBe(EmptyState);
  });

  it('renders ErrorState when min/max/value are missing or the wrong type', () => {
    expect(SliderBlock({ slotName: 'x', data: 'nope' }).type).toBe(ErrorState);
    expect(SliderBlock({ slotName: 'x', data: { min: 1, max: 8 } }).type).toBe(ErrorState);
    expect(SliderBlock({ slotName: 'x', data: { min: '1', max: 8, value: 4 } }).type).toBe(ErrorState);
  });

  it('renders real content for a valid range', () => {
    const el = SliderBlock({ slotName: 'x', data: valid });
    expect(el.type).not.toBe(EmptyState);
    expect(el.type).not.toBe(ErrorState);
  });

  it('is a plain function with no hooks — callable directly, like every other block', () => {
    // If this ever needed useState internally, calling it bare (no React renderer) would throw.
    expect(() => SliderBlock({ slotName: 'x', data: valid })).not.toThrow();
  });
});

describe('findNearestStep', () => {
  const steps = [
    { at: 1, skusSelected: '12 of 41', confidence: '94%' },
    { at: 4, skusSelected: '41 of 41', confidence: '82%' },
    { at: 8, skusSelected: '41 of 41', confidence: '61%' },
  ];

  it('returns null for missing or empty steps', () => {
    expect(findNearestStep(undefined, 4)).toBeNull();
    expect(findNearestStep([], 4)).toBeNull();
  });

  it('finds an exact match', () => {
    expect(findNearestStep(steps, 4)).toEqual(steps[1]);
  });

  it('finds the closest step for a value between two steps', () => {
    expect(findNearestStep(steps, 2)).toEqual(steps[0]); // closer to 1 than to 4
    expect(findNearestStep(steps, 6.5)).toEqual(steps[2]); // closer to 8 than to 4
  });

  it('ignores malformed entries rather than throwing', () => {
    const messy = [{ at: 1, ok: true }, 'not an object', { no_at: true }, { at: 5, ok: true }];
    expect(findNearestStep(messy, 5)).toEqual({ at: 5, ok: true });
  });
});
