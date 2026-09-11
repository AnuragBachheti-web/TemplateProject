import { humanizeSlotName } from './humanizeSlotName';
import { BlockCard, BlockTitle } from './BlockCard';
import { EmptyState, ErrorState } from './BlockStates';

/** @param {boolean} [compact] - see TextBlock.jsx's own doc comment for what this means and why. */
export default function NumberBlock({ slotName, data, compact }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (typeof data !== 'number' || !Number.isFinite(data)) {
    return <ErrorState slotName={slotName} message={`expected a number, got ${typeof data}`} />;
  }

  if (compact) {
    return (
      <div className="flex min-w-0 items-baseline justify-between gap-3 py-[7px]">
        <span className="min-w-0 truncate text-[12px] text-rf-text-secondary">{humanizeSlotName(slotName)}</span>
        <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-rf-text-primary">{data.toLocaleString()}</span>
      </div>
    );
  }

  return (
    <BlockCard padding="compact">
      <BlockTitle>{humanizeSlotName(slotName)}</BlockTitle>
      <p className="mt-1 font-mono text-[14px] font-semibold text-rf-text-primary">{data.toLocaleString()}</p>
    </BlockCard>
  );
}
