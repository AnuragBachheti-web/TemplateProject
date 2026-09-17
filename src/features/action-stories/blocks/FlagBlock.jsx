import { humanizeSlotName } from './humanizeSlotName';
import { BlockCard } from './BlockCard';
import { EmptyState, ErrorState } from './BlockStates';
import Badge from '../ui/Badge';

function Pill({ data }) {
  return <Badge tone={data ? 'success' : 'neutral'}>{data ? 'Yes' : 'No'}</Badge>;
}

/** @param {boolean} [compact] - see TextBlock.jsx's own doc comment for what this means and why. */
export default function FlagBlock({ slotName, data, compact }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (typeof data !== 'boolean') {
    return <ErrorState slotName={slotName} message={`expected true/false, got ${typeof data}`} />;
  }

  if (compact) {
    return (
      <div className="flex min-w-0 items-center justify-between gap-3 py-[7px]">
        <span className="min-w-0 truncate text-[12px] text-rf-text-secondary">{humanizeSlotName(slotName)}</span>
        <Pill data={data} />
      </div>
    );
  }

  return (
    <BlockCard padding="compact" className="flex items-center justify-between">
      <h3 className="text-[12.5px] font-medium text-rf-text-secondary">{humanizeSlotName(slotName)}</h3>
      <Pill data={data} />
    </BlockCard>
  );
}
