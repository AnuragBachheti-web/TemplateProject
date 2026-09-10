import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { humanizeSlotName } from './humanizeSlotName';
import { parseMagnitude } from './chartGeometry';
import { categoricalColor } from './chartPalette';
import { EmptyState, ErrorState } from './BlockStates';

const MAGNITUDE_KEYS = ['value', 'h', 'height', 'pct', 'amount'];

export default function BarChartBlock({ slotName, data }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (!Array.isArray(data)) {
    return <ErrorState slotName={slotName} message={`expected an array, got ${typeof data}`} />;
  }
  if (data.length === 0) {
    return <EmptyState slotName={slotName} message="No data points." />;
  }

  // Two shapes: a bare array of numbers/numeric strings (unlabeled — a bare index per bar), or an
  // array of { label, value|h|height|pct|amount } rows. The original formatted string (e.g.
  // "$26.3K") is what the tooltip shows; parseMagnitude only ever feeds the plotted bar height.
  let points;
  if (data.every((item) => item === null || typeof item !== 'object')) {
    points = data.map((v, i) => ({ label: String(i + 1), display: v, magnitude: parseMagnitude(v) }));
  } else {
    points = data.map((item, i) => {
      const rawKey = MAGNITUDE_KEYS.find((k) => item?.[k] !== undefined);
      const raw = rawKey ? item[rawKey] : undefined;
      return { label: item?.label ?? String(i + 1), display: raw, magnitude: parseMagnitude(raw) };
    });
  }

  if (!points.some((p) => Number.isFinite(p.magnitude))) {
    return <ErrorState slotName={slotName} message="no usable numbers in this chart's data" />;
  }

  return (
    <div className="rounded-lg border border-rf-border-subtle bg-rf-surface-canvas p-3">
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-rf-text-tertiary">
        {humanizeSlotName(slotName)}
      </p>
      <div className="h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
            <XAxis dataKey="label" hide={points.length > 8} tick={{ fontSize: 9.5 }} />
            <YAxis hide domain={[0, 'dataMax']} />
            <Tooltip
              formatter={(_, __, item) => [item?.payload?.display ?? '', '']}
              labelFormatter={(label) => label}
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
            />
            <Bar dataKey="magnitude" fill={categoricalColor(0)} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
