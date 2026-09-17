import { parseSvgPathPoints } from './chartGeometry';

/**
 * THE ADMISSION RULE: how many points a chart needs before drawing one is honest.
 *
 * A line through two points is a straight line by construction, not a trend. A bar chart of one bar
 * is a number wearing an axis. Recharts will render either without complaint, and the result looks
 * exactly as authoritative as a chart built on forty points — which is the whole problem. The reader
 * cannot tell from the picture how much evidence is behind it, so the block has to say.
 *
 * FOUR is the threshold: three points can be drawn through by a straight line, a single curve, or a
 * V, and nothing in the shape distinguishes them. The fourth is the first point that can disagree
 * with the trend the first three imply.
 *
 * SHARED, not per-block. Four chart types make this decision and they must make it identically —
 * "the line chart admits thin evidence but the bar chart doesn't" is the inconsistency this exists
 * to prevent, and it is the same reason formatValue.js is one module rather than eighteen.
 *
 * NOT A LICENCE TO HIDE DATA. A thin chart still renders its title and still says how many points it
 * has; what it stops doing is drawing a shape that implies more than it knows.
 */
export const MIN_CHART_POINTS = 4;

/**
 * How many plottable points a chart binding actually carries, across every shape the chart blocks
 * accept — a typed `{x,y}` series, several typed series, an SVG path, several paths, or a bare list.
 *
 * Multi-series takes the LONGEST series rather than the sum: four series of one point each is four
 * points on four different lines, and none of them is a trend.
 */
export function countPoints(data) {
  if (data === null || data === undefined) return 0;
  if (typeof data === 'string') return parseSvgPathPoints(data).length;
  if (!Array.isArray(data) || data.length === 0) return 0;

  const lengthOfSeries = (s) => {
    if (s === null || typeof s !== 'object') return null;
    if (Array.isArray(s.points)) return s.points.length;
    if (typeof s.path === 'string') return parseSvgPathPoints(s.path).length;
    return null;
  };

  const lengths = data.map(lengthOfSeries);
  // Only treat the array as series-of-series when EVERY member is one. A mixed array is a list of
  // points that happens to contain an object with a `points` key, and guessing between the two is
  // the runtime shape-sniffing the block vocabulary exists to avoid.
  if (lengths.every((n) => n !== null)) return Math.max(...lengths);
  return data.length;
}

export function hasEnoughEvidence(data) {
  return countPoints(data) >= MIN_CHART_POINTS;
}
