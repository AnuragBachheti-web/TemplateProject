import { useActionStoriesStore } from '@/store/useActionStoriesStore';

/**
 * The decorative Confirm/Approve/Start button on a decide/execute stage. Purely local UI state —
 * no backend call, no ledger entry exists yet. See useActionStoriesStore's TODO for the real
 * mutation this becomes once one exists.
 */
export default function StageActionBar({ code, stageKey, ctaLabel }) {
  const isConfirmed = useActionStoriesStore((s) => s.isStageConfirmed(code, stageKey));
  const confirmStage = useActionStoriesStore((s) => s.confirmStage);

  if (stageKey !== 'decide' && stageKey !== 'execute') return null;

  const label = ctaLabel || (stageKey === 'decide' ? 'Approve' : 'Start');

  return (
    <div className="flex items-center justify-end gap-3 border-t border-rf-border-subtle bg-rf-surface-canvas px-6 py-3">
      {isConfirmed && <span className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400">Confirmed</span>}
      <button
        type="button"
        disabled={isConfirmed}
        onClick={() => confirmStage(code, stageKey)}
        className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors ${
          isConfirmed
            ? 'cursor-default bg-rf-surface-sunken text-rf-text-tertiary'
            : 'bg-rf-brand-blue-500 text-white hover:bg-rf-brand-blue-600'
        }`}
      >
        {isConfirmed ? 'Done' : label}
      </button>
    </div>
  );
}
