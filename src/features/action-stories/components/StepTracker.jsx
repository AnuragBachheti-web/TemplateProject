import { NavLink, Link } from 'react-router-dom';
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
 *
 * Visual pattern taken directly from the reference mockups (every `S*-*.dc.html` stage screen):
 * a numbered-circle pill per step (checkmark once past, filled with the accent while current,
 * a bare number while upcoming), a short connector between them, "Step N of M" right-aligned.
 */
export default function StepTracker({ code, stages, activeStageKey }) {
  const activeIndex = stages.indexOf(activeStageKey);
  // Pure stage-to-stage navigation (Reason -> Analyze -> ...), never a business action — that's
  // StageActionBar's job on decide/execute only. Every stage gets this, matching the reference's
  // own inline "Next" affordance next to "Step N of M"; the last stage has nothing to advance to,
  // so the button is simply absent there rather than disabled.
  const nextStageKey = stages[activeIndex + 1];

  return (
    <nav aria-label="Stage progress" className="flex items-center gap-0">
      <ol className="flex flex-wrap items-center gap-0">
        {stages.map((stageKey, i) => {
          const isActive = stageKey === activeStageKey;
          const isPast = activeIndex > i;

          return (
            <li key={stageKey} className="flex items-center">
              <NavLink
                to={actionStoryPath(code, stageKey)}
                aria-current={isActive ? 'step' : undefined}
                className={`flex h-[30px] items-center gap-2 rounded-full border pl-[3px] pr-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring ${
                  isActive
                    ? 'border-rf-brand-tint-16 bg-rf-brand-tint-08'
                    : 'border-rf-border-default bg-rf-surface-canvas hover:bg-rf-surface-sunken'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full font-mono text-[9.5px] font-semibold ${
                    isActive
                      ? 'bg-rf-brand-blue-500 text-white'
                      : isPast
                        ? 'bg-rf-surface-raised text-rf-text-secondary'
                        : 'bg-rf-surface-raised text-rf-text-tertiary'
                  }`}
                >
                  {isPast ? <i className="fa-solid fa-check text-[9px]" /> : i + 1}
                </span>
                <span className={`text-[12px] ${isActive ? 'font-semibold text-rf-text-primary' : isPast ? 'font-medium text-rf-text-secondary' : 'font-medium text-rf-text-tertiary'}`}>
                  {STAGE_LABELS[stageKey] || stageKey}
                </span>
              </NavLink>
              {i < stages.length - 1 && <span aria-hidden="true" className="h-px w-4 bg-rf-border-default" />}
            </li>
          );
        })}
      </ol>
      <span className="ml-auto mr-3 font-mono text-[10px] uppercase tracking-[0.12em] text-rf-text-tertiary">
        Step {activeIndex + 1} of {stages.length}
      </span>
      {nextStageKey && (
        <Link
          to={actionStoryPath(code, nextStageKey)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-rf-text-primary px-3.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring"
        >
          Next
          <i className="fa-solid fa-arrow-right text-[10px]" aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
