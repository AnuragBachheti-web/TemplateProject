import { useEffect, useRef, useState } from 'react';
import { useActionStoriesStore } from '@/store/useActionStoriesStore';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import Alert from '../ui/Alert';

/**
 * The Confirm/Approve/Start button on a decide/execute stage. Backed by a real mutation lifecycle
 * (click -> confirm dialog -> loading -> success/failure -> persisted) via useActionStoriesStore's
 * `confirmStage` — see services/actionStoriesMutations.js for exactly what "real" means here
 * today (no live backend exists yet; genuinely persisted, genuinely async, genuinely failable,
 * ready to point at a real endpoint later) versus AUDIT_REPORT.md §13's previous finding
 * ("UI exists. It does not perform any business operation").
 *
 * The button itself no longer fires the mutation directly — it opens a ConfirmDialog first. This
 * used to be a single click with no way back (an "execute" stage genuinely writes live prices once
 * a real backend exists — INTEGRATION.md §3); gating it behind an explicit second confirmation is
 * Nielsen Norman's own "error prevention" heuristic, not decoration.
 *
 * `canConfirm`/`blockedReason` come from stageActionEligibility.js's own resolution of this stage's
 * real `guardrail_*` data — this is currently the ONE real action this app has (there is no
 * dismiss/snooze/modify/send-back verb anywhere in the mutation layer; none of those have any
 * backing in the real product/API contract available in this repo — see stageActionEligibility.js's
 * own doc comment). A blocked proposal never gets a clickable path to `confirmStage` at all: no
 * dialog opens, no mutation can fire, the reason is shown in its place — "do not expose an
 * executable path" for an action that isn't actually allowed, rather than a button that silently
 * fails or (worse) silently succeeds against the proposal's own stated guardrail.
 *
 * Navigation (the sidebar, StepTracker) stays entirely separate from this — clicking Approve never
 * navigates anywhere, and navigating away never affects an in-flight or completed confirmation.
 */
export default function StageActionBar({ code, stageKey, ctaLabel, canConfirm = true, blockedReason = null }) {
  const isConfirmed = useActionStoriesStore((s) => s.isStageConfirmed(code, stageKey));
  const isPending = useActionStoriesStore((s) => s.isStagePending(code, stageKey));
  const error = useActionStoriesStore((s) => s.getStageError(code, stageKey));
  const confirmStage = useActionStoriesStore((s) => s.confirmStage);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { notify } = useToast();
  const label = ctaLabel || (stageKey === 'decide' ? 'Approve' : 'Start');

  // Closes the dialog AND raises a toast on the falling edge of `isPending` — the exact moment a
  // mutation this dialog was gating just settled (confirmed, or failed) — never merely "no longer
  // pending", which a STALE error from a previous failed attempt would also satisfy. Without
  // tracking the edge, only whether `error` is truthy right now, reopening the dialog for a retry
  // (error still sitting in state from the last failure, nothing pending yet) would close it again
  // on the very next render, and would re-toast the OLD failure a second time.
  //
  // This toast is deliberately IN ADDITION TO, not instead of, the persistent inline
  // Confirmed/error indicator below — a transient notice for the moment (even if the user has
  // scrolled away from this bar), backed by a status that stays visible for as long as it's true.
  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (wasPendingRef.current && !isPending) {
      setDialogOpen(false);
      if (isConfirmed) {
        notify(`${label} confirmed for ${code}.`, { tone: 'success' });
      } else if (error) {
        notify(error.userMessage, { tone: 'critical' });
      }
    }
    wasPendingRef.current = isPending;
  }, [isPending, isConfirmed, error, notify, label, code]);

  // Eligibility: only a decide/execute stage carries a real business action at all — a
  // reason/analyze/live stage has nothing to approve. (No per-user permission system exists in
  // this scaffold — there is no auth anywhere in the app — so this is the one eligibility rule
  // that can honestly be enforced today; a real permission check is a genuine backend/auth
  // dependency this component cannot fabricate.)
  if (stageKey !== 'decide' && stageKey !== 'execute') return null;

  // A blocked proposal never gets a clickable path to the mutation at all — see this component's
  // own doc comment. Moot once actually confirmed (which could only have happened before the
  // proposal's own data turned blocked, if that were ever possible in a live system), so `isConfirmed`
  // always wins over a stale `canConfirm: false`.
  const isBlocked = !canConfirm && !isConfirmed;

  return (
    <div className="mx-auto flex w-full max-w-page items-center gap-3 border-t border-rf-border-subtle bg-rf-surface-canvas px-6 py-3.5">
      {/* Alert.jsx's compact pill — the same shared component every persistent status/warning
          elsewhere should use, not a bespoke inline `role="alert"`/`role="status"` pill re-hand-
          -rolled per call site (this was the very last one of those left). */}
      {isConfirmed && (
        <Alert tone="success" compact>
          Confirmed
        </Alert>
      )}
      {error && !isConfirmed && (
        <Alert tone="critical" compact>
          {error.userMessage}
        </Alert>
      )}
      {isBlocked && !error && (
        <Alert tone="warning" compact>
          {blockedReason || `${label} isn't available for this proposal yet.`}
        </Alert>
      )}
      <button
        type="button"
        disabled={isConfirmed || isPending || isBlocked}
        aria-busy={isPending}
        aria-disabled={isBlocked || undefined}
        onClick={() => {
          if (isBlocked) return;
          setDialogOpen(true);
        }}
        className={`ml-auto inline-flex h-10 items-center gap-2 rounded-lg px-[18px] text-[13.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring ${
          isConfirmed || isBlocked
            ? 'cursor-not-allowed bg-rf-surface-sunken text-rf-text-tertiary'
            : isPending
              ? 'cursor-wait bg-rf-brand-blue-500/70 text-white'
              : 'bg-rf-brand-blue-500 text-white hover:bg-rf-brand-blue-600'
        }`}
      >
        {isPending && (
          <span
            aria-hidden="true"
            className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        {isConfirmed ? 'Done' : isBlocked ? 'Blocked' : isPending ? 'Confirming…' : error ? `Retry ${label}` : label}
        {!isConfirmed && !isPending && !isBlocked && <i className="fa-solid fa-arrow-right text-[11px]" aria-hidden="true" />}
      </button>
      <ConfirmDialog
        open={dialogOpen}
        title={`${label} this stage?`}
        description={`This performs a real action against ${code}'s ${stageKey} stage and can't be undone from here.`}
        confirmLabel={label}
        cancelLabel="Cancel"
        onConfirm={() => confirmStage(code, stageKey)}
        onCancel={() => setDialogOpen(false)}
        loading={isPending}
      />
    </div>
  );
}
