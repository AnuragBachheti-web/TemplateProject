/**
 * Turns a slotName ("execution_lane", "pinnedTop", "guardrail_verdict") into a readable label
 * ("Execution Lane", "Pinned Top", "Guardrail Verdict") — no per-slot dictionary to maintain,
 * since most slot names are either the vocabulary's own snake_case or a mockup's own camelCase
 * key, and both split cleanly.
 */
export function humanizeSlotName(slotName) {
  const spaced = String(slotName)
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();

  return spaced
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
