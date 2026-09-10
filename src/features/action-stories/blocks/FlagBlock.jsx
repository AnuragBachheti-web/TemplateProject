import { humanizeSlotName } from './humanizeSlotName';
import { EmptyState, ErrorState } from './BlockStates';

export default function FlagBlock({ slotName, data }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (typeof data !== 'boolean') {
    return <ErrorState slotName={slotName} message={`expected true/false, got ${typeof data}`} />;
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-rf-border-subtle bg-rf-surface-canvas px-4 py-3">
      <span className="text-[12.5px] font-medium text-rf-text-secondary">{humanizeSlotName(slotName)}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${
          data
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
            : 'bg-rf-surface-sunken text-rf-text-tertiary'
        }`}
      >
        {data ? 'Yes' : 'No'}
      </span>
    </div>
  );
}
