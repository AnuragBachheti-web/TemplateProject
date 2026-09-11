import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getWorkflowIndex } from '@/services/actionStoriesService';
import { actionStoryPath } from '@/constants/actionStoriesRoutes';
import { LoadingState, AsyncErrorState } from '@/features/action-stories/components/AsyncState';

function ActionStoriesHomeContent({ onRetry }) {
  const [state, setState] = useState({ status: 'loading', target: null, error: null });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    getWorkflowIndex({ signal: controller.signal })
      .then((index) => {
        if (cancelled) return;
        const first = index[0];
        setState({
          status: 'ready',
          target: first ? actionStoryPath(first.code, first.stages[0]) : null,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled || error?.code === 'ABORTED') return;
        setState({ status: 'error', target: null, error });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  if (state.status === 'loading') {
    return <LoadingState label="Loading workflows…" />;
  }
  if (state.status === 'error') {
    return <AsyncErrorState error={state.error} onRetry={onRetry} />;
  }
  if (!state.target) {
    return <div className="p-6 text-[13px] text-rf-text-secondary">No workflows found.</div>;
  }

  return <Navigate to={state.target} replace />;
}

/**
 * `/action-stories` itself redirects to the first workflow's first stage. `retryToken` forces a
 * clean remount on "Try again" — same key-remount pattern StagePage.jsx uses for its own retry,
 * rather than resetting fetch state mid-lifecycle inside an effect.
 */
export default function ActionStoriesHome() {
  const [retryToken, setRetryToken] = useState(0);
  return <ActionStoriesHomeContent key={retryToken} onRetry={() => setRetryToken((n) => n + 1)} />;
}
