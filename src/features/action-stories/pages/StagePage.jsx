import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PaneEyebrow from '../components/PaneEyebrow';
import { getStageView, isUsingMockTransport } from '@/services/actionStoriesService';
import { useActionStoriesStore } from '@/store/useActionStoriesStore';
import { formatValue } from '@/features/action-stories/blocks/formatValue';
import { slateItemIdOf } from '@/features/action-stories/contract/slateItem';
import StepTracker from '@/features/action-stories/components/StepTracker';
import StageRenderer from '@/features/action-stories/components/StageRenderer';
import StageActionBar from '@/features/action-stories/components/StageActionBar';
import { LoadingState, AsyncErrorState } from '@/features/action-stories/components/AsyncState';
import Alert from '@/features/action-stories/ui/Alert';

import { typeRole } from '../blocks/typeRole';
const STATUS_TONE = {
  pending: 'bg-rf-surface-sunken text-rf-text-secondary',
  approved: 'bg-rf-status-success/10 text-rf-status-success-text dark:bg-rf-status-success/10 dark:text-rf-status-success-text',
  modified: 'bg-rf-status-warning/10 text-rf-status-warning-text dark:bg-rf-status-warning/10 dark:text-rf-status-warning-text',
  dismissed: 'bg-rf-status-critical/10 text-rf-status-critical-text dark:bg-rf-status-critical/10 dark:text-rf-status-critical-text',
};

/** Relative deadline copy. Derived from the instant the backend sent — never sent pre-formatted. */
function deadlineLabel(deadline, now = Date.now()) {
  const ms = Date.parse(deadline) - now;
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return 'Overdue';
  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) return `Due in ${hours}h`;
  return `Due in ${Math.round(hours / 24)}d`;
}

/**
 * The pinned identity strip. Renders the proposal's title ONCE — the previous version rendered
 * `workflow.name` twice, as a pill and again as the `<h1>` — plus impact, confidence, mode and
 * deadline, each exactly once, formatted here from typed values.
 */
function ProposalHeader({ decision, story, storyProblem }) {
  const due = decision.on_clock && decision.deadline ? deadlineLabel(decision.deadline) : null;

  return (
    // PHASE 5C: `sticky top-0` became `shrink-0`. Sticky was how this stayed put while the whole
    // page scrolled underneath it; the page no longer scrolls, so the header is simply a
    // non-shrinking band above the scroll regions — which is what the reference does
    // (S10.1-1-reason.dc.html: the header sits outside the `flex:1;min-height:0` grid entirely).
    // A sticky element inside a non-scrolling parent is inert, and leaving it would have implied a
    // scroll relationship that no longer exists.
    <header data-shell-part="header" className="z-20 shrink-0 border-b border-rf-border-subtle bg-rf-surface-canvas px-6 pt-4 pb-3">
      <PaneEyebrow lens={decision.lens} storyCode={decision.story_code} stage={decision.stage} />

      <h1
        {...typeRole('display', 'mt-2 text-rf-text-primary')}
      >
        {decision.title}
      </h1>

      {/* ONE ROW, EACH FACT ONCE — and now true rather than intended. `mode` was rendering twice on
          every pane: here, and again as the rail's `decision_mode` block, so an operator read
          "Mode suggest" in the header and "Suggest" in the rail of the same screen. The rail block
          is gone from all four manifests; the header is the single site.

          Each fact carries `data-fact` so "exactly once" is countable. Counting words in the pane's
          flattened text is not an instrument that works here — textContent concatenates adjacent
          nodes with no separator, so "Mode suggest" abutting the next element defeats a word
          boundary, and a bare count magnitude like 214 matches body prose that has nothing to do
          with the impact. A marked node is the fact; a matching substring is a coincidence. */}
      <div {...typeRole('small', 'mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-rf-text-secondary')}>
        <span className={`${typeRole('small').className} inline-flex items-center rounded-full px-2.5 py-[3px] capitalize ${STATUS_TONE[decision.status] ?? STATUS_TONE.pending}`}>
          {decision.status}
        </span>
        {decision.impact && (
          <span data-fact="impact">
            Impact <strong {...typeRole('figure', 'text-rf-text-primary')}>{formatValue(decision.impact)}</strong>
          </span>
        )}
        {decision.confidence && (
          <span data-fact="confidence">
            Confidence{' '}
            <strong {...typeRole('figure', 'text-rf-text-primary')}>
              {formatValue({ value: decision.confidence.value * 100, unit: 'pct', precision: 0 })}
            </strong>
            {decision.confidence.calibrated ? ' · calibrated' : ''}
          </span>
        )}
        <span data-fact="mode" className="capitalize">Mode {decision.mode}</span>
        {due && <span className="text-rf-status-warning-text">{due}</span>}
      </div>

      {/* The parent/child relationship, made navigable. StepTracker already existed and already took
          (code, stages, activeStageKey) — restoring the two-segment route restored it verbatim; it
          was orphaned, not obsolete. Every step links to the SAME Action Story at another stage. */}
      {story && story.stages.length > 1 && (
        <div data-shell-part="tracker" className="mt-3 border-t border-rf-border-subtle pt-2.5">
          <StepTracker code={story.story_code} stages={story.stages} activeStageKey={decision.stage} />
        </div>
      )}

      {/* A story whose outline could not be built says so. The proposal above renders fine — it was
          addressed by id — but an operator seeing no stage strip deserves the reason rather than a
          silently shorter header. */}
      {storyProblem && (
        <div className="mt-3 border-t border-rf-border-subtle pt-2.5">
          <Alert tone="warning" compact>{storyProblem}</Alert>
        </div>
      )}
    </header>
  );
}

