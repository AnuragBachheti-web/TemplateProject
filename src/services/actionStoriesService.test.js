import { describe, it, expect, vi } from 'vitest';
import { ERROR_CODES } from './actionStoriesErrors';

describe('actionStoriesService — real-data happy path', () => {
  it('getWorkflowIndex returns a real, valid array of workflows', async () => {
    const { getWorkflowIndex } = await import('./actionStoriesService.js');
    const index = await getWorkflowIndex();
    expect(Array.isArray(index)).toBe(true);
    expect(index.length).toBeGreaterThan(0);
    expect(index[0]).toHaveProperty('code');
    expect(index[0]).toHaveProperty('stages');
  });

  it('getStageData returns a real manifest+fixture pair for a known workflow/stage', async () => {
    const { getStageData } = await import('./actionStoriesService.js');
    const { manifest, fixture } = await getStageData('S9.1', 'reason');
    expect(manifest.code).toBe('S9.1');
    expect(manifest.stageKey).toBe('reason');
    expect(Array.isArray(manifest.blocks)).toBe(true);
    expect(fixture).toHaveProperty('data');
  });
});

describe('actionStoriesService — error taxonomy on real failure paths (no mocking needed)', () => {
  it('getStageData throws a NOT_FOUND ActionStoriesError for an unknown workflow code, with a safe userMessage', async () => {
    const { getStageData } = await import('./actionStoriesService.js');
    try {
      await getStageData('NOT-A-REAL-CODE', 'reason');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(err.userMessage).toBeTruthy();
      expect(err.retryable).toBe(false);
    }
  });

  it('getStageData throws a NOT_FOUND ActionStoriesError for an unknown stageKey on a real workflow', async () => {
    const { getStageData } = await import('./actionStoriesService.js');
    try {
      await getStageData('S9.1', 'not-a-real-stage');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ERROR_CODES.NOT_FOUND);
    }
  });

  it('getStageData throws a MALFORMED ActionStoriesError (not a silent render) when validateManifest rejects the manifest', async () => {
    vi.resetModules();
    vi.doMock('@/features/action-stories/manifests/validateManifest', () => ({
      validateManifest: () => ['"stageKey" is missing'],
    }));
    const { getStageData } = await import('./actionStoriesService.js');
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await getStageData('S9.1', 'reason');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err.code).toBe(ERROR_CODES.MALFORMED);
      expect(err.userMessage).not.toContain('stageKey'); // raw validator detail stays out of the user-facing message
    } finally {
      consoleWarnSpy.mockRestore();
      vi.doUnmock('@/features/action-stories/manifests/validateManifest');
      vi.resetModules();
    }
  });
});

describe('actionStoriesService — cancellation', () => {
  it('getWorkflowIndex rejects immediately with ABORTED when called with an already-aborted signal', async () => {
    const { getWorkflowIndex } = await import('./actionStoriesService.js');
    const controller = new AbortController();
    controller.abort();
    await expect(getWorkflowIndex({ signal: controller.signal })).rejects.toMatchObject({ code: ERROR_CODES.ABORTED });
  });

  it('getStageData rejects immediately with ABORTED when called with an already-aborted signal', async () => {
    const { getStageData } = await import('./actionStoriesService.js');
    const controller = new AbortController();
    controller.abort();
    await expect(getStageData('S9.1', 'reason', { signal: controller.signal })).rejects.toMatchObject({
      code: ERROR_CODES.ABORTED,
    });
  });
});
