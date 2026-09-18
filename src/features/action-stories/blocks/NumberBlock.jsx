import { humanizeSlotName } from './humanizeSlotName';
import { formatValue, isTypedNumber } from './formatValue';
import { BlockCard, BlockTitle } from './BlockCard';
import { EmptyState, ErrorState } from './BlockStates';
import { cellText } from './cellText';

/**
 * Renders a bare number OR a typed business number (`{value, unit, precision?}`).
 *
 * All display formatting happens here, via formatValue — the currency symbol, the thousands
 * separators, the decimal places, whether 18400 compacts to "$18.4K". The backend sends the
 * magnitude and its unit and makes none of those decisions, which is what stops a locale or a
 * precision change from needing a backend deploy.
 *
 * @param {boolean} [compact] - see TextBlock.jsx's own doc comment for what this means and why.
 */
export default function NumberBlock({ slotName, data, compact }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  const typed = isTypedNumber(data);
  if (!typed && (typeof data !== 'number' || !Number.isFinite(data))) {
    return <ErrorState slotName={slotName} message={`expected a number, got ${typeof data}`} />;
  }
  const display = formatValue(typed ? data : { value: data, unit: 'count' });

  if (compact) {
    return (
      <div className="flex min-w-0 items-baseline justify-between gap-3 py-[7px]">
        <span {...cellText('identifier', humanizeSlotName(slotName), 'text-[12px] text-rf-text-secondary')}>{humanizeSlotName(slotName)}</span>
        <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-rf-text-primary">{display}</span>
      </div>
    );
  }

  return (
    <BlockCard padding="compact">
      <BlockTitle>{humanizeSlotName(slotName)}</BlockTitle>
      <p className="mt-1 font-mono text-[14px] font-semibold text-rf-text-primary">{display}</p>
    </BlockCard>
  );
}