/** Shown when the transport is the in-memory test double, so a demo can never be mistaken for a backend. */
function MockTransportNotice() {
  if (!isUsingMockTransport()) return null;
  return (
    <p {...typeRole('small', 'mx-6 mt-3 rounded-lg border border-dashed border-rf-status-warning/40 bg-rf-status-warning/10 px-3 py-1.5 text-rf-status-warning-text dark:border-rf-status-warning/40 dark:bg-rf-status-warning/10 dark:text-rf-status-warning-text')}>
      No API configured — served by the in-memory test double. Set <code>VITE_API_BASE_URL</code> to use a real backend.
    </p>
  );
}

function StagePageContent({ storyCode, stageKey, proposalId, onRetry }) {
  const [state, setState] = useState({ status: 'loading', view: null, error: null });
  const decision = useActionStoriesStore((s) => s.decision);
  const setDecision = useActionStoriesStore((s) => s.setDecision);
  const clearDecision = useActionStoriesStore((s) => s.clearDecision);
  const selection = useActionStoriesStore((s) => s.selection);
  const toggleSelection = useActionStoriesStore((s) => s.toggleSelection);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    getStageView(storyCode, stageKey, proposalId, { signal: controller.signal })
      .then((view) => {
        if (cancelled) return;
        setDecision(view.decision);
        setState({ status: 'ready', view, error: null });
      })
      .catch((error) => {
        if (cancelled || error?.code === 'ABORTED') return;
        setState({ status: 'error', view: null, error });
      });

    return () => {
      cancelled = true;
      controller.abort();
      clearDecision();
    };
  }, [storyCode, stageKey, proposalId, setDecision, clearDecision]);

  if (state.status === 'loading') return <LoadingState label={`Loading ${storyCode} · ${stageKey}…`} />;
  if (state.status === 'error') return <AsyncErrorState error={state.error} onRetry={onRetry} />;

  // The store's Decision Object is authoritative from here on: the initial fetch seeded it, and
  // every successful action REPLACES it with what the API returned. Rendering from the store rather
  // than from the fetch result is what makes the whole page update after an action with no
  // re-fetch, no optimistic patch and no local mirror of server state.
  const current = decision ?? state.view.decision;
  const { manifest, story, storyProblem } = state.view;

  // The one generic hook into the renderer: whichever block the template marked `selectable` gets
  // selection props. Nothing here or in StageRenderer knows that block is a slate, or that selection
  // feeds approval — the template declares the capability, the page supplies the state.
  const selectableBlock = manifest.blocks.find((b) => b.selectable === true);
  const blockProps = selectableBlock
    ? {
        [selectableBlock.slotName]: {
          selectable: true,
          selectedIds: selection,
          onToggleRow: toggleSelection,
          // Passed straight through, NOT wrapped. TableBlock calls `rowIdOf(row, i)` with the row's
          // real index, which is exactly this function's signature — so there is no longer anywhere
          // here for the index to be lost. The wrapper that used to sit on this line called
          // `slateItemId([row], 0)` and gave every id-less row the same `item_0`.
          rowIdOf: slateItemIdOf,
        },
      }
    : undefined;

  return (
    // THE PANE IS A FIXED-HEIGHT SHELL (Phase 5C, invariant I6). Three bands: a header that does
    // not shrink, a regions block that takes the remaining height and is allowed to be shorter than
    // its content (`min-h-0` — without it a flex child refuses to shrink below its content and the
    // scroll never engages), and an action bar that does not shrink. Nothing here scrolls; the two
    // regions inside StageSections each own their own overflow.
    <div className="mx-auto flex h-full min-h-0 w-full max-w-page flex-col">
      <ProposalHeader decision={current} story={story} storyProblem={storyProblem} />
      <MockTransportNotice />

      {/* The narrative is deliberately NOT rendered here. It is a template slot (`narrative`, see
          slotVocabulary.js), and rendering it outside the template both duplicated it on every
          stage that declares the slot AND bypassed entitlement: locked.v1 hides the slate and the
          figures, but a narrative printed by the page shell leaked the real business prose anyway.
          Everything a viewer sees below the header now comes through the selected template. */}

      <div data-shell-part="regions" className="min-h-0 flex-1">
        <StageRenderer manifest={manifest} fixture={current} blockProps={blockProps} />
      </div>

      {/* The stage's own state and the route forward, in the one place the reference puts them
          (S10.1-1-reason.dc.html:392). `statusNote` is the SAME value the rail used to render
          through the `stage_status` slot — that slot is gone from all four templates (R60), so this
          is now its only site, exactly as Phase 4 Part 2 did for the mode axis. */}
      <StageActionBar
        actions={manifest.actions}
        stageState={current.status_note}
        stage={current.stage}
        storyCode={current.story_code}
        story={story}
      />
    </div>
  );
}

/**
 * `key={storyCode/stageKey/proposalId/retryToken}` forces a clean remount per addressed proposal, so
 * navigating starts this component's state at "loading" again rather than needing an effect to reset
 * it mid-lifecycle. `proposalId` is in the key as well as the path because two proposals can share
 * one (storyCode, stageKey) — without it, moving between them would reuse the mounted state and
 * render the previous proposal's data under the new URL.
 * `retryToken` reuses the same mechanism for "Try again".
 */
export default function StagePage() {
  const { storyCode, stageKey, proposalId } = useParams();
  const [retryToken, setRetryToken] = useState(0);
  return (
    <StagePageContent
      key={`${storyCode}/${stageKey}/${proposalId}/${retryToken}`}
      storyCode={storyCode}
      stageKey={stageKey}
      proposalId={proposalId}
      onRetry={() => setRetryToken((n) => n + 1)}
    />
  );
}
