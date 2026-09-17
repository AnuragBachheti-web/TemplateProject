import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { actionStoryPath } from '@/constants/actionStoriesRoutes';
import { resolveStageProposalId } from '@/services/actionStoriesService';
import { LoadingState, AsyncErrorState } from '@/features/action-stories/components/AsyncState';

/**
 * The compatibility route: `/action-stories/:storyCode/:stageKey`, with no proposal id.
 *
 * C4 — every link, bookmark and deep link that existed before the proposal id joined the URL keeps
 * working. This resolves (storyCode, stageKey) to a proposal id ONCE and then replaces itself with
 * the canonical route, so the ambiguous (storyCode, stageKey) lookup exists in exactly one place in
 * the app and nothing renders from it.
 *
 * `replace`, not a push: the redirect must not sit in history, or Back off the destination would
 * land here and immediately bounce forward again.
 *
 * An ambiguous stage arrives here as the MALFORMED error resolveStageProposalId raises, and is shown
 * as operator copy by the same AsyncErrorState every other failure uses. It is not resolved to a
 * guess — that guess is the bug this phase closes.
 */
export default function StageRedirect() {
  const { storyCode, stageKey } = useParams();
  const [state, setState] = useState({ status: 'loading', proposalId: null, error: null });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    resolveStageProposalId(storyCode, stageKey, { signal: controller.signal })
      .then(({ proposalId }) => {
        if (!cancelled) setState({ status: 'ready', proposalId, error: null });
      })
      .catch((error) => {
        if (cancelled || error?.code === 'ABORTED') return;
        setState({ status: 'error', proposalId: null, error });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [storyCode, stageKey]);

  if (state.status === 'loading') return <LoadingState label={`Opening ${storyCode} · ${stageKey}…`} />;
  if (state.status === 'error') return <AsyncErrorState error={state.error} />;
  return <Navigate to={actionStoryPath(storyCode, stageKey, state.proposalId)} replace />;
}
