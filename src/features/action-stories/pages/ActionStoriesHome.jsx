import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getActionStories } from '@/services/actionStoriesService';
import { actionStoryPath } from '@/constants/actionStoriesRoutes';
import { formatValue } from '@/features/action-stories/blocks/formatValue';
import { LoadingState, AsyncErrorState } from '@/features/action-stories/components/AsyncState';

import { typeRole } from '../blocks/typeRole';
const STAGE_LABELS = { reason: 'Reason', analyze: 'Analyze', decide: 'Decide', execute: 'Execute', live: 'Live' };

const STATUS_TONE = {
  pending: 'bg-rf-surface-sunken text-rf-text-secondary',
  approved: 'bg-rf-status-success/10 text-rf-status-success-text dark:bg-rf-status-success/10 dark:text-rf-status-success-text',
  modified: 'bg-rf-status-warning/10 text-rf-status-warning-text dark:bg-rf-status-warning/10 dark:text-rf-status-warning-text',
  dismissed: 'bg-rf-status-critical/10 text-rf-status-critical-text dark:bg-rf-status-critical/10 dark:text-rf-status-critical-text',
};

/**
 * ONE card per Action Story, with its stages as entry points.
 *
 * This is the listing-side half of the parent/child fix. Each stage chip is a deep link to the SAME
 * Action Story at that stage — `/action-stories/S10.1/decide` — never to a separate story.
 */
function ActionStoryCard({ story }) {
  const headline = story.stages.find((s) => s.impact)?.impact ?? null;

  return (
    <li className="rounded-2xl border border-rf-border-subtle bg-rf-surface-canvas p-4 shadow-xs">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span {...typeRole('label', 'text-rf-text-tertiary')}>
          {story.story_code}
        </span>
        <h2 {...typeRole('heading', 'min-w-0 flex-1 text-rf-text-primary')}>
          {story.title}
        </h2>
        {headline && (
          <span {...typeRole('figure', 'shrink-0 text-rf-text-secondary')}>
            {formatValue(headline)}
          </span>
        )}
      </div>

      {/* Reason → Analyze → Decide → Execute. One Action Story, four ways in. */}
      <ol className="mt-3 flex flex-wrap items-center gap-1.5">
        {story.stages.map((stage) => (
          <li key={stage.stage}>
            <Link
              to={actionStoryPath(story.story_code, stage.stage, stage.proposal_id)}
              {...typeRole('body', 'inline-flex items-center gap-1.5 rounded-full border border-rf-border-default px-2.5 py-[3px] text-rf-text-secondary transition-colors hover:bg-rf-surface-sunken hover:text-rf-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring')}
            >
              {STAGE_LABELS[stage.stage] ?? stage.stage}
              <span className={`${typeRole('micro').className} rounded-full px-1.5 capitalize ${STATUS_TONE[stage.status] ?? STATUS_TONE.pending}`}>
                {stage.status}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </li>
  );
}

function ActionStoriesHomeContent({ onRetry }) {
  const [state, setState] = useState({ status: 'loading', stories: [], error: null });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    getActionStories({ signal: controller.signal })
      .then((stories) => {
        if (cancelled) return;
        setState({ status: 'ready', stories, error: null });
      })
      .catch((error) => {
        if (cancelled || error?.code === 'ABORTED') return;
        setState({ status: 'error', stories: [], error });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  if (state.status === 'loading') return <LoadingState label="Loading Action Stories…" />;
  if (state.status === 'error') return <AsyncErrorState error={state.error} onRetry={onRetry} />;
  if (state.stories.length === 0) {
    return <div {...typeRole('body', 'p-6 text-rf-text-secondary')}>No Action Stories found.</div>;
  }

  return (
    // Owns its own scrolling since Phase 5C: Shell's `<main>` stopped being the page's scroll
    // container so a stage pane could split into independently scrolling regions, and a list page
    // wants the plain single-column scroll it always had.
    <div className="mx-auto min-h-0 w-full max-w-page flex-1 overflow-y-auto px-6 py-5">
      <h1
        {...typeRole('display', 'text-rf-text-primary')}
        style={{ fontVariationSettings: "'opsz' 144" }}
      >
        Action Stories
      </h1>
      <p {...typeRole('body', 'mt-1 text-rf-text-secondary')}>
        {state.stories.length} stories ·{' '}
        {state.stories.reduce((n, s) => n + s.stages.length, 0)} stages
      </p>

      <ul className="mt-4 flex flex-col gap-2.5">
        {state.stories.map((story) => (
          <ActionStoryCard key={story.story_code} story={story} />
        ))}
      </ul>
    </div>
  );
}

/**
 * `/action-stories` is now a real LISTING, not a redirect.
 *
 * It used to redirect straight to the first proposal, which meant the product had no screen where
 * an Action Story existed as a thing in its own right — the only place a story appeared was as four
 * separate stage rows in the sidebar. `retryToken` forces a clean remount on "Try again", the same
 * key-remount pattern StagePage uses.
 */
export default function ActionStoriesHome() {
  const [retryToken, setRetryToken] = useState(0);
  return <ActionStoriesHomeContent key={retryToken} onRetry={() => setRetryToken((n) => n + 1)} />;
}
