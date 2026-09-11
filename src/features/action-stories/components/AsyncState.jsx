/**
 * Shared page-level loading/error presentation — previously every fetching page/component
 * (`StagePage`, `ActionStoriesHome`, `Shell`) had its own bare "Loading…" string and its own raw
 * `{error.message}` interpolation (AUDIT_REPORT.md §14: "a bare generic loading/error presentation",
 * §16: no `aria-*` anywhere). One shared pair, used everywhere data is fetched, so a future
 * visual/accessibility improvement lands in one place instead of three.
 */
export function LoadingState({ label = 'Loading…', compact = false }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={compact ? 'px-4 py-3 text-[12px] text-rf-text-tertiary' : 'flex flex-col gap-2 p-6 text-[13px] text-rf-text-secondary'}
    >
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-3 w-3 animate-spin rounded-full border-2 border-rf-border-strong border-t-rf-brand-blue-500"
        />
        {label}
      </span>
    </div>
  );
}

/**
 * `error` is an ActionStoriesError (see services/actionStoriesErrors.js) — only its `.userMessage`
 * is ever rendered; `.message`/`.cause` stay in the console for developers. `onRetry`, when given,
 * shows a real retry button (only meaningful for a `retryable` failure — a NOT_FOUND retrying
 * changes nothing, so no button is shown for it).
 */
export function AsyncErrorState({ error, onRetry, compact = false }) {
  const message = error?.userMessage || 'Something went wrong. Please try again.';
  const canRetry = Boolean(onRetry) && error?.retryable;

  return (
    <div
      role="alert"
      className={
        compact
          ? 'px-4 py-3 text-[12px] text-rose-600 dark:text-rose-400'
          : 'flex flex-col items-start gap-3 p-6 text-[13px] text-rose-600 dark:text-rose-400'
      }
    >
      <span>{message}</span>
      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:bg-transparent dark:text-rose-400 dark:hover:bg-rose-500/10"
        >
          Try again
        </button>
      )}
    </div>
  );
}
