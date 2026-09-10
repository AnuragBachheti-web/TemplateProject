import { humanizeSlotName } from './humanizeSlotName';
import { EmptyState, ErrorState } from './BlockStates';

export default function NumberBlock({ slotName, data }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (typeof data !== 'number' || !Number.isFinite(data)) {
    return <ErrorState slotName={slotName} message={`expected a number, got ${typeof data}`} />;
  }

  return (
    <div className="rounded-lg border border-rf-border-subtle bg-rf-surface-canvas px-4 py-3">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-rf-text-tertiary">
        {humanizeSlotName(slotName)}
      </p>
      <p className="mt-1 font-mono text-[14px] font-semibold text-rf-text-primary">{data.toLocaleString()}</p>
    </div>
  );
}
