import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ERROR_CODES } from './actionStoriesErrors';

// axios.create() must return an object whose .get we control per-test — hoisted so the mock
// factory below (which vitest hoists above imports) can close over it.
const { mockGet, mockAxios } = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockAxios = {
    create: vi.fn(() => ({ get: mockGet })),
    isCancel: vi.fn(() => false),
  };
  return { mockGet, mockAxios };
});

vi.mock('axios', () => ({ default: mockAxios }));

// Imported after the mock so httpClient.js's own `axios.create()` call at module scope picks up
// the mocked instance.
const { default: httpClient } = await import('./httpClient.js');

describe('httpClient.get — network resilience', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockAxios.isCancel.mockReturnValue(false);
  });

  it('returns the response on a clean success, no retry', async () => {
    mockGet.mockResolvedValueOnce({ data: { ok: true }, status: 200 });
    const res = await httpClient.get('/x');
    expect(res.data).toEqual({ ok: true });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('classifies a 404 as NOT_FOUND and does not retry (retrying a 404 just fails again)', async () => {
    mockGet.mockRejectedValueOnce({ response: { status: 404 } });
    await expect(httpClient.get('/missing')).rejects.toMatchObject({ code: ERROR_CODES.NOT_FOUND, status: 404 });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('classifies any other 4xx as CLIENT_ERROR and does not retry', async () => {
    mockGet.mockRejectedValueOnce({ response: { status: 403 } });
    await expect(httpClient.get('/forbidden')).rejects.toMatchObject({ code: ERROR_CODES.CLIENT_ERROR, status: 403 });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('classifies a 5xx as SERVER_ERROR and retries exactly once', async () => {
    mockGet.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce({ data: { ok: true }, status: 200 });
    const res = await httpClient.get('/flaky');
    expect(res.data).toEqual({ ok: true });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('surfaces a SERVER_ERROR if the single retry also fails, never retrying a third time', async () => {
    mockGet.mockRejectedValue({ response: { status: 503 } });
    await expect(httpClient.get('/down')).rejects.toMatchObject({ code: ERROR_CODES.SERVER_ERROR });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('classifies a response-less error (offline/DNS failure) as NETWORK and retries once', async () => {
    mockGet.mockRejectedValueOnce({ message: 'Network Error' }).mockResolvedValueOnce({ data: {}, status: 200 });
    await httpClient.get('/x');
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('classifies an axios client-side timeout (ECONNABORTED) as TIMEOUT and retries once', async () => {
    mockGet
      .mockRejectedValueOnce({ code: 'ECONNABORTED', message: 'timeout of 10000ms exceeded' })
      .mockResolvedValueOnce({ data: {}, status: 200 });
    await httpClient.get('/slow');
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('treats a null/undefined response body as MALFORMED', async () => {
    mockGet.mockResolvedValueOnce({ data: null, status: 200 });
    await expect(httpClient.get('/empty')).rejects.toMatchObject({ code: ERROR_CODES.MALFORMED });
  });

  it('classifies a cancelled request as ABORTED, never retried', async () => {
    mockAxios.isCancel.mockReturnValue(true);
    mockGet.mockRejectedValueOnce({ code: 'ERR_CANCELED' });
    await expect(httpClient.get('/x')).rejects.toMatchObject({ code: ERROR_CODES.ABORTED });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('never exposes a raw axios error message as userMessage', async () => {
    mockGet.mockRejectedValue({ response: { status: 500, data: 'Internal stack trace leaked here' } });
    try {
      await httpClient.get('/down');
      expect.unreachable();
    } catch (err) {
      expect(err.userMessage).not.toContain('Internal stack trace');
    }
  });
});
