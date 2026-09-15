// Shared, chart-only parsing helpers — extracted out of the old SeriesBlock.jsx so
// LineChartBlock/BarChartBlock/ScatterChartBlock/WaterfallChartBlock can each import just what
// they need instead of duplicating this math.

export function toNumber(v) {
  return typeof v === 'number' ? v : Number(v);
}

/**
 * Canonical coordinate convention for this module, shared by every chart block that plots a raw
 * SVG-space coordinate straight from the mockup's own hand-drawn layout (a path's `y`, a scatter
 * point's `y`/`cy`): SVG/screen space grows DOWNWARD (y=0 at the top), while Recharts' Cartesian
 * plane — like every other chart axis — grows UPWARD (y=0 at the bottom). Every such raw y must be
 * negated exactly once, at the point it enters a chart block, so a rising trend in the source
 * artwork plots as rising here too. This is the ONE place that conversion is defined; every
 * consumer (LineChartBlock via parseSvgPathPoints, ScatterChartBlock directly) calls this instead
 * of re-deriving its own sign — the previous divergence (LineChartBlock negated, ScatterChartBlock
 * didn't) is exactly what made every raw-coordinate scatter chart render upside down relative to
 * its design (confirmed against S9.1/analyze.points' real cy values, AUDIT_REPORT.md §7.3).
 */
export function svgYToPlotY(y) {
  return -y;
}

/**
 * The mockups' own sparkline paths are plain "M x0 y0 L x1 y1 L x2 y2 …" strings — already real
 * (x, y) data, just wrapped for an SVG this app doesn't draw by hand. Parsed back into points
 * instead of drawn as a raw <path>, so it becomes a real, hoverable chart. See svgYToPlotY above
 * for why y is flipped here — otherwise a rising trend would visually plot as falling.
 */
export function parseSvgPathPoints(path) {
  const segments = path.match(/[ML]\s*-?[\d.]+\s+-?[\d.]+/gi) || [];
  return segments.map((seg, i) => {
    const [x, y] = seg.slice(1).trim().split(/\s+/).map(Number);
    return { i, x, y: svgYToPlotY(y) };
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

/**
 * Turns bridge rows into stacked-bar coordinates. An anchor row stands on the floor at its own full
 * magnitude; a step row floats, starting at the running cumulative and moving by its own signed
 * value. Pure and total — a row whose value will not parse contributes no bar rather than NaN.
 *
 * @param {Array<{label?: string, value?: *, anchor?: boolean}>} rows
 * @returns {Array<{base: number, delta: number}>} one entry per input row, index-aligned.
 */
export function bridgeGeometry(rows) {
  let running = 0;
  return rows.map((row) => {
    const magnitude = parseMagnitude(row.display);
    if (!Number.isFinite(magnitude)) return { base: 0, delta: 0 };
    if (row.anchor) {
      running = magnitude;
      return { base: 0, delta: magnitude };
    }
    const start = running;
    running += magnitude;
    // A negative step is drawn from where it ends up to where it started, so the bar hangs down
    // from the previous level rather than reaching below the axis.
    return magnitude >= 0 ? { base: start, delta: magnitude } : { base: running, delta: -magnitude };
  });
}
