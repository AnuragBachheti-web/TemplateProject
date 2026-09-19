import { useEffect, useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { actionStoryPath } from '@/constants/actionStoriesRoutes';
import { findStage } from '@/features/action-stories/actionStory';
import { getActionStories } from '@/services/actionStoriesService';
import { defaultStageOf } from '@/features/action-stories/actionStory';
import { LoadingState, AsyncErrorState } from '@/features/action-stories/components/AsyncState';

const DAY_MS = 86_400_000;

const URGENCY_STYLES = {
  urgent: { bar: 'bg-rf-status-critical', label: 'text-rf-status-critical' },
  medium: { bar: 'bg-rf-status-warning', label: 'text-rf-status-warning' },
  notable: { bar: 'bg-rf-status-purple', label: 'text-rf-status-purple' },
  clear: { bar: 'bg-rf-status-success', label: 'text-rf-status-success' },
};

/**
 * Urgency bucket, derived from fields the story already carries (on_clock, deadline, impact) — no
 * invented data. An on-clock deadline inside 3 days is urgent; further out is medium; no deadline
 * at all but a large swing is notable; anything else genuinely can wait.
 */
function storyUrgency(story) {
  const onClock = story.stages.filter((s) => s.on_clock && s.deadline);
  if (onClock.length > 0) {
    const days = Math.min(...onClock.map((s) => (Date.parse(s.deadline) - Date.now()) / DAY_MS));
    return days <= 3
      ? { tone: 'urgent', label: days <= 0 ? 'Overdue' : `Due in ${Math.ceil(days)}d` }
      : { tone: 'medium', label: `Due in ${Math.ceil(days)}d` };
  }
  const maxImpact = Math.max(0, ...story.stages.map((s) => Math.abs(s.impact ?? 0)));
  return maxImpact >= 5000 ? { tone: 'notable', label: null } : { tone: 'clear', label: null };
}

/**
 * The sidebar lists ACTION STORIES — one row each, never one row per stage.
 *
 * It briefly listed raw queue rows, which put the same story in the sidebar four times with four
 * identical titles. The queue is right to return one row per stage; the sidebar is wrong to render
 * them ungrouped. Clicking a story opens it at its default stage; the stage tracker in the page
 * header moves between that story's stages.
 *
 * Each row is a boxed card with a left urgency bar (red/amber/violet/green — see `storyUrgency`)
 * rather than a plain text row, following the reference design system's card-list pattern.
 */
function WorkflowNav({ activeStoryCode, onRetry }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [stories, setStories] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    getActionStories({ signal: controller.signal })
      .then((grouped) => {
        if (cancelled) return;
        setStories(grouped);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled || err?.code === 'ABORTED') return;
        setError(err);
        setStatus('error');
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return (
    <>
      {/* Previously the sidebar rendered an empty <ul> with no indication anything was loading —
          a slow network showed nothing with no explanation (AUDIT_REPORT.md §14). */}
      {status === 'loading' && <LoadingState label="Loading Action Stories…" compact />}
      {status === 'error' && <AsyncErrorState error={error} onRetry={onRetry} compact />}

      <ul className="flex flex-col gap-2 p-2.5">
        {status === 'ready' &&
          stories.map((story) => {
            const isActive = activeStoryCode === story.story_code;
            // The sidebar has the whole story in hand, so it addresses the proposal directly rather
            // than handing (code, stage) to StageRedirect to look up what it already knows.
            const openAt = defaultStageOf(story);
            const openId = findStage(story, openAt)?.proposal_id;
            const urgency = storyUrgency(story);
            return (
              <li key={story.story_code}>
                <NavLink
                  to={actionStoryPath(story.story_code, openAt, openId)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-stretch gap-3 overflow-hidden rounded-[var(--r-md)] border bg-rf-surface-canvas pr-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring ${
                    isActive
                      ? 'border-rf-border-strong shadow-[var(--shadow-xs)]'
                      : 'border-rf-border-subtle hover:border-rf-border-strong'
                  }`}
                >
                  <span aria-hidden="true" className={`w-[3px] flex-shrink-0 ${URGENCY_STYLES[urgency.tone].bar}`} />
                  <span className="min-w-0 flex-1 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-[9.5px] tracking-[0.04em] text-rf-text-tertiary">{story.story_code}</span>
                      {urgency.label && (
                        <span className={`font-mono text-[9px] uppercase tracking-[0.06em] ${URGENCY_STYLES[urgency.tone].label}`}>
                          {urgency.label}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] font-medium leading-snug text-rf-text-primary">
                      {story.title}
                    </span>
                  </span>
                  {/* Stage COUNT, not a stage name — one row is the whole story. */}
                  <span className="flex-shrink-0 self-center font-mono text-[9px] text-rf-text-tertiary">{story.stages.length}</span>
                </NavLink>
              </li>
            );
          })}
      </ul>
    </>
  );
}

/**
 * The left sidebar listing all 26 workflows, plus the page outlet beside it. Fetches the
 * workflow index once; StagePage (rendered in the outlet) fetches its own stage data separately.
 * `retryToken` remounts only `WorkflowNav` on "Try again" (same key-remount pattern as
 * StagePage.jsx/ActionStoriesHome.jsx) — never the whole Shell, which would also tear down and
 * refetch whatever stage is currently showing in the outlet for no reason.
 *
 * Visual language follows the reference design system directly (Realify Workspace Dashboard
 * Build's own source mockups) — a restrained nav rail (ink borders, mono micro-labels, a subtle
 * accent bar for the active item), not a generic admin-dashboard sidebar. It still lists all 26
 * workflows (the reference's own 68px icon-only rail switches between *product modules*, a
 * different navigational concept from "which of 26 workflow instances" — collapsing this to icons
 * would destroy real navigation, so the restraint is borrowed, not the literal icon-rail pattern).
 *
 * The header row that used to sit above `main` (search, theme, notifications, account) moved up a
 * level into DecisionsShell's own header — this embedded copy was redundant chrome once that outer
 * header existed, so it's gone entirely rather than duplicated.
 */
export default function Shell() {
  const { storyCode: activeStoryCode } = useParams();
  const [retryToken, setRetryToken] = useState(0);

  return (
    <div className="flex h-full bg-rf-surface-sunken font-sans text-rf-text-primary">
      <nav
        aria-label="Workflows"
        className="flex w-60 flex-shrink-0 flex-col overflow-y-auto border-r border-rf-border-subtle bg-rf-surface-canvas"
      >
        <WorkflowNav key={retryToken} activeStoryCode={activeStoryCode} onRetry={() => setRetryToken((n) => n + 1)} />

        <div className="mt-auto flex flex-col border-t border-rf-border-subtle px-2 py-2">
          <a
            href="#settings"
            className="flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[12.5px] font-medium text-rf-text-secondary transition-colors hover:bg-rf-surface-sunken hover:text-rf-text-primary"
          >
            <i className="fa-solid fa-gear w-3.5 text-center text-[11px] text-rf-text-tertiary" aria-hidden="true" />
            Settings
          </a>
          <a
            href="#help"
            className="flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[12.5px] font-medium text-rf-text-secondary transition-colors hover:bg-rf-surface-sunken hover:text-rf-text-primary"
          >
            <i className="fa-regular fa-circle-question w-3.5 text-center text-[11px] text-rf-text-tertiary" aria-hidden="true" />
            Help &amp; Support
          </a>
          <div className="mt-1 flex items-center gap-2 px-3 py-1.5">
            <span aria-hidden="true" className="h-[6px] w-[6px] shrink-0 rounded-full bg-rf-status-success" />
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-rf-text-tertiary">All systems</span>
          </div>
        </div>
      </nav>

      <main id="main-content" className="min-w-0 flex-1 overflow-y-auto bg-rf-surface-sunken">
        <Outlet />
      </main>
    </div>
  );
}
