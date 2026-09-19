// THE ONE MODULE where a semantic word becomes a design token.
//
// Renamed from severityTone.js in Phase 3B (ruling R26). It already owned severity; Phase 2's
// guardrail check statuses needed the same treatment, and a second module for the same concept —
// split by which enum happened to arrive first — is how a duplicate colour map starts. I3 asks for
// ONE place, so this is it, and blockVocabulary.test.jsx's T32 asserts no other module in blocks/
// maps a status word to an `rf-status-*` token.
//
// PHASE 5E PART 2 (R83): every `text:` here is now the -700 TEXT step. The -500 steps fail the
// design system's own contrast matrix as text on white (green 3.1:1, amber 2.3:1) and the DS marks
// them "large only". The `dot:` values are unchanged — a dot is an icon, and pairing the accent
// with one is exactly what the DS asks for.
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
  crit: { dot: 'bg-rf-status-critical', text: 'text-rf-status-critical-text' },
  critical: { dot: 'bg-rf-status-critical', text: 'text-rf-status-critical-text' },
  blocking: { dot: 'bg-rf-status-critical', text: 'text-rf-status-critical-text' },
  high: { dot: 'bg-rf-status-critical', text: 'text-rf-status-critical-text' },
  act: { dot: 'bg-rf-status-warning', text: 'text-rf-status-warning-text' },
  medium: { dot: 'bg-rf-status-warning', text: 'text-rf-status-warning-text' },
  opp: { dot: 'bg-rf-status-success', text: 'text-rf-status-success-text' },
  low: { dot: 'bg-rf-status-success', text: 'text-rf-status-success-text' },
  watch: { dot: 'bg-rf-border-strong', text: 'text-rf-text-tertiary' },
};

import { surfaceTier } from './surfaceTier';

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
  pass: { dot: 'bg-rf-status-success', text: 'text-rf-status-success-text', label: 'Pass' },
  warn: { dot: 'bg-rf-status-warning', text: 'text-rf-status-warning-text', label: 'Warning' },
  fail: { dot: 'bg-rf-status-critical', text: 'text-rf-status-critical-text', label: 'Fail' },
  blocked: { dot: 'bg-rf-status-critical', text: 'text-rf-status-critical-text', label: 'Blocked' },
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
 * A MEASURED VALUE AGAINST ITS OWN LIMIT — and why it gets NO directional colour.
 *
 * MOVED HERE IN PHASE 5B (ruling R73) from inside GaugeBlock, which was turning "over its limit"
 * into `rf-status-critical` / `rf-status-success` with two inline ternaries — a semantic word
 * becoming a token outside this module, which I3 forbids. T32 never saw it because T32 looks for
 * raw PALETTE literals and these were correctly-named design tokens in the wrong file.
 *
 * AND THEN THE SCREENSHOT SHOWED THE DECISION ITSELF WAS WRONG. S9.18/decide renders "On-time · DTC
 * 95.6%" in critical red, because its bar (70) sits past its limit tick (63) — and its note reads
 * "floor 95%", so 95.6% is comfortably GOOD. Being over a floor is success; being over a ceiling is
 * failure; and that object carries two of each:
 *
 *     On-time · DTC        95.6%   pct 70  limitPct 63   note "floor 95% · scale 90-98%"
 *     Split rate            8.2%   pct 59  limitPct 57   note "ceiling 8% · scale 0-14%"
 *     Damage per thousand   2.1    pct 60  limitPct 71   note "ceiling 2.5 · scale 0-3.5"
 *     Meridian share        56%    pct 64  limitPct 60   note "minimum 55% · scale 40-65%"
 *
 * THE DIRECTION EXISTS ONLY IN THE PROSE. There is no `direction` field, no `kind`, nothing typed —
 * just the words floor / ceiling / minimum / cap inside `note`. Reading it out would be a
 * classifier on prose, inside a component, deciding which way is good news: the same move ruling
 * R72 declined for `tag`, `flag`, `badge`, `kind` and `optimal`, and the same move R2 forbids for
 * recovering numbers from display strings.
 *
 * So the gauge renders the bar, the tick and the note, and lets the operator read them. The
 * position is information the payload genuinely carries; the verdict is not. A red bar that is
 * wrong half the time is worse than a neutral one — this is a surface people approve from.
 *
 * The function stays, with no argument, because the DECISION still belongs here rather than in a
 * block: on the day a payload states its limit direction, this is the one place that changes.
 *
 * @returns {{text: string, fill: string, label: string}}
 */
export function limitTone() {
  return { text: 'text-rf-text-primary', fill: 'bg-rf-border-strong', label: 'Against its limit' }
}

/**
 * A BOOLEAN FLAG -> tone. Yes reads as affirmed, no as neutral.
 *
 * FOUND BY THIS PHASE'S OWN T86, not by inspection, and it is the second instance of exactly the
 * defect R73 moved out of GaugeBlock: FlagBlock was turning `true` into
 * `bg-rf-status-success/10 text-rf-status-success` with an inline ternary. Both survived Phase 3B's
 * T32 for the same reason — that test looks for raw PALETTE literals, and these were correctly
 * named design tokens sitting in the wrong file. A rule enforced only against the sloppy version of
 * a mistake does not catch the tidy version.
 *
 * `false` is NOT critical. A flag that is off is a fact, not a failure; colouring it red would make
 * the block editorialise about data it only reports.
 */
const FLAG_TONE = {
  yes: { chip: 'bg-rf-status-success/10 text-rf-status-success-text', label: 'Yes' },
  no: { chip: `${surfaceTier('nested').className} text-rf-text-tertiary`, label: 'No' },
}

export function flagTone(isTrue) {
  return isTrue ? FLAG_TONE.yes : FLAG_TONE.no
}

/**
 * A GUARDRAIL VERDICT'S TONE (Phase 8, defect 7).
 *
 * `guardrails.verdict` is a real four-value enum and it rendered as plain text — the single most
 * consequential fact on a decide pane, stated in the same grey as everything around it. It is a
 * closed vocabulary, so reading it is a lookup and not a classifier, which is the whole difference
 * between this and the three fields ruling R118 refused.
 *
 * `not_applicable` GETS NOTHING, deliberately, and it covers 93 of the 105 objects. A verdict of
 * "this does not apply" is not good news or bad news, and colouring it would put a tone on almost
 * every pane in the app to say nothing at all. This lands visibly on 12 objects — small, and
 * honest about being small.
 *
 * Anything outside the enum returns null. The corpus carries free text in this field on a handful
 * of objects ("Scale + transfer", "Hold"), and guessing at those would be exactly the prose
 * classifier R72 declined and R88 deleted.
 *
 * @param {unknown} verdict
 * @returns {{dot: string, text: string} | null}
 */
export function verdictTone(verdict) {
  if (typeof verdict !== 'string') return null;
  switch (verdict.trim().toLowerCase()) {
    case 'within_limits':
      return { dot: 'bg-rf-status-success-icon', text: 'text-rf-status-success-text' };
    case 'beyond_limits':
      return { dot: 'bg-rf-status-critical-icon', text: 'text-rf-status-critical-text' };
    default:
      return null;
  }
}
