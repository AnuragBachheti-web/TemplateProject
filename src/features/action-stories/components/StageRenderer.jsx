import { useState } from 'react';
import { resolveBinding } from '@/features/action-stories/manifests/resolveBinding';
import { validateBlockData } from '@/features/action-stories/manifests/blockTypes';
import { BLOCK_REGISTRY } from '@/features/action-stories/blocks';
import { humanizeSlotName } from '@/features/action-stories/blocks/humanizeSlotName';
import { findNearestStep } from '@/features/action-stories/blocks/sliderSteps';

function BlockPlaceholder({ slotName, reason }) {
  return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
      <span className="font-semibold">{humanizeSlotName(slotName)}</span> — {reason}
    </div>
  );
}

// A short/scalar block (a one-line text value, a number, a flag, a small object with only a
// handful of fields) is cheap to read at a glance, but StageRenderer used to stack every block
// full-width in one plain vertical column regardless — a stage full of these renders as a wall of
// giant, nearly-empty cards (see extraction/audit.js's B.1/B.2 checks: this is exactly the "0 of 5
// orders created" / "Suggest" / "n/a" screen). Consecutive blocks like this are grouped into a
// responsive grid row instead; anything richer (table/series/itemQueue/labelValueList/slider, or a
// placeholder) still gets its own full-width row, in its original position.
function isGridEligible(blockType, value) {
  if (blockType === 'text' || blockType === 'number' || blockType === 'flag') return true
  if (blockType === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value).length <= 3
  }
  return false
}

function groupIntoRows(items) {
  const rows = []
  let currentGrid = null
  for (const item of items) {
    if (item.gridEligible) {
      if (!currentGrid) {
        currentGrid = { type: 'grid', items: [] }
        rows.push(currentGrid)
      }
      currentGrid.items.push(item)
    } else {
      currentGrid = null
      rows.push({ type: 'single', item })
    }
  }
  return rows
}

/**
 * Renders one stage's manifest against its fixture data: resolve each block's binding (Part 2's
 * resolveBinding, never throws), validate the resolved value against its declared blockType
 * (Part 2's validateBlockData), and hand it to whichever component the block registry has for
 * that type.
 *
 * An unknown blockType, or a binding that resolves to nothing, never crashes the page and never
 * disappears silently — both render a visibly labeled placeholder and log a console warning, so a
 * bad manifest entry is loud during development instead of an invisible gap in production.
 *
 * `sliderPositions` and `overrides` are the only cross-block state in this renderer. A slider
 * block (SliderBlock.jsx) is a plain, stateless function like every other block — StageRenderer
 * owns its current position, and derives what any *other* block on the same screen should show
 * instead of its real resolved value by looking up the nearest precomputed `steps` entry (see
 * findNearestStep). All of it is local React state: reset the moment you navigate away (StagePage
 * remounts per stage), never persisted, never sent anywhere. No workflow uses this today; it
 * exists for the day a Decide-stage "simulate" slider has real data to bind to (see
 * manifests/REPORT.md).
 */
export default function StageRenderer({ manifest, fixture }) {
  const [sliderPositions, setSliderPositions] = useState({}); // slotName -> current numeric value
  const [overrides, setOverrides] = useState({}); // slotName -> value to show instead of the real one

  function handleSliderChange(slotName, sliderConfig, nextValue) {
    setSliderPositions((prev) => ({ ...prev, [slotName]: nextValue }));
    const nearest = findNearestStep(sliderConfig.steps, nextValue);
    if (nearest) {
      const linkedValues = { ...nearest };
      delete linkedValues.at;
      setOverrides((prev) => ({ ...prev, ...linkedValues }));
    }
  }

  const items = manifest.blocks.map((block) => {
    const resolved = resolveBinding(block.binding, fixture);
    let value = overrides[block.slotName] !== undefined ? overrides[block.slotName] : resolved;

    if (block.blockType === 'slider' && value && sliderPositions[block.slotName] !== undefined) {
      value = { ...value, value: sliderPositions[block.slotName] };
    }

    const Component = BLOCK_REGISTRY[block.blockType];

    if (!Component) {
      const reason = `unknown block type "${block.blockType}"`;
      console.warn(`[StageRenderer] ${manifest.code}/${manifest.stageKey} "${block.slotName}": ${reason}`);
      return { key: block.slotName, gridEligible: false, node: <BlockPlaceholder key={block.slotName} slotName={block.slotName} reason={reason} /> };
    }

    if (value === undefined) {
      const reason = `binding "${block.binding}" resolved to nothing`;
      console.warn(`[StageRenderer] ${manifest.code}/${manifest.stageKey} "${block.slotName}": ${reason}`);
      return { key: block.slotName, gridEligible: false, node: <BlockPlaceholder key={block.slotName} slotName={block.slotName} reason={reason} /> };
    }

    const problems = validateBlockData(block.blockType, value);
    if (problems.length > 0) {
      const reason = problems.join('; ');
      console.warn(`[StageRenderer] ${manifest.code}/${manifest.stageKey} "${block.slotName}": ${reason}`);
      return { key: block.slotName, gridEligible: false, node: <BlockPlaceholder key={block.slotName} slotName={block.slotName} reason={reason} /> };
    }

    if (block.blockType === 'slider') {
      return {
        key: block.slotName,
        gridEligible: false,
        node: (
          <Component
            key={block.slotName}
            slotName={block.slotName}
            data={value}
            onChange={(next) => handleSliderChange(block.slotName, value, next)}
          />
        ),
      };
    }

    return {
      key: block.slotName,
      gridEligible: isGridEligible(block.blockType, value),
      node: <Component key={block.slotName} slotName={block.slotName} data={value} />,
    };
  });

  const rows = groupIntoRows(items);

  return (
    <div className="flex flex-col gap-3 p-6">
      {rows.map((row, i) =>
        row.type === 'single' ? (
          row.item.node
        ) : (
          <div key={`grid-${i}`} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {row.items.map((item) => item.node)}
          </div>
        ),
      )}
    </div>
  );
}
