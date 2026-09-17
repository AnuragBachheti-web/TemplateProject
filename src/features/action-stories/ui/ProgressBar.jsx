// A plain track+fill meter — distinct from GaugeBlock.jsx, which is a manifest-bound BLOCK for a
// magnitude measured against a threshold (a value/limit pair, with a tick mark for the limit).
// This is the simpler, threshold-less case the reference reuses constantly (Analyze's "62% of
// candidates classified", Execute's push/deploy/dispatch progress rows) — a bare completion
// percentage, no limit to mark. Lives in ui/ rather than blocks/ deliberately: nothing in
// extraction/classifyBlocks.js recognizes a "plain percentage" shape yet, so this is a primitive
// ready for a block (or a rail row) to call directly, not itself a dispatched block type.
const TONE = {
  brand: 'bg-rf-brand-blue-500',
  success: 'bg-rf-status-success',
  warning: 'bg-rf-status-warning',
  critical: 'bg-rf-status-critical',
};

/**
 * @param {number} value - current amount, in the same unit as `max`.
 * @param {number} [max]
 * @param {string} [label]
 * @param {boolean} [showValue] - renders "N%" right-aligned above the track.
 * @param {'brand'|'success'|'warning'|'critical'} [tone]
 */
export default function ProgressBar({ value, max = 100, label, showValue = true, tone = 'brand', className = '' }) {
  const safeMax = max > 0 ? max : 100;
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));

  return (
    <div className={`w-full ${className}`}>
      {(label || showValue) && (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[11.5px]">
          {label && <span className="min-w-0 truncate text-rf-text-secondary">{label}</span>}
          {showValue && (
            <span className="shrink-0 font-mono font-semibold tabular-nums text-rf-text-primary">{Math.round(pct)}%</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || undefined}
        className="h-1.5 w-full overflow-hidden rounded-full bg-rf-surface-sunken"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${TONE[tone] ?? TONE.brand}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
