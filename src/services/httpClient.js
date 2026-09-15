// The real HTTP client INTEGRATION.md §3 names as the target of the eventual service-layer swap
// (`import httpClient from '@/services/httpClient'`) — built now, ahead of that swap, so the swap
// itself stays the one-file, low-risk change the architecture promises. Built on `axios`, already a
// pinned dependency that had zero imports anywhere in this codebase until now (AUDIT_REPORT.md §2 /
// §24 P3 #19).
//
// Now genuinely in use: services/decisionApi.js routes every Decision Object call through this
// client whenever `VITE_API_BASE_URL` is configured, and through an in-memory test double when it
// is not. This module was built and tested long before that endpoint existed and needed no changes
// to be adopted — only the addition of `post` below, whose retry policy differs from `get`'s for
// reasons that matter (see its own doc comment).

import axios from 'axios';
import { ActionStoriesError, ERROR_CODES, classifyHttpStatus, isTransient } from './actionStoriesErrors';

const DEFAULT_TIMEOUT_MS = 10_000;

const instance = axios.create({
  timeout: DEFAULT_TIMEOUT_MS,
});

function classifyAxiosError(error) {
  if (axios.isCancel?.(error) || error.code === 'ERR_CANCELED') {
    return new ActionStoriesError('Request cancelled', { code: ERROR_CODES.ABORTED, cause: error });
  }
  if (error.code === 'ECONNABORTED' || error.message === 'Network Error' || !error.response) {
    // No response reached the client at all: DNS failure, offline, connection refused, or axios'
    // own client-side timeout (ECONNABORTED) — all genuinely indistinguishable from "the network
    // itself failed," so all three get the same NETWORK/TIMEOUT-ish treatment. axios' timeout
    // specifically sets ECONNABORTED; everything else without a response is a network failure.
    const code = error.code === 'ECONNABORTED' ? ERROR_CODES.TIMEOUT : ERROR_CODES.NETWORK;
    return new ActionStoriesError(error.message || 'Network request failed', { code, cause: error });
  }
  const status = error.response.status;
  const code = classifyHttpStatus(status);
  return new ActionStoriesError(`Request failed with status ${status}`, { code, status, cause: error });
}

/**
 * A single retry, only for a transient failure (network blip, timeout, 5xx) — never for a 4xx
 * (retrying a malformed/forbidden/not-found request just repeats the same failure) and never more
 * than once (an unbounded retry loop is its own outage risk). A fixed short backoff, not
 * exponential — one retry of a genuinely transient failure rarely needs more than a beat.
 */
async function withRetryOnce(fn) {
  try {
    return await fn();
  } catch (err) {
    const classified = err instanceof ActionStoriesError ? err : classifyAxiosError(err);
    if (!isTransient(classified.code)) throw classified;
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      return await fn();
    } catch (retryErr) {
      throw retryErr instanceof ActionStoriesError ? retryErr : classifyAxiosError(retryErr);
    }
  }
}

/**
 * @param {string} url
 * @param {{ signal?: AbortSignal, timeout?: number }} [options]
 * @returns {Promise<{ data: any, status: number }>}
 */
async function get(url, { signal, timeout } = {}) {
  return withRetryOnce(async () => {
    try {
      const response = await instance.get(url, { signal, timeout: timeout ?? DEFAULT_TIMEOUT_MS });
      if (response.data === null || response.data === undefined) {
        throw new ActionStoriesError(`Empty response body from ${url}`, { code: ERROR_CODES.MALFORMED });
      }
      return response;
    } catch (err) {
      throw err instanceof ActionStoriesError ? err : classifyAxiosError(err);
    }
  });
}

/**
 * POST — for MUTATIONS, so the retry policy is deliberately different from `get`'s.
 *
 * A GET may be retried freely because it changes nothing. A POST may not: retrying an approval that
 * actually succeeded but whose response was lost would approve twice. This method therefore retries
 * ONLY when the caller supplies an `Idempotency-Key`, which is what makes a replay safe — the
 * server recognises the key and returns the original result instead of performing the action again.
 * Without a key, a transient failure surfaces to the caller untouched and the operator decides.
 *
 * @param {string} url
 * @param {any} body
 * @param {{ signal?: AbortSignal, timeout?: number, idempotencyKey?: string }} [options]
 * @returns {Promise<{ data: any, status: number }>}
 */
async function post(url, body, { signal, timeout, idempotencyKey } = {}) {
  const config = {
    signal,
    timeout: timeout ?? DEFAULT_TIMEOUT_MS,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  };

  const send = async () => {
    try {
      const response = await instance.post(url, body, config);
      if (response.data === null || response.data === undefined) {
        throw new ActionStoriesError(`Empty response body from ${url}`, { code: ERROR_CODES.MALFORMED });
      }
      return response;
    } catch (err) {
      throw err instanceof ActionStoriesError ? err : classifyAxiosError(err);
    }
  };

  return idempotencyKey ? withRetryOnce(send) : send();
}

export default { get, post };
