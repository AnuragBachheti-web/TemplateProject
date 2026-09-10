import { humanizeSlotName } from './humanizeSlotName';
import { EmptyState, ErrorState } from './BlockStates';

export default function TextBlock({ slotName, data }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (typeof data !== 'string') {
    return <ErrorState slotName={slotName} message={`expected text, got ${typeof data}`} />;
  }
  if (data.trim() === '') {
    return <EmptyState slotName={slotName} message="Empty." />;
  }

  return (
    <div className="rounded-lg border border-rf-border-subtle bg-rf-surface-canvas px-4 py-3">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-rf-text-tertiary">
        {humanizeSlotName(slotName)}
      </p>
      <p className="mt-1 text-[14px] font-medium text-rf-text-primary">{data}</p>
    </div>
  );
}
