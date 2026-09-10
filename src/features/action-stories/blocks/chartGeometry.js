// Shared, chart-only parsing helpers — extracted out of the old SeriesBlock.jsx so
// LineChartBlock/BarChartBlock/ScatterChartBlock/WaterfallChartBlock can each import just what
// they need instead of duplicating this math.

export function toNumber(v) {
  return typeof v === 'number' ? v : Number(v);
}

/**
 * The mockups' own sparkline paths are plain "M x0 y0 L x1 y1 L x2 y2 …" strings — already real
 * (x, y) data, just wrapped for an SVG this app doesn't draw by hand. Parsed back into points
 * instead of drawn as a raw <path>, so it becomes a real, hoverable chart. SVG y grows downward,
 * so y is flipped here — otherwise a rising trend would visually plot as falling.
 */
export function parseSvgPathPoints(path) {
  const segments = path.match(/[ML]\s*-?[\d.]+\s+-?[\d.]+/gi) || [];
  return segments.map((seg, i) => {
    const [x, y] = seg.slice(1).trim().split(/\s+/).map(Number);
    return { i, x, y: -y };
  });
}

/**
 * Parses a formatted display string ("$26.3K", "−$2,210", "74px", "5.9%") down to a plottable
 * float — for the *plotted bar height only*; the original string is always what's shown in the
 * tooltip/label, so a lossy parse here never costs display fidelity (unlike the vocabulary-field
 * parsing extraction/generateManifests.js's REPORT.md deliberately avoided — that was about
 * claiming a precise business number; this is only about which of two bars is taller).
 * Returns NaN for anything it can't make sense of.
 */
export function parseMagnitude(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const match = value.trim().match(/^([+\-−]?)[^\d]*?([\d,]+(?:\.\d+)?)\s*([KkMm%]?)(?:px)?$/);
  if (!match) return NaN;
  const [, sign, digits, suffix] = match;
  let n = Number(digits.replace(/,/g, ''));
  if (!Number.isFinite(n)) return NaN;
  if (suffix === 'K' || suffix === 'k') n *= 1_000;
  if (suffix === 'M' || suffix === 'm') n *= 1_000_000;
  if (sign === '-' || sign === '−') n = -n;
  return n;
}
