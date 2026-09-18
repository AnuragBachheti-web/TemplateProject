// THE ONE MODULE where a semantic word becomes a design token.
//
// Renamed from severityTone.js in Phase 3B (ruling R26). It already owned severity; Phase 2's
// guardrail check statuses needed the same treatment, and a second module for the same concept —
// split by which enum happened to arrive first — is how a duplicate colour map starts. I3 asks for
// ONE place, so this is it, and blockVocabulary.test.jsx's T32 asserts no other module in blocks/
// maps a status word to an `rf-status-*` token.
//
// The payload never carries a colour. `guardrails.checks[].status` is the semantic word `pass` /
// `warn` / `fail` / `blocked` / `info`; what that looks like is decided here and applied by the
// component. That is the whole trade Phase 2's boundary test enforces.

/**
 * One literal Tailwind class set per severity word, spent on an accent dot/bar — the same
 * approach ActionsQueueList.jsx uses for its crit/act/opp/watch tones, and for the same reason:
 * `bg-${word}-500` is a template string, and Tailwind only picks up classes it can see written out
 * literally at build time.
 *
 * Part 2's manifest report found the vocabulary's own crit/act/opp/watch enum is never actually
 * used by any of these 105 fixtures — instead S10.3/S10.5/S9.19 use "medium"/"high"/"low"/
 * "critical"/"blocking". Both vocabularies are mapped here so a real severity from either scheme
 * gets a real color; anything unrecognized falls back to the neutral "watch" tone rather than
 * guessing.
 *
 * Uses the design system's own `rf-status-*` tokens (`tokens.css`), not hardcoded Tailwind
 * palette literals — previously this was the one place in the codebase with a second, parallel,
 * non-token-based status-color system (`bg-rose-500` etc.) sitting alongside the real one every
 * other status/severity indicator in the app is meant to share (AUDIT_REPORT.md §17). `watch`, the
 * neutral/default tone, has no dedicated status token (nothing is "wrong" about it) — it reads
 * from the same border/text-tertiary tokens every other neutral UI element already uses.
 */
const SEVERITY_TONE = {
  crit: { dot: 'bg-rf-status-critical', text: 'text-rf-status-critical' },
  critical: { dot: 'bg-rf-status-critical', text: 'text-rf-status-critical' },
  blocking: { dot: 'bg-rf-status-critical', text: 'text-rf-status-critical' },
  high: { dot: 'bg-rf-status-critical', text: 'text-rf-status-critical' },
  act: { dot: 'bg-rf-status-warning', text: 'text-rf-status-warning' },
  medium: { dot: 'bg-rf-status-warning', text: 'text-rf-status-warning' },
  opp: { dot: 'bg-rf-status-success', text: 'text-rf-status-success' },
  low: { dot: 'bg-rf-status-success', text: 'text-rf-status-success' },
  watch: { dot: 'bg-rf-border-strong', text: 'text-rf-text-tertiary' },
};

const DEFAULT_TONE = SEVERITY_TONE.watch;

export function severityTone(value) {
  if (typeof value !== 'string') return DEFAULT_TONE;
  return SEVERITY_TONE[value.toLowerCase()] || DEFAULT_TONE;
}

/**
 * PER-ROW GUARDRAIL CHECK STATUS -> tone. The enum is contract/decisionObject.js's
 * GUARDRAIL_CHECK_STATUSES, derived in Phase 3A from the reference's own `ok` boolean first and its
 * icon/tone families second — read at extraction time and discarded, so only the word crosses.
 *
 * `blocked` is deliberately not `fail`: the reference distinguishes a check that CANNOT proceed (a
 * legal hold, a contract lock) from one that ran and did not pass, and an operator's next step
 * differs. It reads as critical because a blocked check stops the decision, but it carries its own
 * word so the distinction survives into the UI.
 *
 * `info` is the neutral fallback and the answer for an unrecognised status — never `pass`. Claiming
 * a check passed on no evidence is the one wrong answer here, and it is the same fail-closed
 * reasoning contract/deriveEligibility.js applies to the verdict itself.
 */
const CHECK_STATUS_TONE = {
  pass: { dot: 'bg-rf-status-success', text: 'text-rf-status-success', label: 'Pass' },
  warn: { dot: 'bg-rf-status-warning', text: 'text-rf-status-warning', label: 'Warning' },
  fail: { dot: 'bg-rf-status-critical', text: 'text-rf-status-critical', label: 'Fail' },
  blocked: { dot: 'bg-rf-status-critical', text: 'text-rf-status-critical', label: 'Blocked' },
  info: { dot: 'bg-rf-border-strong', text: 'text-rf-text-tertiary', label: 'Info' },
}

/**
 * @param {string} status - a GUARDRAIL_CHECK_STATUSES member.
 * @returns {{dot: string, text: string, label: string}} always a real tone; `info` when unrecognised.
 */
export function checkStatusTone(status) {
  return CHECK_STATUS_TONE[status] ?? CHECK_STATUS_TONE.info
}

/**
 * A MEASURED VALUE AGAINST ITS OWN LIMIT — over, or within.
 *
 * MOVED HERE IN PHASE 5B (ruling R73), from inside GaugeBlock, and the move is a correctness fix
 * rather than tidying. "Over its limit" is a semantic word, and GaugeBlock was turning it into
 * `rf-status-critical` / `rf-status-success` with two inline ternaries — a semantic word becoming a
 * token outside this module, which is exactly what I3 forbids and what T32 exists to catch. It was
 * already shipping; T32 did not see it because it looks for PALETTE literals, and these were
 * correctly-named design tokens sitting in the wrong file.
 *
 * `over` is critical because a value past its own ceiling is what stops a decision. Within-limit is
 * deliberately NOT `success`-coloured on the figure — a figure inside its bounds is unremarkable,
 * and colouring every compliant number green makes the one that is not compliant harder to find.
 * Only the bar carries the positive tone, because a bar is a magnitude and needs a fill.
 *
 * @param {boolean} isOver
 * @returns {{text: string, fill: string, label: string}}
 */
const LIMIT_TONE = {
  over: { text: 'text-rf-status-critical', fill: 'bg-rf-status-critical', label: 'Over limit' },
  within: { text: 'text-rf-text-primary', fill: 'bg-rf-status-success', label: 'Within limit' },
}

export function limitTone(isOver) {
  return isOver ? LIMIT_TONE.over : LIMIT_TONE.within
}
