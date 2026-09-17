// Split out from Badge.jsx: a component file may only export components (react-refresh/
// only-export-components), the same reason severityTone.js lives beside, not inside, FlagBlock.jsx.

/**
 * Maps the same severity vocabulary severityTone.js already normalizes (both the crit/act/opp/watch
 * enum and the medium/high/low/critical/blocking words the real fixtures actually use — see that
 * file's own doc comment) onto a Badge tone, so a raw severity string from manifest data becomes a
 * correctly-colored Badge with no call site needing to know both vocabularies itself.
 * @param {string} value
 * @returns {'critical'|'warning'|'success'|'neutral'}
 */
export function badgeToneFromSeverity(value) {
  if (typeof value !== 'string') return 'neutral';
  const v = value.toLowerCase();
  if (['crit', 'critical', 'blocking', 'high'].includes(v)) return 'critical';
  if (['act', 'medium'].includes(v)) return 'warning';
  if (['opp', 'low'].includes(v)) return 'success';
  return 'neutral';
}
