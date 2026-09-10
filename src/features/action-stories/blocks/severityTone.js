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
 */
const SEVERITY_TONE = {
  crit: { dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' },
  critical: { dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' },
  blocking: { dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' },
  high: { dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' },
  act: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  medium: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  opp: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  low: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  watch: { dot: 'bg-slate-300 dark:bg-slate-600', text: 'text-slate-600 dark:text-slate-400' },
};

const DEFAULT_TONE = SEVERITY_TONE.watch;

export function severityTone(value) {
  if (typeof value !== 'string') return DEFAULT_TONE;
  return SEVERITY_TONE[value.toLowerCase()] || DEFAULT_TONE;
}
