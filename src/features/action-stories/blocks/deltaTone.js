// Derives a semantic tone ("this value is a rise" / "this value is a fall") from the value's OWN
// LEADING SIGN — never from an explicit color field the data happens to carry, and (since Phase 5E
// Part 2) never from its wording. This is the one signal guaranteed to still exist once the mock fixtures
// (data/raw/*.json) are replaced by a real API: ItemQueueBlock's colorOf() and ObjectBlock's
// STYLE_VALUE_RE only fire today because these mock fixtures occasionally embed a literal
// hue/tint/bg/CSS-color string — a real backend has no reason to send that, but it will keep
// sending signed numbers and formatted deltas ("+12%", "−$2,210", "Increased 8% WoW") the same way
// every mockup already does. See INTEGRATION.md §4 for the wider "don't trust a mock field's shape
// to survive the real API" caution this follows.
//
// Deliberately conservative: a BARE positive number/string ("42", "$26.3K") gets no color — only an
// explicit sign (a leading +/-/−) or a genuinely negative number counts as a real signal. Coloring
// every positive number green would just be noise (a quantity, an id, a score are not "good news").
//
// ============================================================================================
// THE DIRECTION-WORD BRANCHES ARE GONE (Phase 5E Part 2, ruling R88)
// ============================================================================================
//
// This used to also match plain-English direction words on the reasoning that "Increased 8% WoW"
// carries the same signal as "+8%". It does not, because a regex cannot tell that sentence from a
// product name. Swept across every rendered table cell in the corpus, 275 cells took a tone: 245
// from a leading sign, and 30 from the word branches. ALL THIRTY WERE WRONG:
//
//     "Ridgeline mug top-up -> FBA-East"                       GREEN  — a product name
//     "Drop"                                                   RED    — a toggle's label, x5
//     "Max volume loss"                                        RED    — a row's label
//     "The base of the range. Buffer sized to P75 demand..."   GREEN  — an 81-character sentence
//     "Defect rate 640 PPM above the Tier 3 ceiling and
//      rising for six quarters."                               GREEN  — the OPPOSITE of the truth
//
// That last one is the argument in one row: a defect rate climbing past its ceiling, painted as
// good news. Same defect class as the one ruling R72 declined to build for tag/flag/badge and R73
// called a correctness fix in limitTone — a classifier reading prose and deciding what is good
// news. Deleting the branches costs nothing real: a leading sign only ever occurs on a figure, so
// all 245 legitimate tones survive untouched.
//
// AND THE SIGN RULE IS NOW GATED ON THE FIGURE ROLE (R88). Colour and typography answer to one
// definition of what a figure is (figureShape.js), so they cannot drift apart — the same move that
// fixed this phase's Part 1, where a rule about columns asked the data instead of the renderer.
//
// This also does NOT decide business polarity (e.g. "is a rising cost good or bad?") — it only
// answers "did this value's own sign/wording point up or down". A metric whose real-world meaning
// inverts that (a cost, a defect rate, a late-shipment rate) needs its own domain-aware polarity
// decided where that meaning is actually known (the manifest/mapping layer once a real field exists)
// — not guessed here from a raw sign.
//
// Uses the same rf-status-* design tokens as severityTone.js/chartPalette.js — one status-color
// system for the whole app, never a second hardcoded (rose/emerald/...) palette invented per block.
import { isFigureText } from './figureShape';

// `text` is the -700 step and `dot` the -500: text must clear AA on white, a dot is an icon and the
// DS asks for exactly that pairing. Ruling R83.
const POSITIVE_TONE = { text: 'text-rf-status-success-text', dot: 'bg-rf-status-success', color: 'var(--rf-status-success)' };
const NEGATIVE_TONE = { text: 'text-rf-status-critical-text', dot: 'bg-rf-status-critical', color: 'var(--rf-status-critical)' };

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

  // R88's gate. A tone is a property of a FIGURE; a sentence that happens to open with a dash is
  // prose, and prose gets no colour here. The role that decides is the same one the typography
  // uses, by construction.
  if (!isFigureText(value)) return null;

  const sign = explicitSign(value);
  if (sign === 1) return POSITIVE_TONE;
  if (sign === -1) return NEGATIVE_TONE;

  return null;
}
