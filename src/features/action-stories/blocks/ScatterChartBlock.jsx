import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip } from 'recharts';
import { humanizeSlotName } from './humanizeSlotName';
import { toNumber } from './chartGeometry';
import { categoricalColor } from './chartPalette';
import { EmptyState, ErrorState } from './BlockStates';

export default function ScatterChartBlock({ slotName, data }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (!Array.isArray(data)) {
    return <ErrorState slotName={slotName} message={`expected an array, got ${typeof data}`} />;
  }
  if (data.length === 0) {
    return <EmptyState slotName={slotName} message="No data points." />;
  }

  const points = data.map((item) => ({
    x: toNumber(item?.x ?? item?.cx),
    y: toNumber(item?.y ?? item?.cy),
    ...(item?.r !== undefined ? { r: toNumber(item.r) } : {}),
  }));

  if (!points.some((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
    return <ErrorState slotName={slotName} message="no usable coordinates in this chart's data" />;
  }

  // A point's own `r` (radius) — e.g. a bubble sized by volume/importance — is real plot data, not
  // decoration; when every point carries one, size the bubbles by it instead of drawing uniform
  // dots. Recharts' ZAxis expects a *range* of rendered bubble areas (px²), not a radius directly,
  // so the raw r values just need to vary — the range below is a reasonable fixed span across
  // whatever r values are actually present.
  const hasRadius = points.every((p) => Number.isFinite(p.r));

  return (
    <div className="rounded-lg border border-rf-border-subtle bg-rf-surface-canvas p-3">
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-rf-text-tertiary">
        {humanizeSlotName(slotName)}
      </p>
      <div className="h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
            <XAxis type="number" dataKey="x" hide domain={['dataMin', 'dataMax']} />
            <YAxis type="number" dataKey="y" hide domain={['dataMin', 'dataMax']} />
            {hasRadius && <ZAxis type="number" dataKey="r" range={[16, 200]} />}
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
            <Scatter data={points} fill={categoricalColor(0)} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
