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
