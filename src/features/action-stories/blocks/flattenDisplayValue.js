import { formatValue, isTypedNumber } from './formatValue';

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Turns a resolved field into short displayable text.
 *
 * THE ONE LEAF. Every text path in the block vocabulary bottoms out here — TableBlock's cells,
 * ItemQueueBlock's lines, HeatmapGridBlock's tiles, SubRowList's rows, and everything reached
 * through nestedEntryText.js's `flattenNestedEntry`, which calls this for every primitive it meets.
 * That made it the second number formatter in the app by accident: `String(value)` on a number is a
 * formatting decision (no separators, no unit, no sign), made here, invisibly, for nine blocks.
 *
 * Numbers now go to blocks/formatValue.js, which is the only module allowed to decide what a figure
 * looks like. The two cases this closes:
 *
 *   a bare number   18402 printed as "18402", beside a NumberBlock printing the same value as
 *                   "18,402" — the same quantity rendered two ways on one screen.
 *   a TYPED number  {value, unit} fell through every branch below and returned '' — the contract's
 *                   own number shape was INVISIBLE in a table cell. Not a formatting difference;
 *                   the value simply did not appear.
 *
 * A handful of fixtures (S9.1, S9.2, S9.4's analyze stages) store a table column as the actual
 * React.createElement(...) call the mockup's own code made — extraction/dcLogicSandbox.js's React
 * stub captured that as a plain `{ type, props: { children, ... } }` descriptor rather than
 * dropping it, so this pulls the real text back out of it instead of showing "[object Object]".
 */
export function flattenDisplayValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return formatValue(value);
  if (isTypedNumber(value)) return formatValue(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(flattenDisplayValue).filter(Boolean).join(' ');
  if (isPlainObject(value) && 'type' in value && isPlainObject(value.props)) {
    return flattenDisplayValue(value.props.children);
  }
  return '';
}
