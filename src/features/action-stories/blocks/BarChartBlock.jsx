import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip } from 'recharts';
import { humanizeSlotName } from './humanizeSlotName';
import { parseMagnitude } from './chartGeometry';
import { categoricalColor, positiveColor, negativeColor } from './chartPalette';
import { BlockCard, BlockTitle } from './BlockCard';
import { EmptyState, ErrorState } from './BlockStates';

const MAGNITUDE_KEYS = ['value', 'h', 'height', 'pct', 'amount'];

/**
 * @param {boolean} [compact] - true when this chart is a member of an explicitly-authored
 *   `layout.group` panel (see composeSections.js/StageSections.jsx's ComposedPanel) — renders the
 *   chart itself without its own nested BlockCard, so a headline + its supporting metrics chart
 *   reads as one shared panel, not a card inside a card (the same problem LabelValueListBlock's own
 *   `compact` already solves for the Guardrails rail — see its doc comment).
 */
export default function BarChartBlock({ slotName, data, compact }) {
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
  //
  // Key selection prefers the first candidate that actually *parses* to a real number, not merely
  // the first one that's present — a row can carry a defined-but-unparseable primary field (e.g.
  // S9.8/reason.readiness's `value: "18 / 25"`, a ratio string extraction/classifyBlocks.js's own
  // classifier already knows to skip in favor of that row's numeric `pct`) alongside a perfectly
  // usable fallback; picking the merely-defined key first would silently plot NaN for that one row
  // instead of the number the classifier saw and trusted when it chose barChart in the first place.
  let points;
  if (data.every((item) => item === null || typeof item !== 'object')) {
    points = data.map((v, i) => ({ label: String(i + 1), display: v, magnitude: parseMagnitude(v) }));
  } else {
    points = data.map((item, i) => {
      const parseableKey = MAGNITUDE_KEYS.find((k) => item?.[k] !== undefined && Number.isFinite(parseMagnitude(item[k])));
      const rawKey = parseableKey ?? MAGNITUDE_KEYS.find((k) => item?.[k] !== undefined);
      const raw = rawKey ? item[rawKey] : undefined;
      return { label: item?.label ?? String(i + 1), display: raw, magnitude: parseMagnitude(raw) };
    });
  }

  if (!points.some((p) => Number.isFinite(p.magnitude))) {
    return <ErrorState slotName={slotName} message="no usable numbers in this chart's data" />;
  }

  // A series that mixes signs (e.g. S10.1/decide.recurrence's all-negative dollar deltas,
  // S9.1/analyze.movement's +3/−7/+5/199 role changes) colors by sign, reusing the same
  // positive/negative status tokens WaterfallChartBlock already established — one color system for
  // "this number is good/bad" across every chart type, not a second one invented here. A
  // single-sign series (the common case) keeps the plain categorical color; coloring every bar the
  // same hue when they're all positive (or all negative) would just be visual noise.
  const hasNegative = points.some((p) => Number.isFinite(p.magnitude) && p.magnitude < 0);
  const hasPositive = points.some((p) => Number.isFinite(p.magnitude) && p.magnitude > 0);
  const colorBySign = hasNegative && hasPositive;

  // Recharts renders plain SVG with no built-in <title>/<desc> — a screen-reader user gets nothing
  // from the chart itself beyond whatever text surrounds it (AUDIT_REPORT.md §16). `role="img"` +
  // a generated label naming every bar (small charts) or the count/range (larger ones) gives an
  // assistive-tech user the same information a sighted user gets from a glance, without needing a
  // full alternate data-table view for every chart.
  const chartLabel =
    points.length <= 8
      ? `Bar chart. ${points.map((p) => `${p.label}: ${p.display ?? p.magnitude}`).join(', ')}.`
      : `Bar chart with ${points.length} bars, ranging from ${Math.min(...points.map((p) => p.magnitude)).toLocaleString()} to ${Math.max(...points.map((p) => p.magnitude)).toLocaleString()}.`;

  // Content-driven height tier, not one fixed size for every context: a chart already sharing a
  // composed panel with a headline/metrics (`compact`) reads at a glance — it doesn't need the
  // same 224px a chart standing alone as this stage's one featured visual does. `h-32` (128px) is
  // still enough to read bar shape/relative magnitude at this data volume; a standalone chart keeps
  // the taller `h-56` so its own axis labels/legend have real room.
  const chart = (
    <div className={compact ? 'h-32 w-full' : 'h-56 w-full'} role="img" aria-label={chartLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 4, right: 10, bottom: 4, left: 6 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval={0}
            angle={points.length > 6 ? -30 : 0}
            textAnchor={points.length > 6 ? 'end' : 'middle'}
            height={points.length > 6 ? 36 : 20}
          />
          {/* A plain [0, 'dataMax'] domain silently clips every negative bar to invisible — the
              domain must always include 0 as the baseline *and* extend to cover a negative
              dataMin when one exists, or a series like S10.1/decide.recurrence (all-negative
              dollar deltas) would render as a flat empty chart. */}
          <YAxis hide domain={[(min) => Math.min(0, min), (max) => Math.max(0, max)]} />
          <Tooltip
            formatter={(_, __, item) => [item?.payload?.display ?? '', '']}
            labelFormatter={(label) => label}
            contentStyle={{ fontSize: 11, borderRadius: 6 }}
          />
          <Bar dataKey="magnitude" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {points.map((p, i) => (
              <Cell
                key={i}
                fill={colorBySign ? (Number.isFinite(p.magnitude) && p.magnitude < 0 ? negativeColor : positiveColor) : categoricalColor(0)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  if (compact) {
    return (
      <div className="py-1.5">
        <p className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-rf-text-tertiary">{humanizeSlotName(slotName)}</p>
        {chart}
      </div>
    );
  }

  return (
    <BlockCard>
      <BlockTitle className="mb-2">{humanizeSlotName(slotName)}</BlockTitle>
      {chart}
    </BlockCard>
  );
}
