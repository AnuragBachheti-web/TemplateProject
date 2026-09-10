import { NavLink } from 'react-router-dom';
import { actionStoryPath } from '@/constants/actionStoriesRoutes';

const STAGE_LABELS = {
  reason: 'Reason',
  analyze: 'Analyze',
  decide: 'Decide',
  execute: 'Execute',
  live: 'Live',
};

/**
 * The reason → analyze → decide → execute(→ live) progress strip. Reads its step count from the
 * workflow's own manifest (`stages`, passed in) — S10.6 has a 5th "live" stage, every other
 * workflow has 4 — nothing here assumes a fixed count.
 */
export default function StepTracker({ code, stages, activeStageKey }) {
  const activeIndex = stages.indexOf(activeStageKey);

  return (
    <ol className="flex flex-wrap items-center gap-2">
      {stages.map((stageKey, i) => {
        const isActive = stageKey === activeStageKey;
        const isPast = activeIndex > i;

        return (
          <li key={stageKey} className="flex items-center gap-2">
            <NavLink
              to={actionStoryPath(code, stageKey)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                isActive
                  ? 'bg-rf-brand-blue-500 text-white'
                  : isPast
                    ? 'bg-rf-brand-tint-08 text-rf-brand-indicator'
                    : 'bg-rf-surface-sunken text-rf-text-tertiary'
              }`}
            >
              {i + 1}. {STAGE_LABELS[stageKey] || stageKey}
            </NavLink>
            {i < stages.length - 1 && <span className="h-px w-4 bg-rf-border-default" />}
          </li>
        );
      })}
    </ol>
  );
}
