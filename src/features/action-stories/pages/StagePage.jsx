import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { actionStoriesIndexPath } from '@/constants/actionStoriesRoutes';
import { getWorkflowIndex, getStageData } from '@/services/actionStoriesService';
import { resolveStageActionEligibility } from '@/features/action-stories/components/stageActionEligibility';
import StepTracker from '@/features/action-stories/components/StepTracker';
import StageRenderer from '@/features/action-stories/components/StageRenderer';
import StageActionBar from '@/features/action-stories/components/StageActionBar';
import { LoadingState, AsyncErrorState } from '@/features/action-stories/components/AsyncState';

const STAGE_LABELS = { reason: 'Reason', analyze: 'Analyze', decide: 'Decide', execute: 'Execute', live: 'Live' };

function StagePageContent({ code, stageKey, onRetry }) {
  const [state, setState] = useState({ status: 'loading', workflow: null, manifest: null, fixture: null, error: null });

  useEffect(() => {
    // A real AbortController, not just the `cancelled` flag alone — the flag still guards against
    // acting on a stale response (correct, and kept), but the in-flight request/module-load itself
    // is now actually cancelled too when this effect tears down (AUDIT_REPORT.md §12/§24 P3 #18).
    let cancelled = false;
    const controller = new AbortController();

    Promise.all([getWorkflowIndex({ signal: controller.signal }), getStageData(code, stageKey, { signal: controller.signal })])
      .then(([index, { manifest, fixture }]) => {
        if (cancelled) return;
        const workflow = index.find((wf) => wf.code === code) || null;
        setState({ status: 'ready', workflow, manifest, fixture, error: null });
      })
      .catch((error) => {
        if (cancelled || error?.code === 'ABORTED') return;
        setState({ status: 'error', workflow: null, manifest: null, fixture: null, error });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [code, stageKey]);

  if (state.status === 'loading') {
    return <LoadingState label={`Loading ${code}/${stageKey}…`} />;
  }

  if (state.status === 'error') {
    return <AsyncErrorState error={state.error} onRetry={onRetry} />;
  }

  const { workflow, manifest, fixture } = state;
  const stages = workflow?.stages || [stageKey];

  // The one place that decides whether this stage's real action is actually allowed to run right
  // now, and what to call it — see stageActionEligibility.js's own doc comment. Replaces this
  // page's previous inline `guardrail_cta_label`-only lookup, which read the button's LABEL but
  // never its `guardrail_blocked`/`guardrail_can_approve` siblings — the exact gap that let a
  // proposal whose own data says it's blocked still show a fully clickable Approve button.
  const actionEligibility = resolveStageActionEligibility(manifest, fixture);

  const stageLabel = STAGE_LABELS[stageKey] || stageKey;

  // The Action Story INSTANCE headline — a real, extracted field (see extraction/parseMockup.js's
  // extractInstanceHeadline and generateManifests.js), distinct from `workflow.name`/`manifest.name`
  // (the workflow/CATEGORY identity, e.g. "Assortment") — never the same field doing two jobs
  // (FORENSIC_AUDIT_S9.1.md §6/§17). Constant across a workflow's own stages (confirmed in every
  // reference mockup checked), so the manifest's own per-stage value and the workflow index's
  // value should always agree; preferring the manifest's own copy is just "closer to this exact
  // render" defensiveness, not a meaningful precedence choice. A workflow whose original mockup
  // export never had this banner shape simply has no `headline` — this renders no subtitle at all,
  // never a fabricated one standing in for it (the old `pickHeroBlock` mechanism's actual bug).
  const headline = manifest.headline || workflow?.headline;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-page flex-col">
      <header className="px-6 pt-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-rf-text-tertiary">
          <Link to={actionStoriesIndexPath()} className="transition-colors hover:text-rf-text-primary">
            Action Stories
          </Link>
          <i className="fa-solid fa-chevron-right text-[7px]" aria-hidden="true" />
          <span className="text-rf-text-secondary">{code}</span>
          <i className="fa-solid fa-chevron-right text-[7px]" aria-hidden="true" />
          <span className="text-rf-text-secondary">{stageLabel}</span>
        </nav>

        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-rf-brand-blue-500 px-2.5 py-[3px] font-mono text-[10px] font-semibold text-white">
            {code}
          </span>
          <span className="inline-flex items-center rounded-full bg-rf-surface-sunken px-2.5 py-[3px] text-[11px] font-medium text-rf-text-secondary">
            {workflow?.name || manifest.name}
          </span>
        </div>

        {/* `<h1>` names the WORKFLOW/CATEGORY (e.g. "Assortment") — a fixed identity, shared by
            every stage of this workflow. The subtitle underneath is the Action Story's own real,
            extracted INSTANCE headline (e.g. "Quarterly assortment review — 214 active SKUs") —
            a genuinely distinct field, not the same string rendered twice, and not a stand-in
            narrative sentence borrowed from the stage's own body content (see `headline` above).
            A workflow whose mockup export never had this banner shape simply shows no subtitle. */}
        <h1
          className="mt-2 font-serif text-[34px] font-normal leading-[1.1] tracking-[-0.02em] text-rf-text-primary"
          style={{ fontVariationSettings: "'opsz' 144" }}
        >
          {workflow?.name || manifest.name}
        </h1>
        {headline && <p className="mt-1.5 max-w-[720px] text-[15px] font-semibold leading-snug text-rf-text-primary">{headline}</p>}

        <div className="mt-3 border-b border-rf-border-subtle pb-2.5">
          <StepTracker code={code} stages={stages} activeStageKey={stageKey} />
        </div>
      </header>

      <div className="flex-1">
        <StageRenderer manifest={manifest} fixture={fixture} />
      </div>

      <StageActionBar
        code={code}
        stageKey={stageKey}
        ctaLabel={actionEligibility.ctaLabel}
        canConfirm={actionEligibility.canConfirm}
        blockedReason={actionEligibility.blockedReason}
      />
    </div>
  );
}

/**
 * `key={`${code}/${stageKey}/${retryToken}`}` below forces a fresh mount of StagePageContent for
 * every workflow/stage pair, so navigating between stages starts that component's state clean at
 * "loading" again instead of needing an effect to reset it mid-lifecycle — which no-op renders
 * with stale data in between and which the project's react-hooks lint rules flag as a
 * cascading-render risk. `retryToken` reuses the exact same remount mechanism for a "Try again"
 * click: bumping it forces the same clean "loading" restart a navigation gets, rather than a
 * second, parallel way of resetting fetch state.
 */
export default function StagePage() {
  const { code, stageKey } = useParams();
  const [retryToken, setRetryToken] = useState(0);
  return (
    <StagePageContent
      key={`${code}/${stageKey}/${retryToken}`}
      code={code}
      stageKey={stageKey}
      onRetry={() => setRetryToken((n) => n + 1)}
    />
  );
}
