import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
} from 'recharts';
import { humanizeSlotName } from './humanizeSlotName';
import { EmptyState, ErrorState } from './BlockStates';

const BRAND_BLUE = '#2E6BFF';

function toNumber(v) {
  return typeof v === 'number' ? v : Number(v);
}

/**
 * The mockups' own sparkline paths are plain "M x0 y0 L x1 y1 L x2 y2 …" strings — already real
 * (x, y) data, just wrapped for an SVG this app doesn't draw by hand. Parsed back into points
 * instead of drawn as a raw <path>, so it becomes a real, hoverable chart. SVG y grows downward,
 * so y is flipped here — otherwise a rising trend would visually plot as falling.
 */
function parseSvgPathPoints(path) {
  const segments = path.match(/[ML]\s*-?[\d.]+\s+-?[\d.]+/gi) || [];
  return segments.map((seg, i) => {
    const [x, y] = seg.slice(1).trim().split(/\s+/).map(Number);
    return { i, x, y: -y };
  });
}

function LinePathChart({ path, slotName }) {
  const points = parseSvgPathPoints(path);
  if (points.length === 0) {
    return <ErrorState slotName={slotName} message="couldn't read this chart's path data" />;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
        <XAxis dataKey="i" hide />
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Tooltip
          labelFormatter={() => ''}
          formatter={(v) => [Number(v).toFixed(1), '']}
          contentStyle={{ fontSize: 11, borderRadius: 6 }}
        />
        <Line type="monotone" dataKey="y" stroke={BRAND_BLUE} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MagnitudeBarChart({ points, slotName }) {
  if (!points.some((p) => Number.isFinite(p.value))) {
    return <ErrorState slotName={slotName} message="no usable numbers in this chart's data" />;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={points} margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
        <XAxis dataKey="i" hide />
        <YAxis hide domain={[0, 'dataMax']} />
        <Tooltip formatter={(v) => [v, '']} labelFormatter={() => ''} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
        <Bar dataKey="value" fill={BRAND_BLUE} radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ScatterPointsChart({ points, slotName }) {
  if (!points.some((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
    return <ErrorState slotName={slotName} message="no usable coordinates in this chart's data" />;
  }
  // A point's own `r` (radius) — e.g. a bubble-chart dot sized by volume/importance — is real
  // plot data, not decoration; when every point carries one, size the bubbles by it instead of
  // drawing uniform dots. Recharts' ZAxis expects a *range* of rendered bubble areas (px²), not a
  // radius directly, so the raw r values just need to vary — the range below is a reasonable
  // fixed span across whatever r values are actually present.
  const hasRadius = points.every((p) => Number.isFinite(p.r));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
        <XAxis type="number" dataKey="x" hide domain={['dataMin', 'dataMax']} />
        <YAxis type="number" dataKey="y" hide domain={['dataMin', 'dataMax']} />
        {hasRadius && <ZAxis type="number" dataKey="r" range={[16, 200]} />}
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
        <Scatter data={points} fill={BRAND_BLUE} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/**
 * Chart data comes in three shapes across these fixtures (see manifests/REPORT.md /
 * extraction/classifyBlocks.js): a raw SVG path string, an array of bare numbers/magnitudes
 * (bars), or an array of coordinate objects (a scatter of {x,y}/{cx,cy} points).
 */
export default function SeriesBlock({ slotName, data }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (typeof data !== 'string' && !Array.isArray(data)) {
    return <ErrorState slotName={slotName} message={`expected chart data, got ${typeof data}`} />;
  }
  if (data.length === 0) {
    return <EmptyState slotName={slotName} message="No data points." />;
  }

  let body;
  if (typeof data === 'string') {
    body = <LinePathChart path={data} slotName={slotName} />;
  } else if (data.every((v) => typeof v === 'number' || typeof v === 'string')) {
    const points = data.map((v, i) => ({ i, value: toNumber(v) }));
    body = <MagnitudeBarChart points={points} slotName={slotName} />;
  } else {
    const first = data.find((item) => item && typeof item === 'object') || {};
    if ('h' in first || 'value' in first) {
      const points = data.map((item, i) => ({ i, value: toNumber(item.h ?? item.value) }));
      body = <MagnitudeBarChart points={points} slotName={slotName} />;
    } else {
      const points = data.map((item) => ({
        x: toNumber(item.x ?? item.cx),
        y: toNumber(item.y ?? item.cy),
        ...(item.r !== undefined ? { r: toNumber(item.r) } : {}),
      }));
      body = <ScatterPointsChart points={points} slotName={slotName} />;
    }
  }

  return (
    <div className="rounded-lg border border-rf-border-subtle bg-rf-surface-canvas p-3">
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-rf-text-tertiary">
        {humanizeSlotName(slotName)}
      </p>
      <div className="h-20 w-full">{body}</div>
    </div>
  );
}
