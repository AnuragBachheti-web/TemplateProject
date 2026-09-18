import { typeRole } from '../blocks/typeRole';
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
      {...typeRole('body', compact ? 'px-4 py-3 text-rf-text-tertiary' : 'flex flex-col gap-2 p-6 text-rf-text-secondary')}
    >
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-3 w-3 animate-spin rounded-full border-2 border-rf-border-strong border-t-rf-text-tertiary"
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
      {...typeRole('body', compact
        ? 'px-4 py-3 text-rf-status-critical-text'
        : 'flex flex-col items-start gap-3 p-6 text-rf-status-critical-text')}
    >
      <span>{message}</span>
      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          {...typeRole('body', 'rounded-lg border border-rf-status-critical/40 bg-white px-3 py-1.5 text-rf-status-critical-text hover:bg-rf-status-critical/10 dark:border-rf-status-critical/40 dark:bg-transparent dark:text-rf-status-critical-text dark:hover:bg-rf-status-critical/10')}
        >
          Try again
        </button>
      )}
    </div>
  );
}
