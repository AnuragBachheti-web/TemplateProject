import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getWorkflowIndex, getStageData } from '@/services/actionStoriesService';
import { resolveBinding } from '@/features/action-stories/manifests/resolveBinding';
import StepTracker from '@/features/action-stories/components/StepTracker';
import StageRenderer from '@/features/action-stories/components/StageRenderer';
import StageActionBar from '@/features/action-stories/components/StageActionBar';

function StagePageContent({ code, stageKey }) {
  const [state, setState] = useState({ status: 'loading', workflow: null, manifest: null, fixture: null, error: null });

  useEffect(() => {
    let cancelled = false;

    Promise.all([getWorkflowIndex(), getStageData(code, stageKey)])
      .then(([index, { manifest, fixture }]) => {
        if (cancelled) return;
        const workflow = index.find((wf) => wf.code === code) || null;
        setState({ status: 'ready', workflow, manifest, fixture, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', workflow: null, manifest: null, fixture: null, error });
      });

    return () => {
      cancelled = true;
    };
  }, [code, stageKey]);

  if (state.status === 'loading') {
    return <div className="p-6 text-[13px] text-rf-text-secondary">Loading…</div>;
  }

  if (state.status === 'error') {
    return (
      <div className="p-6 text-[13px] text-rose-600">
        Couldn&rsquo;t load {code}/{stageKey}: {state.error.message}
      </div>
    );
  }

  const { workflow, manifest, fixture } = state;
  const stages = workflow?.stages || [stageKey];

  const ctaBlock = manifest.blocks.find((b) => b.slotName === 'guardrail_cta_label');
  const ctaLabel = ctaBlock ? resolveBinding(ctaBlock.binding, fixture) : undefined;

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-rf-border-subtle bg-rf-surface-canvas px-6 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-rf-text-tertiary">{code}</p>
        <h1 className="text-[18px] font-semibold text-rf-text-primary">{workflow?.name || manifest.name}</h1>
        <div className="mt-3">
          <StepTracker code={code} stages={stages} activeStageKey={stageKey} />
        </div>
      </header>

      <div className="flex-1">
        <StageRenderer manifest={manifest} fixture={fixture} />
      </div>

      <StageActionBar code={code} stageKey={stageKey} ctaLabel={ctaLabel} />
    </div>
  );
}

/**
 * `key={`${code}/${stageKey}`}` below forces a fresh mount of StagePageContent for every
 * workflow/stage pair, so navigating between stages starts that component's state clean at
 * "loading" again instead of needing an effect to reset it mid-lifecycle — which no-op renders
 * with stale data in between and which the project's react-hooks lint rules flag as a
 * cascading-render risk.
 */
export default function StagePage() {
  const { code, stageKey } = useParams();
  return <StagePageContent key={`${code}/${stageKey}`} code={code} stageKey={stageKey} />;
}
