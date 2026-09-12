// Derives a semantic tone ("this value is a rise" / "this value is a fall") purely from the
// value's OWN sign or plain-English direction words — never from an explicit color field the data
// happens to carry. This is the one signal guaranteed to still exist once the mock fixtures
// (data/raw/*.json) are replaced by a real API: ItemQueueBlock's colorOf() and ObjectBlock's
// STYLE_VALUE_RE only fire today because these mock fixtures occasionally embed a literal
// hue/tint/bg/CSS-color string — a real backend has no reason to send that, but it will keep
// sending signed numbers and formatted deltas ("+12%", "−$2,210", "Increased 8% WoW") the same way
// every mockup already does. See INTEGRATION.md §4 for the wider "don't trust a mock field's shape
// to survive the real API" caution this follows.
//
// Deliberately conservative: a BARE positive number/string ("42", "$26.3K") gets no color — only
// an explicit sign (a leading +/-/−), a genuinely negative number, or an unambiguous direction word
// ("increased", "decreased", "rose", "fell", ...) counts as a real signal. Coloring every positive
// number green would just be noise (a quantity, an id, a score are not "good news").
//
// This also does NOT decide business polarity (e.g. "is a rising cost good or bad?") — it only
// answers "did this value's own sign/wording point up or down". A metric whose real-world meaning
// inverts that (a cost, a defect rate, a late-shipment rate) needs its own domain-aware polarity
// decided where that meaning is actually known (the manifest/mapping layer once a real field exists)
// — not guessed here from a raw sign.
//
// Uses the same rf-status-* design tokens as severityTone.js/chartPalette.js — one status-color
// system for the whole app, never a second hardcoded (rose/emerald/...) palette invented per block.

const POSITIVE_WORDS = /\b(increase[ds]?|increasing|up|rising|rose|gain(?:ed|s)?|growth|grew|improve[ds]?|improving)\b/i;
const NEGATIVE_WORDS =
  /\b(decrease[ds]?|decreasing|down|falling|fell|drop(?:ped|s)?|declin(?:e|ed|es|ing)|loss(?:es)?|worsen(?:ed|s|ing)?)\b/i;

const POSITIVE_TONE = { text: 'text-rf-status-success', dot: 'bg-rf-status-success', color: 'var(--rf-status-success)' };
const NEGATIVE_TONE = { text: 'text-rf-status-critical', dot: 'bg-rf-status-critical', color: 'var(--rf-status-critical)' };

/**
 * An EXPLICIT sign only — a bare positive number/string returns null, not +1. A leading "+"/"-"/"−"
 * (the unicode minus these fixtures' own formatted strings use — see chartGeometry.js's
 * parseMagnitude) or a genuinely negative number all count; a plain "42" does not.
 * @returns {1 | -1 | null}
 */
function explicitSign(value) {
  if (typeof value === 'number') return value < 0 ? -1 : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.startsWith('+')) return 1;
  if (trimmed.startsWith('-') || trimmed.startsWith('−')) return -1;
  return null;
}

/**
 * @param {*} value - a raw field value (string, number, whatever the fixture/API sent) — never a
 *   pre-formatted color/style string; this looks only at the value's own sign/wording.
 * @returns {{ text: string, dot: string, color: string } | null} a tone, or null when nothing about
 *   the value itself signals a direction (a plain label, an id, an unsigned count, unrelated text).
 */
export function deltaTone(value) {
  if (value === null || value === undefined) return null;

  const sign = explicitSign(value);
  if (sign === 1) return POSITIVE_TONE;
  if (sign === -1) return NEGATIVE_TONE;

  if (typeof value === 'string') {
    if (POSITIVE_WORDS.test(value)) return POSITIVE_TONE;
    if (NEGATIVE_WORDS.test(value)) return NEGATIVE_TONE;
  }

  return null;
}
