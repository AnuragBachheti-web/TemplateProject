// Shared error taxonomy for every Action Stories data-access failure — the service layer's own
// boundary between "whatever actually went wrong" (a raw fetch/import/parse exception, opaque and
// sometimes leaky) and "what a UI is safe to show a real user." Every function in
// actionStoriesService.js/httpClient.js throws one of these, never a bare Error.
//
// AUDIT_REPORT.md §12/§24 P0 #4: previously every failure mode (offline, 404, malformed JSON, a
// slow chunk load) collapsed into one generic `Error` whose raw `.message` was interpolated
// directly into the page — acceptable for a scaffold, not for production (could leak
// implementation detail, and gives a user no useful distinction between "try again" and "this
// doesn't exist").

/** Every taxonomy code a UI might need to branch on (e.g. to decide whether to show a Retry button). */
export const ERROR_CODES = /** @type {const} */ ({
  NETWORK: 'NETWORK', // offline, DNS failure, connection refused — request never reached a server
  TIMEOUT: 'TIMEOUT', // request took too long and was aborted client-side
  NOT_FOUND: 'NOT_FOUND', // a real 404, or (today) a missing local workflow/stage/manifest/fixture
  CLIENT_ERROR: 'CLIENT_ERROR', // any other 4xx — bad request, forbidden, etc.
  SERVER_ERROR: 'SERVER_ERROR', // 5xx — the backend itself failed
  MALFORMED: 'MALFORMED', // the response arrived but isn't shaped like what this app expects
  ABORTED: 'ABORTED', // the caller cancelled (navigated away, unmounted) — not a real failure
  UNKNOWN: 'UNKNOWN', // anything that doesn't fit the above; still never shows its raw message
});

const DEFAULT_USER_MESSAGES = {
  [ERROR_CODES.NETWORK]: "Couldn't connect. Check your connection and try again.",
  [ERROR_CODES.TIMEOUT]: 'That took too long to load. Please try again.',
  [ERROR_CODES.NOT_FOUND]: "We couldn't find that.",
  [ERROR_CODES.CLIENT_ERROR]: "Something about that request wasn't right.",
  [ERROR_CODES.SERVER_ERROR]: "Something went wrong on our end. We're on it — please try again shortly.",
  [ERROR_CODES.MALFORMED]: 'We got an unexpected response. Please try again.',
  [ERROR_CODES.ABORTED]: 'Cancelled.',
  [ERROR_CODES.UNKNOWN]: 'Something went wrong. Please try again.',
};

/**
 * The one error type every Action Stories data-access call throws. `message` is a developer-facing
 * diagnostic (safe to `console.error`, safe to send to an error-tracking service — never rendered
 * directly in the UI); `userMessage` is the only text a component may show a real user;
 * `retryable` tells a caller whether offering a Retry button makes sense; `cause` keeps the
 * original underlying error/response for deeper debugging without exposing it to the render tree.
 */
export class ActionStoriesError extends Error {
  constructor(message, { code = ERROR_CODES.UNKNOWN, userMessage, retryable, cause, status } = {}) {
    super(message);
    this.name = 'ActionStoriesError';
    this.code = code;
    this.status = status; // HTTP status when known, else undefined
    this.userMessage = userMessage || DEFAULT_USER_MESSAGES[code] || DEFAULT_USER_MESSAGES[ERROR_CODES.UNKNOWN];
    this.retryable = retryable ?? [ERROR_CODES.NETWORK, ERROR_CODES.TIMEOUT, ERROR_CODES.SERVER_ERROR].includes(code);
    this.cause = cause;
  }
}

/** True for a failure worth retrying once automatically (a blip), false for one that won't change on retry. */
export function isTransient(code) {
  return code === ERROR_CODES.NETWORK || code === ERROR_CODES.TIMEOUT || code === ERROR_CODES.SERVER_ERROR;
}

/**
 * Classifies an HTTP status code into a taxonomy code — shared by httpClient.js so a real backend's
 * status codes map to the same buckets a UI already knows how to render.
 */
export function classifyHttpStatus(status) {
  if (status === 404) return ERROR_CODES.NOT_FOUND;
  if (status >= 500) return ERROR_CODES.SERVER_ERROR;
  if (status >= 400) return ERROR_CODES.CLIENT_ERROR;
  return ERROR_CODES.UNKNOWN;
}

/**
 * Wraps any thrown value into an ActionStoriesError, preserving an existing one as-is (so wrapping
 * is idempotent through nested try/catches) and giving every other kind of thrown value (a plain
 * Error, a DOMException from an aborted fetch, a SyntaxError from a bad JSON.parse, literally
 * anything) a safe, generic UNKNOWN classification rather than leaking its raw message.
 */
export function toActionStoriesError(err, fallbackMessage = 'Request failed') {
  if (err instanceof ActionStoriesError) return err;
  if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') {
    return new ActionStoriesError(err?.message || 'Request aborted', { code: ERROR_CODES.ABORTED, cause: err });
  }
  return new ActionStoriesError(err?.message || fallbackMessage, { code: ERROR_CODES.UNKNOWN, cause: err });
}
