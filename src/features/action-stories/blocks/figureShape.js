// IS THIS STRING A FIGURE? A typography question, and only ever a typography question.
//
// ============================================================================================
// WHY THIS EXISTS, AND THE LINE IT MUST NOT CROSS (ruling R87)
// ============================================================================================
//
// R2 forbids recovering a NUMBER from a display string — parsing "+$41K" into 41000 and computing
// with it. That rule is right and it stands. Recognising that a string IS a figure, so it renders
// in mono with tabular alignment and may carry the colour of its own leading sign, computes
// nothing and asserts no value. R87's test of the difference is whether any ARITHMETIC FOLLOWS.
// Here none does, and none may: this module exports one boolean predicate, it converts nothing, and
// T98 fails the build if a caller puts its result next to a Number()/parseFloat().
//
// WHAT WENT WRONG WITHOUT IT. TableBlock decided figure-vs-prose with
// `Number.isFinite(Number(v))`, which calls "−$4.6K" not a number. So 269 of the 275 coloured cells
// in the corpus were rendering in the PROSE role — this corpus's figures are pre-formatted display
// strings, which is exactly why R2 exists in the first place. Gating tone on that role, as R88
// requires, would have stripped the colour from every real figure in the app. The role had to learn
// to recognise a figure by its SHAPE before it could be trusted to gate anything.
//
// ============================================================================================
// THE SHAPE
// ============================================================================================
//
// A figure is a short string that is mostly quantity: optional sign, digits with the usual
// separators, and a small amount of unit or currency furniture around them. It is NOT a sentence
// that happens to contain a number — "Defect rate 640 PPM above the Tier 3 ceiling" is prose about
// a quantity, and the difference is that prose has words doing work between the numbers.
//
// Two bounds do the whole job, and both are about shape rather than meaning:
//   1. It must contain a digit, and digits must be a real fraction of it. "Drop" is not a figure.
//   2. It must be SHORT and carry few words. A figure is read at a glance; four words in and it is
//      a sentence, whatever it is about.
//
// No word list. No direction words, no units dictionary, no currency table — those would all be
// the same content classifier this project has removed five times, arriving through a new door.

/** Characters that are legitimate furniture around a quantity: sign, separators, unit, currency. */
const FIGURE_CHARS = /^[\s+\-−–—0-9.,%$£€¥/:×x·°()a-zA-Z]*$/

/** The longest a figure may be. "−$2,210 / day" is 13; a sentence is not. */
const MAX_LENGTH = 24

/** The most words a figure may carry. "1,400 u", "640 PPM", "−$2,210 / day". */
const MAX_WORDS = 4

/**
 * Whether a value should RENDER as a figure. Never whether it has a value, never what that value
 * is — see this module's header for why that distinction is the whole point.
 *
 * @param {*} value - anything a row might carry.
 * @returns {boolean} always a boolean, for any input.
 */
export function isFigureText(value) {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'string') return false

  const text = value.trim()
  if (text === '' || text.length > MAX_LENGTH) return false
  if (!/[0-9]/.test(text)) return false
  if (!FIGURE_CHARS.test(text)) return false

  // Letters may only be UNITS — short furniture attached to the quantity ("u", "PPM", "wk", "day",
  // "K"). A long run of letters is a word, and a word means this is prose.
  if (/[a-zA-Z]{5,}/.test(text)) return false

  const words = text.split(/\s+/).filter(Boolean)
  if (words.length > MAX_WORDS) return false

  // Digits must be a real part of it rather than an incidental "Tier 3" or "S9.11".
  const digits = (text.match(/[0-9]/g) ?? []).length
  return digits / text.replace(/\s/g, '').length >= 0.25
}
