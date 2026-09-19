import { NavLink, Link } from 'react-router-dom';
import { actionStoryPath } from '@/constants/actionStoriesRoutes';

const STAGE_LABELS = {
  reason: 'Reason',
  analyze: 'Analyze',
  decide: 'Decide',
  execute: 'Execute',
  live: 'Live',
};

const STAGE_ICONS = {
  reason: 'fa-lightbulb',
  analyze: 'fa-magnifying-glass',
  decide: 'fa-scale-balanced',
  execute: 'fa-check',
  live: 'fa-satellite-dish',
};

/**
 * The reason → analyze → decide → execute(→ live) progress strip. Reads its step count from the
 * workflow's own manifest (`stages`, passed in) — S10.6 has a 5th "live" stage, every other
 * workflow has 4 — nothing here assumes a fixed count.
 *
 * Same position and navigation as before (each icon is still a NavLink to that stage's own
 * proposal, "Next" still advances one stage) — only the visual is redrawn: a centered row of large
 * icon roundels per stage, connected by a line, current stage in blue with a glow ring.
 *
 * `stages` is the story's stage RECORDS — `{stage, proposal_id}` — not bare stage keys. Each step
 * links to its OWN proposal, so moving between stages no longer routes through StageRedirect to
 * re-resolve an id the tracker already had in hand.
 */
export default function StepTracker({ code, stages, activeStageKey }) {
  const activeIndex = stages.findIndex((s) => s.stage === activeStageKey);
  // Pure stage-to-stage navigation (Reason -> Analyze -> ...), never a business action — that's
  // StageActionBar's job on decide/execute only. Every stage gets this, matching the reference's
  // own inline "Next" affordance next to "Step N of M"; the last stage has nothing to advance to,
  // so the button is simply absent there rather than disabled.
  const next = stages[activeIndex + 1];

  return (
    <nav aria-label="Stage progress" className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <span aria-hidden="true" />

      <ol className="flex items-start justify-center">
        {stages.map(({ stage: stageKey, proposal_id: proposalId }, i) => {
          const isActive = stageKey === activeStageKey;
          const isPast = activeIndex > i;

          return (
            <li key={stageKey} className="flex items-start">
              <NavLink
                to={actionStoryPath(code, stageKey, proposalId)}
                aria-current={isActive ? 'step' : undefined}
                className="flex w-14 flex-col items-center gap-1.5 rounded-lg pt-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring"
              >
                <span
                  aria-hidden="true"
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-[0_0_0_4px_rgba(37,99,235,0.14)]'
                      : isPast
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-rf-surface-sunken text-rf-text-tertiary'
                  }`}
                >
                  <i
                    className={`fa-solid ${isPast ? 'fa-check' : STAGE_ICONS[stageKey] || 'fa-circle'} text-[11px]`}
                    aria-hidden="true"
                  />
                </span>
                <span
                  className={`text-center text-[11px] ${
                    isActive ? 'font-semibold text-blue-600' : isPast ? 'font-medium text-rf-text-secondary' : 'font-medium text-rf-text-tertiary'
                  }`}
                >
                  {STAGE_LABELS[stageKey] || stageKey}
                </span>
              </NavLink>
              {i < stages.length - 1 && <span aria-hidden="true" className="mt-4 h-px w-16 shrink-0 bg-rf-border-default" />}
            </li>
          );
        })}
      </ol>

      <div className="flex justify-end">
        {next && (
          <Link
            to={actionStoryPath(code, next.stage, next.proposal_id)}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-rf-text-primary px-3 text-[11.5px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring"
          >
            Next
            <i className="fa-solid fa-arrow-right text-[9px]" aria-hidden="true" />
          </Link>
        )}
      </div>
    </nav>
  );
}
