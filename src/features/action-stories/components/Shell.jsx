import { useEffect, useState } from 'react';
import { NavLink, Outlet, useParams, useLocation } from 'react-router-dom';
import { actionStoryPath } from '@/constants/actionStoriesRoutes';
import { findStage } from '@/features/action-stories/actionStory';
import { getActionStories } from '@/services/actionStoriesService';
import { defaultStageOf } from '@/features/action-stories/actionStory';
import { useThemeStore } from '@/store/useThemeStore';
import { LoadingState, AsyncErrorState } from '@/features/action-stories/components/AsyncState';

const THEME_CYCLE = ['light', 'dark', 'system'];
const THEME_ICON = { light: 'fa-sun', dark: 'fa-moon', system: 'fa-circle-half-stroke' };
const THEME_LABEL = { light: 'Light', dark: 'Dark', system: 'System' };

/** Cycles light → dark → system → light. A real activation path for the dark-mode tokens this app already ships (see useThemeStore.js). */
function ThemeToggle() {
  const preference = useThemeStore((s) => s.preference);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <button
      type="button"
      onClick={() => setTheme(THEME_CYCLE[(THEME_CYCLE.indexOf(preference) + 1) % THEME_CYCLE.length])}
      className="grid h-7 w-7 place-items-center rounded-md text-rf-text-tertiary transition-colors hover:bg-rf-surface-sunken hover:text-rf-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring"
      aria-label={`Theme: ${THEME_LABEL[preference]}. Click to change.`}
      title={`Theme: ${THEME_LABEL[preference]}`}
    >
      <i className={`fa-solid ${THEME_ICON[preference]} text-[12px]`} aria-hidden="true" />
    </button>
  );
}

/**
 * The persistent top bar (search, notifications, theme, account) the reference always shows above
 * the content canvas — workspace-level chrome, not per-story content, so unlike everything below
 * it this deliberately carries no fabricated business data (no invented marketplace, no invented
 * person's name/role): this app has no auth/session/search backend to source that from honestly,
 * and inventing one would be exactly the "hardcode the reference's content" this task rules out.
 * The search input and avatar are real, present, and visually complete, just not wired to a
 * backend that doesn't exist yet — the same "structure now, data later" posture already used for
 * the sidebar's "Settings"/"Help & Support" links below.
 */
function TopBar({ onOpenNav }) {
  return (
    <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-rf-border-subtle bg-rf-surface-canvas px-4">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open workflow menu"
        className="rounded-md p-1.5 text-rf-text-secondary hover:bg-rf-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring lg:hidden"
      >
        <i className="fa-solid fa-bars text-[14px]" aria-hidden="true" />
      </button>

      <label className="relative flex min-w-0 max-w-md flex-1 items-center">
        <i
          className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 text-[11px] text-rf-text-tertiary"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search workflows, SKUs, or insights…"
          className="w-full rounded-full border border-rf-border-subtle bg-rf-surface-sunken py-[7px] pl-8 pr-3 text-[12.5px] text-rf-text-primary placeholder:text-rf-text-tertiary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring"
        />
        <kbd className="pointer-events-none absolute right-2.5 hidden rounded border border-rf-border-subtle bg-rf-surface-canvas px-1.5 py-[1px] font-mono text-[9.5px] text-rf-text-tertiary sm:inline-block">
          ⌘K
        </kbd>
      </label>

      <span className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <button
          type="button"
          aria-label="Notifications"
          className="grid h-8 w-8 place-items-center rounded-full text-rf-text-tertiary transition-colors hover:bg-rf-surface-sunken hover:text-rf-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring"
        >
          <i className="fa-regular fa-bell text-[14px]" aria-hidden="true" />
        </button>
        <span
          aria-hidden="true"
          className="grid h-8 w-8 place-items-center rounded-full bg-rf-surface-sunken text-rf-text-tertiary"
        >
          <i className="fa-solid fa-user text-[13px]" aria-hidden="true" />
        </span>
      </span>
    </header>
  );
}

