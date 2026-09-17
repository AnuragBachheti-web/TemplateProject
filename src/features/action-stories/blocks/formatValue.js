// Display formatting for a typed business number — the frontend half of the contract change that
// replaces the corpus's 3,009 pre-formatted display strings ("$7.90", "88%", "−1.24").
//
// The backend sends `{ value: 18400, unit: 'USD' }`. Every character of what an operator reads —
// the symbol, the separators, the decimal places, whether 18400 compacts to "$18.4K" — is decided
// here. That split is the whole point: a backend that sends "$18,400" has silently made a
// locale, a precision and a currency decision on the frontend's behalf, and none of them can be
// changed without a backend deploy.
//
// Intl.NumberFormat does the actual work — it ships in every browser this app supports and handles
// locale, currency symbols and compaction correctly. This module is only the small amount of policy
// on top of it: which notation to use at which magnitude, and what an absent value renders as.
//
// Deliberately NOT a general formatting framework. It handles the six units the contract declares
// (decisionObject.js's VALUE_UNITS) and nothing else.

const COMPACT_THRESHOLD = 10_000 // below this, full digits read better than "9.4K"

/**
 * U+2212 MINUS SIGN, not the ASCII hyphen Intl emits. The reference writes "−$1,840" with a real
 * minus; a hyphen is a different glyph at a different width and breaks the tabular-nums alignment
 * every figure in this app is set in.
 */
const MINUS = '\u2212'

/** `signed: true` means the direction is part of the fact, so a gain must show its plus. */
function signOptions(signed) {
  return signed === true ? { signDisplay: 'exceptZero' } : {}
}

/**
 * @param {{value: number, unit: string, precision?: number}|number|string|null|undefined} typed
 *   A typed business number. A bare number is accepted and treated as a unitless count. A STRING is
 *   accepted and returned unchanged — the corpus still carries pre-formatted strings, and this
 *   helper is introduced alongside them rather than in place of them, so a block can call it
 *   unconditionally during the migration without needing to know which form it got.
 * @param {{ locale?: string, compact?: boolean }} [options]
 * @returns {string} the display string, or an em dash when there is genuinely nothing to show.
 */
export function formatValue(typed, { locale = 'en-US', compact } = {}) {
  if (typed === null || typed === undefined) return '—'
  // Already-formatted legacy value: pass through untouched rather than guess at parsing it back.
  if (typeof typed === 'string') return typed
  if (typeof typed === 'number') return formatNumber(typed, { locale, compact })

  if (typeof typed !== 'object') return '—'
  const { value, unit, precision, signed } = typed
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  const opts = { locale, compact, precision, signed }

  switch (unit) {
    case 'USD':
    case 'EUR':
    case 'GBP':
      return formatCurrency(value, unit, opts)
    case 'pct':
      // Precision 0 by default, NOT 1. "78.0%" claims a tenth of a point of precision the reference
      // never stated; a caller that genuinely has tenths asks for them with `precision`.
      return `${formatNumber(value, { ...opts, compact: false, precision: precision ?? 0 })}%`
    case 'days':
      return `${formatNumber(value, { ...opts, compact: false, precision: precision ?? 0 })} ${Math.abs(value) === 1 ? 'day' : 'days'}`
    case 'count':
      // A COUNT IS NEVER COMPACTED. 18,402 SKUs compacted to "18.4K" loses 402 of them, and a count
      // is the one unit where every digit is a real thing being counted. Money compacts because
      // nobody acts on the last $47 of $92,547; nobody rounds a SKU.
      return formatNumber(value, { ...opts, compact: false })
    default:
      return formatNumber(value, opts)
  }
}

function formatCurrency(value, currency, { locale, compact, precision, signed }) {
  const useCompact = compact ?? Math.abs(value) >= COMPACT_THRESHOLD
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: useCompact ? 'compact' : 'standard',
    // A compact currency figure with two decimals ("$18.40K") reads worse than "$18.4K", so compact
    // keeps one. Standard allows up to two and FORCES none: $9,400 had been rendering as "$9,400.00"
    // because minimumFractionDigits was pinned at 2, which shows an operator two zeros of precision
    // that no price in the corpus actually carries. Real cents ($0.62) still survive, because the
    // maximum is what admits them and the minimum is what was inventing them.
    maximumFractionDigits: precision ?? (useCompact ? 1 : 2),
    minimumFractionDigits: precision ?? 0,
    ...signOptions(signed),
  }).format(value).replace('-', MINUS)
}

function formatNumber(value, { locale, compact, precision, signed }) {
  const useCompact = compact ?? Math.abs(value) >= COMPACT_THRESHOLD
  return new Intl.NumberFormat(locale, {
    notation: useCompact ? 'compact' : 'standard',
    maximumFractionDigits: precision ?? (useCompact ? 1 : 2),
    ...(precision !== undefined ? { minimumFractionDigits: precision } : {}),
    ...signOptions(signed),
  }).format(value).replace('-', MINUS)
}

/**
 * True for a value already in the typed `{value, unit}` shape — lets a block tell a real typed
 * number from a legacy display string without importing the contract's validator (this module is
 * presentation and must not depend on the contract layer).
 */
export function isTypedNumber(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v.value === 'number' && typeof v.unit === 'string'
}
