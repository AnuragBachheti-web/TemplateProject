// Display labels for the contract's own enum values — the presentation half of the same split
// formatValue.js already owns for numbers.
//
// The contract sends a stable machine token (`assist`, `within_limits`, `adjust_assortment`). The
// FRONTEND decides what an operator reads. Without this, the context rail printed raw tokens —
// "assist", "ads", "keeper", "within_limits" — which is the audit's RB-3: not a broken render, but
// not a product surface either.
//
// Keyed by SLOT NAME, not by value, so a token that means two things in two places can differ, and
// so a free-text slot can never be accidentally title-cased. That is the same convention
// layout/heroSlot.js's HERO_SLOT_NAMES already establishes for TextBlock.
//
// Deliberately NOT i18n. One locale, one map, no framework.

const MODE = {
  suggest: 'Suggest',
  assist: 'Assist',
  auto: 'Auto',
};

const LENS = {
  ads: 'Ads',
  cash: 'Cash',
  inventory: 'Inventory',
  margin: 'Margin',
  sales: 'Sales',
};

const PERSONA = {
  arbiter: 'Arbiter',
  bidder: 'Bidder',
  controller: 'Controller',
  keeper: 'Keeper',
  merchandiser: 'Merchandiser',
  navigator: 'Navigator',
  planner: 'Planner',
  pricer: 'Pricer',
  promoter: 'Promoter',
  prospector: 'Prospector',
  scout: 'Scout',
  shipper: 'Shipper',
  sourcer: 'Sourcer',
  steward: 'Steward',
};

const CONTRACT_CLASS = {
  standard: 'Standard',
  strategic: 'Strategic',
  regulated: 'Regulated',
};

const GUARDRAIL_VERDICT = {
  within_limits: 'Within limits',
  beyond_limits: 'Beyond limits',
  not_applicable: 'Not applicable',
  undetermined: 'Undetermined',
};

/** slotName -> the map its value is displayed through. */
export const ENUM_LABELS = {
  decision_mode: MODE,
  decision_lens: LENS,
  decision_persona: PERSONA,
  decision_contract_class: CONTRACT_CLASS,
  guardrail_verdict: GUARDRAIL_VERDICT,
};

/**
 * @returns {string} the operator-facing label for this slot's value, or the value unchanged when
 *   the slot carries free text or the token is one this map does not know (a new contract value
 *   should read as itself, never as blank).
 */
export function enumLabel(slotName, value) {
  const map = ENUM_LABELS[slotName];
  if (!map || typeof value !== 'string') return value;
  return map[value] ?? value;
}
