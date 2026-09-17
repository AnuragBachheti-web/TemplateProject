import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { actionStoriesIndexPath } from '@/constants/actionStoriesRoutes';
import { getStageView, isUsingMockTransport } from '@/services/actionStoriesService';
import { useActionStoriesStore } from '@/store/useActionStoriesStore';
import { formatValue } from '@/features/action-stories/blocks/formatValue';
import { slateItemId } from '@/features/action-stories/contract/slateItem';
import StepTracker from '@/features/action-stories/components/StepTracker';
import LensBar from '@/features/action-stories/components/LensBar';
import StageRenderer from '@/features/action-stories/components/StageRenderer';
import StageActionBar from '@/features/action-stories/components/StageActionBar';
import { LoadingState, AsyncErrorState } from '@/features/action-stories/components/AsyncState';
import Breadcrumb from '@/features/action-stories/ui/Breadcrumb';

const STATUS_TONE = {
  pending: 'bg-rf-surface-sunken text-rf-text-secondary',
  approved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  modified: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  dismissed: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
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
function ProposalHeader({ decision, story }) {
  const due = decision.on_clock && decision.deadline ? deadlineLabel(decision.deadline) : null;

  return (
    <header className="sticky top-0 z-20 border-b border-rf-border-subtle bg-rf-surface-canvas px-6 pt-4 pb-3">
      <Breadcrumb
        items={[
          { label: 'Action Stories', to: actionStoriesIndexPath() },
          { label: decision.story_code },
          { label: decision.stage },
        ]}
      />

      <h1
        className="mt-2 font-serif text-[28px] font-normal leading-[1.15] tracking-[-0.02em] text-rf-text-primary"
        style={{ fontVariationSettings: "'opsz' 144" }}
      >
        {decision.title}
      </h1>

      {/* One row, each fact once. Impact/confidence used to be scattered across a pill, an <h1> and
          a rail block; they appear here and nowhere else. `mode` is NOT repeated here — LensBar
          below is the one place it's shown, as "Dial: {mode}" (previously this row ALSO printed a
          bare "Mode suggest", the same "same fact twice" bug this header's own doc comment already
          fixed once for the title). */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-rf-text-secondary">
        <span className={`inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-medium capitalize ${STATUS_TONE[decision.status] ?? STATUS_TONE.pending}`}>
          {decision.status}
        </span>
        {decision.impact && (
          <span>
            Impact <strong className="font-mono tabular-nums text-rf-text-primary">{formatValue(decision.impact)}</strong>
          </span>
        )}
        {decision.confidence && (
          <span>
            Confidence{' '}
            <strong className="font-mono tabular-nums text-rf-text-primary">
              {formatValue({ value: decision.confidence.value * 100, unit: 'pct', precision: 0 })}
            </strong>
            {decision.confidence.calibrated ? ' · calibrated' : ''}
          </span>
        )}
        {due && <span className="font-medium text-amber-700 dark:text-amber-400">{due}</span>}
      </div>

      <div className="mt-2.5">
        <LensBar decision={decision} />
      </div>

      {/* The parent/child relationship, made navigable. StepTracker already existed and already took
          (code, stages, activeStageKey) — restoring the two-segment route restored it verbatim; it
          was orphaned, not obsolete. Every step links to the SAME Action Story at another stage. */}
      {story && story.stageKeys.length > 1 && (
        <div className="mt-3 border-t border-rf-border-subtle pt-2.5">
          <StepTracker code={story.story_code} stages={story.stageKeys} activeStageKey={decision.stage} />
        </div>
      )}
    </header>
  );
}

/** Shown when the transport is the in-memory test double, so a demo can never be mistaken for a backend. */
function MockTransportNotice() {
  if (!isUsingMockTransport()) return null;
  return (
    <p className="mx-6 mt-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-1.5 text-[11.5px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
      No API configured — served by the in-memory test double. Set <code>VITE_API_BASE_URL</code> to use a real backend.
    </p>
  );
}

function StagePageContent({ storyCode, stageKey, onRetry }) {
  const [state, setState] = useState({ status: 'loading', view: null, error: null });
  const decision = useActionStoriesStore((s) => s.decision);
  const setDecision = useActionStoriesStore((s) => s.setDecision);
  const clearDecision = useActionStoriesStore((s) => s.clearDecision);
  const selection = useActionStoriesStore((s) => s.selection);
  const toggleSelection = useActionStoriesStore((s) => s.toggleSelection);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    getStageView(storyCode, stageKey, { signal: controller.signal })
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
  }, [storyCode, stageKey, setDecision, clearDecision]);

  if (state.status === 'loading') return <LoadingState label={`Loading ${storyCode} · ${stageKey}…`} />;
  if (state.status === 'error') return <AsyncErrorState error={state.error} onRetry={onRetry} />;

  // The store's Decision Object is authoritative from here on: the initial fetch seeded it, and
  // every successful action REPLACES it with what the API returned. Rendering from the store rather
  // than from the fetch result is what makes the whole page update after an action with no
  // re-fetch, no optimistic patch and no local mirror of server state.
  const current = decision ?? state.view.decision;
  const { manifest, story } = state.view;

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
          rowIdOf: (row, i) => slateItemId([row], 0) ?? `item_${i}`,
        },
      }
    : undefined;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-page flex-col">
      <ProposalHeader decision={current} story={story} />
      <MockTransportNotice />

      {/* The narrative is deliberately NOT rendered here. It is a template slot (`narrative`, see
          slotVocabulary.js), and rendering it outside the template both duplicated it on every
          stage that declares the slot AND bypassed entitlement: locked.v1 hides the slate and the
          figures, but a narrative printed by the page shell leaked the real business prose anyway.
          Everything a viewer sees below the header now comes through the selected template. */}

      <div className="flex-1">
        <StageRenderer manifest={manifest} fixture={current} blockProps={blockProps} />
      </div>

      <StageActionBar actions={manifest.actions} />
    </div>
  );
}

/**
 * `key={storyCode/stageKey/retryToken}` forces a clean remount per story+stage, so navigating starts this
 * component's state at "loading" again rather than needing an effect to reset it mid-lifecycle.
 * `retryToken` reuses the same mechanism for "Try again".
 */
export default function StagePage() {
  const { storyCode, stageKey } = useParams();
  const [retryToken, setRetryToken] = useState(0);
  return (
    <StagePageContent
      key={`${storyCode}/${stageKey}/${retryToken}`}
      storyCode={storyCode}
      stageKey={stageKey}
      onRetry={() => setRetryToken((n) => n + 1)}
    />
  );
}
