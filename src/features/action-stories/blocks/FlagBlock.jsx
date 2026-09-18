import { humanizeSlotName } from './humanizeSlotName';
import { BlockCard } from './BlockCard';
import { EmptyState, ErrorState } from './BlockStates';
import { cellText } from './cellText';
import { flagTone } from './statusTone';

import { typeRole } from './typeRole';
function Pill({ data }) {
  // The tone and the word both come from statusTone (R73's rule, applied to the second instance of
  // the same defect — see flagTone's own comment). This block used to decide both inline.
  const tone = flagTone(data);
  return (
    <span className={`${typeRole('label').className} rounded-full px-2 py-0.5 ${tone.chip}`}>
      {tone.label}
    </span>
  );
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
        <span {...cellText('identifier', humanizeSlotName(slotName), typeRole('body', 'text-rf-text-secondary').className)}>{humanizeSlotName(slotName)}</span>
        <Pill data={data} />
      </div>
    );
  }

  return (
    <BlockCard padding="compact" className="flex items-center justify-between">
      <h3 {...typeRole('body', 'text-rf-text-secondary')}>{humanizeSlotName(slotName)}</h3>
      <Pill data={data} />
    </BlockCard>
  );
}
