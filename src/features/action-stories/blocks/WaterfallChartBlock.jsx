import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip } from 'recharts';
import { humanizeSlotName } from './humanizeSlotName';
import { parseMagnitude } from './chartGeometry';
import { positiveColor, negativeColor, neutralColor } from './chartPalette';
import { EmptyState, ErrorState } from './BlockStates';

/**
 * Recharts has no native waterfall/bridge chart — the standard technique is a stacked bar pair per
 * category: an invisible `base` segment sized to the row's own cumulative `top`, plus the visible
 * `height` segment floating on top of it. Color comes from the *sign of the row's own `value`*
 * (parsed via parseMagnitude), never from a leftover `fill`/`valueTone` the mockup happened to
 * carry — an anchor/total row (`anchor: true`) gets the neutral color regardless of its value's
 * sign, since it's a running total, not a delta.
 */
export default function WaterfallChartBlock({ slotName, data }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (!Array.isArray(data)) {
    return <ErrorState slotName={slotName} message={`expected an array, got ${typeof data}`} />;
  }
  if (data.length === 0) {
    return <EmptyState slotName={slotName} message="No data points." />;
  }

  const rows = data.map((item, i) => ({
    label: item?.label ?? String(i + 1),
    base: Number(item?.top),
    delta: Number(item?.height),
    display: item?.value,
    anchor: item?.anchor === true,
  }));

  if (!rows.some((r) => Number.isFinite(r.base) && Number.isFinite(r.delta))) {
    return <ErrorState slotName={slotName} message="no usable top/height numbers in this chart's data" />;
  }

  return (
    <div className="rounded-lg border border-rf-border-subtle bg-rf-surface-canvas p-3">
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-rf-text-tertiary">
        {humanizeSlotName(slotName)}
      </p>
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={40} />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Tooltip
              formatter={(_, __, item) => [item?.payload?.display ?? '', '']}
              labelFormatter={(label) => label}
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
            />
            <Bar dataKey="base" stackId="bridge" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="delta" stackId="bridge" radius={[2, 2, 2, 2]} isAnimationActive={false}>
              {rows.map((row, i) => {
                const signed = parseMagnitude(row.display);
                const color = row.anchor ? neutralColor : Number.isFinite(signed) && signed < 0 ? negativeColor : positiveColor;
                return <Cell key={i} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
