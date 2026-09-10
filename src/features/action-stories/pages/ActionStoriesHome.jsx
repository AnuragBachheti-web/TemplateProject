import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getWorkflowIndex } from '@/services/actionStoriesService';
import { actionStoryPath } from '@/constants/actionStoriesRoutes';

/** `/action-stories` itself redirects to the first workflow's first stage. */
export default function ActionStoriesHome() {
  const [state, setState] = useState({ status: 'loading', target: null, error: null });

  useEffect(() => {
    let cancelled = false;
    getWorkflowIndex()
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
        if (!cancelled) setState({ status: 'error', target: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return <div className="p-6 text-[13px] text-rf-text-secondary">Loading…</div>;
  }
  if (state.status === 'error') {
    return <div className="p-6 text-[13px] text-rose-600">Couldn&rsquo;t load workflows: {state.error.message}</div>;
  }
  if (!state.target) {
    return <div className="p-6 text-[13px] text-rf-text-secondary">No workflows found.</div>;
  }

  return <Navigate to={state.target} replace />;
}
