import { useActionStoriesStore } from '@/store/useActionStoriesStore';

/**
 * The Confirm/Approve/Start button on a decide/execute stage. Now backed by a real mutation
 * lifecycle (click -> loading -> success/failure -> persisted) via useActionStoriesStore's
 * `confirmStage` — see services/actionStoriesMutations.js for exactly what "real" means here
 * today (no live backend exists yet; genuinely persisted, genuinely async, genuinely failable,
 * ready to point at a real endpoint later) versus AUDIT_REPORT.md §13's previous finding
 * ("UI exists. It does not perform any business operation").
 *
 * Navigation (the sidebar, StepTracker) stays entirely separate from this — clicking Approve never
 * navigates anywhere, and navigating away never affects an in-flight or completed confirmation.
 */
export default function StageActionBar({ code, stageKey, ctaLabel }) {
  const isConfirmed = useActionStoriesStore((s) => s.isStageConfirmed(code, stageKey));
  const isPending = useActionStoriesStore((s) => s.isStagePending(code, stageKey));
  const error = useActionStoriesStore((s) => s.getStageError(code, stageKey));
  const confirmStage = useActionStoriesStore((s) => s.confirmStage);

  // Eligibility: only a decide/execute stage carries a real business action at all — a
  // reason/analyze/live stage has nothing to approve. (No per-user permission system exists in
  // this scaffold — there is no auth anywhere in the app — so this is the one eligibility rule
  // that can honestly be enforced today; a real permission check is a genuine backend/auth
  // dependency this component cannot fabricate.)
  if (stageKey !== 'decide' && stageKey !== 'execute') return null;

  const label = ctaLabel || (stageKey === 'decide' ? 'Approve' : 'Start');

  return (
    <div className="mx-auto flex w-full max-w-page items-center gap-3 border-t border-rf-border-subtle bg-rf-surface-canvas px-6 py-3.5">
      {isConfirmed && (
        <span role="status" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-rf-status-success">
          <i className="fa-solid fa-circle-check text-[11px]" aria-hidden="true" />
          Confirmed
        </span>
      )}
      {error && !isConfirmed && (
        <span
          role="alert"
          className="inline-flex items-center gap-2 rounded-full bg-rf-status-critical/10 px-3 py-1 text-[11.5px] font-medium text-rf-status-critical"
        >
          <i className="fa-solid fa-triangle-exclamation text-[10px]" aria-hidden="true" />
          {error.userMessage}
        </span>
      )}
      <button
        type="button"
        disabled={isConfirmed || isPending}
        aria-busy={isPending}
        onClick={() => confirmStage(code, stageKey)}
        className={`ml-auto inline-flex h-10 items-center gap-2 rounded-lg px-[18px] text-[13.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring ${
          isConfirmed
            ? 'cursor-default bg-rf-surface-sunken text-rf-text-tertiary'
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
        {isConfirmed ? 'Done' : isPending ? 'Confirming…' : error ? `Retry ${label}` : label}
        {!isConfirmed && !isPending && <i className="fa-solid fa-arrow-right text-[11px]" aria-hidden="true" />}
      </button>
    </div>
  );
}