/**
 * The sidebar lists ACTION STORIES — one row each, never one row per stage.
 *
 * It briefly listed raw queue rows, which put the same story in the sidebar four times with four
 * identical titles. The queue is right to return one row per stage; the sidebar is wrong to render
 * them ungrouped. Clicking a story opens it at its default stage; the stage tracker in the page
 * header moves between that story's stages.
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

      <ul className="flex flex-col gap-px p-2">
        {status === 'ready' &&
          stories.map((story) => {
            const isActive = activeStoryCode === story.story_code;
            // The sidebar has the whole story in hand, so it addresses the proposal directly rather
            // than handing (code, stage) to StageRedirect to look up what it already knows.
            const openAt = defaultStageOf(story);
            const openId = findStage(story, openAt)?.proposal_id;
            return (
              <li key={story.story_code}>
                <NavLink
                  to={actionStoryPath(story.story_code, openAt, openId)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex items-center gap-2.5 rounded-md py-[7px] pl-3 pr-2.5 text-[12.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring ${
                    isActive
                      ? 'bg-rf-brand-tint-08 text-rf-text-primary'
                      : 'text-rf-text-secondary hover:bg-rf-surface-sunken hover:text-rf-text-primary'
                  }`}
                >
                  {isActive && (
                    <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[2.5px] rounded-full bg-rf-brand-indicator" />
                  )}
                  <span className="shrink-0 font-mono text-[9.5px] tracking-[0.04em] text-rf-text-tertiary">{story.story_code}</span>
                  <span className="min-w-0 flex-1 truncate">{story.title}</span>
                  {/* Stage COUNT, not a stage name — one row is the whole story. */}
                  <span className="shrink-0 font-mono text-[9px] text-rf-text-tertiary">{story.stages.length}</span>
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
 * Below `lg:` it's an off-canvas drawer (a menu button opens it, a backdrop or picking a workflow
 * closes it); at `lg:` and above it's the same always-visible static column as before
 * (AUDIT_REPORT.md §15).
 */
export default function Shell() {
  const { storyCode: activeStoryCode } = useParams();
  const { pathname } = useLocation();
  const [retryToken, setRetryToken] = useState(0);
  const [navOpen, setNavOpen] = useState(false);

  // Closes the mobile drawer the moment a navigation completes — React's own documented pattern
  // for "adjust state when a prop changes" (setState directly during render, comparing against a
  // last-seen value in state), not a useEffect, which would set state one render late and trigger
  // this project's own react-hooks/set-state-in-effect lint rule for no benefit here.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setNavOpen(false);
  }

  return (
    <div data-shell-part="frame" className="flex h-screen bg-rf-surface-sunken font-sans text-rf-text-primary">
      {navOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-10 bg-black/30 lg:hidden"
        />
      )}

      <nav
        aria-label="Workflows"
        className={`fixed inset-y-0 left-0 z-20 flex w-60 flex-shrink-0 flex-col overflow-y-auto border-r border-rf-border-subtle bg-rf-surface-canvas transition-transform duration-200 lg:static lg:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-rf-border-subtle px-4 py-3.5">
          <span
            aria-hidden="true"
            className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-[7px] bg-rf-brand-blue-500 text-[10px] font-semibold text-white"
          >
            R
          </span>
          <span className="font-serif text-[16px] font-normal tracking-[-0.02em] text-rf-text-primary" style={{ fontVariationSettings: "'opsz' 144" }}>
            Realify
          </span>
        </div>
        <div className="px-4 pt-3.5 pb-1">
          <p className="font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] text-rf-text-tertiary">Action Stories</p>
        </div>
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

      {/* `min-h-0` added in Phase 5D (II2). This column measured correctly without it — it is a
          flex child of a `h-screen` row, so it inherited the right height by accident — but its
          `min-height` computed to `auto`, which means it would refuse to shrink below its content
          the moment anything inside grew. An unconstrained link in the height chain is where the
          next scroll regression hides, so it is closed even though nothing is currently wrong. */}
      <div data-shell-part="column" className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar onOpenNav={() => setNavOpen(true)} />
        {/* PHASE 5C. This element used to be the page's ONE scroll container, wrapping the whole of
            StagePage — so the proposal header, the stage tracker and the action bar all scrolled
            away with the content, and the two regions inside shared a single scrollbar. A long
            slate dragged the rail's context out of view, which is the opposite of what a rail is
            for.

            It no longer scrolls anything. It is a fixed-height, non-scrolling frame (`min-h-0` so
            it may be shorter than its content, `overflow-hidden` so nothing escapes it), and the
            page inside owns its own vertical composition — StagePage splits it into a pinned
            header, two independently scrolling regions and a pinned action bar, exactly as the
            reference builds it (S10.1-1-reason.dc.html:196-198, 333, 392).

            The route's own page is now responsible for its scrolling: ActionStoriesHome declares
            its own `overflow-y-auto`, because a list page and a stage pane want different
            behaviour and this element can no longer decide for both. */}
        <main data-shell-part="main" id="main-content" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-rf-surface-sunken">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
