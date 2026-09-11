import { humanizeSlotName } from './humanizeSlotName';
import { BlockCard, BlockTitle } from './BlockCard';
import { EmptyState, ErrorState } from './BlockStates';

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isSliderShaped(data) {
  return (
    isPlainObject(data) &&
    typeof data.min === 'number' &&
    typeof data.max === 'number' &&
    typeof data.value === 'number'
  );
}

/**
 * A *controlled* slider: it holds no state of its own. StageRenderer owns the current position
 * (alongside the `overrides` it derives from `findNearestStep`) and passes it down as `data.value`
 * — the same "resolve once, hand it a plain value" contract every other block already follows.
 * That's deliberate, not an oversight: every other block in this registry is a plain function with
 * no hooks, which is exactly what lets StageRenderer's own tests and this project's block tests
 * call a block directly as a function and inspect what it returns, with no DOM or React renderer
 * involved. Giving this one block internal state would make it the only one that can't be tested
 * that way.
 *
 * @param {(next: number) => void} [props.onChange] - called with the new value on every drag.
 */
export default function SliderBlock({ slotName, data, onChange }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (!isSliderShaped(data)) {
    return <ErrorState slotName={slotName} message="expected { min, max, value }" />;
  }

  const unit = data.unit || '';
  const label = data.label || humanizeSlotName(slotName);

  return (
    <BlockCard padding="compact">
      <BlockTitle>{label}</BlockTitle>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-[24px] font-bold text-emerald-600">
          {data.value}
          {unit}
        </span>
        {data.note && <span className="text-[11.5px] text-rf-text-tertiary">{data.note}</span>}
      </p>

      <input
        type="range"
        min={data.min}
        max={data.max}
        step={data.step || 1}
        value={data.value}
        onChange={(event) => onChange?.(Number(event.target.value))}
        aria-label={label}
        aria-valuetext={`${data.value}${unit}`}
        className="mt-3 w-full accent-emerald-600"
      />

      <div className="mt-1 flex items-center justify-between text-[10.5px] text-rf-text-tertiary">
        <span>{data.scaleLabels?.min ?? `${data.min}${unit}`}</span>
        {data.scaleLabels?.mid && <span>{data.scaleLabels.mid}</span>}
        <span>{data.scaleLabels?.max ?? `${data.max}${unit}`}</span>
      </div>
    </BlockCard>
  );
}
