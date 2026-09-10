function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Turns a resolved field into short displayable text.
 *
 * A handful of fixtures (S9.1, S9.2, S9.4's analyze stages) store a table column as the actual
 * React.createElement(...) call the mockup's own code made — extraction/dcLogicSandbox.js's React
 * stub captured that as a plain `{ type, props: { children, ... } }` descriptor rather than
 * dropping it, so this pulls the real text back out of it instead of showing "[object Object]".
 */
export function flattenDisplayValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(flattenDisplayValue).filter(Boolean).join(' ');
  if (isPlainObject(value) && 'type' in value && isPlainObject(value.props)) {
    return flattenDisplayValue(value.props.children);
  }
  return '';
}
