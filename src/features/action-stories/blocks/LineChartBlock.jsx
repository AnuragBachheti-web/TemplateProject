import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { slotLabel } from './slotLabel';
import { parseSvgPathPoints } from './chartGeometry';
import { categoricalColor } from './chartPalette';
import { BlockCard, BlockTitle } from './BlockCard';
import { EmptyState, ErrorState, ThinEvidenceState } from './BlockStates';
import { countPoints, hasEnoughEvidence } from './chartEvidence';
import { formatValue } from './formatValue';

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
  // The 4-point admission rule (blocks/chartEvidence.js), applied identically by all four chart
  // types. Placed AFTER the empty guard so "no data at all" keeps saying that, and before any
  // geometry, so a thin chart is never drawn and then explained.
  if (!hasEnoughEvidence(data)) {
    return <ThinEvidenceState slotName={slotName} points={countPoints(data)} />;
  }

  // Three accepted shapes (see blockTypes.js's validateLineChart). The TYPED forms are the contract;
  // the SVG-path forms exist only so archived corpus fixtures keep rendering. Normalising all three
  // to `{name, points}` here means everything below this line is shape-agnostic.
  const isPoint = (p) => p !== null && typeof p === 'object' && p.x !== undefined && p.y !== undefined;
  let series;
  if (typeof data === 'string') {
    series = [{ name: null, points: parseSvgPathPoints(data) }];
  } else if (data.every(isPoint)) {
    // A bare typed series — the single-series contract shape.
    series = [{ name: null, points: data.map((p) => ({ x: p.x, y: Number(p.y) })) }];
  } else if (data.every((s) => s !== null && typeof s === 'object' && Array.isArray(s.points))) {
    // Multiple typed series.
    series = data.map((s) => ({ name: s.name ?? s.label ?? null, points: s.points.map((p) => ({ x: p.x, y: Number(p.y) })) }));
  } else if (data.every((s) => typeof s?.path === 'string')) {
    series = data.map((s) => ({ name: s.name ?? s.label ?? null, points: parseSvgPathPoints(s.path) }));
  } else {
    return <ErrorState slotName={slotName} message={'expected a typed {x,y} series or an SVG path'} />;
  }

  // Every series is re-indexed onto the same x (point index) so Recharts can overlay them on one
  // shared axis — points across series aren't assumed to already share x-values.
  const seriesPoints = series.map((s) => s.points);
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

  // Chart accessibility fallback (AUDIT_REPORT.md §16) — names the trend(s) and their direction
  // (rising/falling/flat, comparing the first and last plotted point) since Recharts' own SVG
  // carries no text a screen reader can use.
  const chartLabel = series
    .map((s, idx) => {
      const pts = seriesPoints[idx].filter((p) => Number.isFinite(p.y));
      if (pts.length < 2) return `${s.name || s.label || 'Series'}: not enough data to describe a trend.`;
      const delta = pts[pts.length - 1].y - pts[0].y;
      const direction = delta > 0 ? 'rising' : delta < 0 ? 'falling' : 'flat';
      return `${s.name || s.label || 'Series'}: ${direction} trend across ${pts.length} points.`;
    })
    .join(' ');

  return (
    <BlockCard>
      <BlockTitle className="mb-2">{slotLabel(slotName)}</BlockTitle>
      <div className={showLegend ? 'h-64 w-full' : 'h-56 w-full'} role="img" aria-label={`Line chart. ${chartLabel}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={merged} margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
            <XAxis dataKey="i" hide />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Tooltip
              labelFormatter={() => ''}
              formatter={(v) => [formatValue(Number(v)), '']}
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
            />
            {showLegend && <Legend wrapperStyle={{ fontSize: 10.5 }} />}
            {series.map((s, idx) => (
              <Line
                key={idx}
                type="monotone"
                dataKey={`y${idx}`}
                name={s.name || s.label || slotLabel(slotName)}
                stroke={categoricalColor(idx)}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </BlockCard>
  );
}
