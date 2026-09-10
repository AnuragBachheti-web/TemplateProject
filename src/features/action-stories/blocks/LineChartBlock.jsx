import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { humanizeSlotName } from './humanizeSlotName';
import { parseSvgPathPoints } from './chartGeometry';
import { categoricalColor } from './chartPalette';
import { EmptyState, ErrorState } from './BlockStates';

/**
 * A single path draws one line, no legend (the block's own title already names it — see the
 * dataviz skill's rule: "a single series needs no legend box"). An array of `{ path, name?, tone? }`
 * draws one `<Line>` per entry, categorically colored in the fixed slot order (never by value/rank)
 * — a legend appears automatically once there's more than one series.
 */
export default function LineChartBlock({ slotName, data }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (typeof data !== 'string' && !Array.isArray(data)) {
    return <ErrorState slotName={slotName} message={`expected an SVG path string or an array of series, got ${typeof data}`} />;
  }
  if (Array.isArray(data) && data.length === 0) {
    return <EmptyState slotName={slotName} message="No data points." />;
  }

  const series = typeof data === 'string' ? [{ name: null, path: data }] : data;
  const invalid = series.some((s) => typeof s?.path !== 'string');
  if (invalid) {
    return <ErrorState slotName={slotName} message={'expected each series to have a string "path"'} />;
  }

  // Every series is re-indexed onto the same x (point index) so Recharts can overlay them on one
  // shared axis — points across series aren't assumed to already share x-values.
  const seriesPoints = series.map((s) => parseSvgPathPoints(s.path));
  if (seriesPoints.every((pts) => pts.length === 0)) {
    return <ErrorState slotName={slotName} message="couldn't read this chart's path data" />;
  }
  const pointCount = Math.max(...seriesPoints.map((pts) => pts.length));
  const merged = Array.from({ length: pointCount }, (_, i) => {
    const row = { i };
    seriesPoints.forEach((pts, s) => {
      row[`y${s}`] = pts[i]?.y;
    });
    return row;
  });

  const showLegend = series.length > 1;

  return (
    <div className="rounded-lg border border-rf-border-subtle bg-rf-surface-canvas p-3">
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-rf-text-tertiary">
        {humanizeSlotName(slotName)}
      </p>
      <div className={showLegend ? 'h-24 w-full' : 'h-20 w-full'}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={merged} margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
            <XAxis dataKey="i" hide />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Tooltip
              labelFormatter={() => ''}
              formatter={(v) => [Number(v).toFixed(1), '']}
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
            />
            {showLegend && <Legend wrapperStyle={{ fontSize: 10.5 }} />}
            {series.map((s, idx) => (
              <Line
                key={idx}
                type="monotone"
                dataKey={`y${idx}`}
                name={s.name || humanizeSlotName(slotName)}
                stroke={categoricalColor(idx)}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
