import { ResponsiveContainer, ScatterChart, Scatter, Cell, XAxis, YAxis, ZAxis, Tooltip } from 'recharts';
import { slotLabel } from './slotLabel';
import { svgYToPlotY, toNumber } from './chartGeometry';
import { categoricalColor } from './chartPalette';
import { BlockCard, BlockTitle } from './BlockCard';
import { EmptyState, ErrorState, ThinEvidenceState } from './BlockStates';
import { countPoints, hasEnoughEvidence } from './chartEvidence';
import { formatValue } from './formatValue';

import { typeRole } from './typeRole';
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
  // The 4-point admission rule (blocks/chartEvidence.js), applied identically by all four chart
  // types. Placed AFTER the empty guard so "no data at all" keeps saying that, and before any
  // geometry, so a thin chart is never drawn and then explained.
  if (!hasEnoughEvidence(data)) {
    return <ThinEvidenceState slotName={slotName} points={countPoints(data)} />;
  }

  // Every point in this data source is a raw SVG/screen-space pixel position lifted straight from
  // the original mockup's own hand-drawn artwork — under `x`/`y` naming (S9.4/analyze.points,
  // S9.9/analyze.ladders) just as much as under `cx`/`cy` (S9.1/analyze.points); there is no
  // "already Cartesian" source in this dataset the key name could distinguish. SVG/screen space
  // grows downward, so every y is flipped via svgYToPlotY — the same one canonical convention
  // LineChartBlock's parseSvgPathPoints already applies, so both chart types agree on which way is
  // "up" instead of diverging (the exact bug this fixes — AUDIT_REPORT.md §7.3).
  const points = data.map((item) => ({
    x: toNumber(item?.x ?? item?.cx),
    y: svgYToPlotY(toNumber(item?.y ?? item?.cy)),
    ...(item?.r !== undefined ? { r: toNumber(item.r) } : {}),
    ...(typeof item?.label === 'string' ? { label: item.label } : {}),
    ...(item?.hue !== undefined ? { hue: item.hue } : {}),
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

  // Categorical hue: every point's own `hue` (a raw mockup CSS value, e.g. "var(--mod-discover)")
  // names a segment, not a color this app's own token system recognizes directly — assigning our
  // own categorical palette color per *distinct* hue value, in first-seen order, preserves the real
  // signal (which points belong together) without smuggling a foreign color value into a
  // theme-reactive chart. Previously every point rendered in one fixed color regardless of `hue`,
  // silently flattening a real segmentation (e.g. S9.1/analyze.points' 6 SKU roles) into an
  // undifferentiated blob (AUDIT_REPORT.md §7.4).
  const hueValues = [...new Set(points.map((p) => p.hue).filter((h) => h !== undefined))];
  const hasHue = hueValues.length > 1;
  const colorForHue = (hue) => categoricalColor(hueValues.indexOf(hue));

  const hasLabel = points.some((p) => p.label);

  const chartLabel = hasHue
    ? `Scatter chart with ${points.length} points across ${hueValues.length} segments.`
    : `Scatter chart with ${points.length} points.`;

  return (
    <BlockCard>
      <BlockTitle>{slotLabel(slotName)}</BlockTitle>
      <div className="h-56 w-full" role="img" aria-label={chartLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 10, bottom: 4, left: 4 }}>
            <XAxis type="number" dataKey="x" hide domain={['dataMin', 'dataMax']} />
            <YAxis type="number" dataKey="y" hide domain={['dataMin', 'dataMax']} />
            {hasRadius && <ZAxis type="number" dataKey="r" range={[16, 260]} />}
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
              formatter={(value, name, item) => {
                if (name === 'y') return [null, null];
                const p = item?.payload;
                if (p?.label) return [p.label, ''];
                return [`(${formatValue(p?.x)}, ${formatValue(p?.y)})`, ''];
              }}
              labelFormatter={() => ''}
            />
            <Scatter data={points} fill={categoricalColor(0)} isAnimationActive={false}>
              {hasHue && points.map((p, i) => <Cell key={i} fill={colorForHue(p.hue)} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {hasHue && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-rf-border-subtle pt-2">
          {hueValues.map((hue, i) => (
            <span key={hue} {...typeRole('micro', 'flex items-center gap-1.5 text-rf-text-secondary')}>
              <span className="h-2 w-2 rounded-full" style={{ background: categoricalColor(i) }} />
              Segment {i + 1}
            </span>
          ))}
        </div>
      )}
      {!hasHue && hasLabel && (
        <p {...typeRole('micro', 'mt-1 text-rf-text-tertiary')}>Hover a point for its label.</p>
      )}
    </BlockCard>
  );
}
