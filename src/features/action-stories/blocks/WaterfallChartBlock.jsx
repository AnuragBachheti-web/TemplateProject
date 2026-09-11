import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip } from 'recharts';
import { humanizeSlotName } from './humanizeSlotName';
import { parseMagnitude } from './chartGeometry';
import { positiveColor, negativeColor, neutralColor } from './chartPalette';
import { BlockCard, BlockTitle } from './BlockCard';
import { EmptyState, ErrorState } from './BlockStates';

/**
 * Recharts has no native waterfall/bridge chart — the standard technique is a stacked bar pair per
 * category: an invisible `base` segment sized to the row's own cumulative `top`, plus the visible
 * `height` segment floating on top of it. Color comes from the *sign of the row's own `value`*
 * (parsed via parseMagnitude), never from a leftover `fill`/`valueTone` the mockup happened to
 * carry — an anchor/total row (`anchor: true`) gets the neutral color regardless of its value's
 * sign, since it's a running total, not a delta.
 */
export default function WaterfallChartBlock({ slotName, data }) {
  if (data === null || data === undefined) {
    return <EmptyState slotName={slotName} />;
  }
  if (!Array.isArray(data)) {
    return <ErrorState slotName={slotName} message={`expected an array, got ${typeof data}`} />;
  }
  if (data.length === 0) {
    return <EmptyState slotName={slotName} message="No data points." />;
  }

  const rows = data.map((item, i) => ({
    label: item?.label ?? String(i + 1),
    base: Number(item?.top),
    delta: Number(item?.height),
    display: item?.value,
    anchor: item?.anchor === true,
    // `tag` ("unexpected"/"our action"/"expected") and `sublabel` are real per-bar context the
    // source mockup carried alongside the bridge geometry — S10.1/analyze.bars' own reason for
    // *why* a variance driver moved. Previously read by nothing in this component and lost
    // entirely (AUDIT_REPORT.md §7.5); surfaced in the tooltip below instead.
    tag: typeof item?.tag === 'string' ? item.tag : undefined,
    sublabel: typeof item?.sublabel === 'string' ? item.sublabel : undefined,
  }));

  if (!rows.some((r) => Number.isFinite(r.base) && Number.isFinite(r.delta))) {
    return <ErrorState slotName={slotName} message="no usable top/height numbers in this chart's data" />;
  }

  const chartLabel = `Waterfall chart. ${rows.map((r) => `${r.label}: ${r.display ?? ''}`).join(', ')}.`;

  return (
    <BlockCard>
      <BlockTitle className="mb-2">{humanizeSlotName(slotName)}</BlockTitle>
      <div className="h-64 w-full" role="img" aria-label={chartLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 10, bottom: 4, left: 6 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={44} />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Tooltip
              formatter={(_, __, item) => {
                const p = item?.payload;
                if (!p) return [null, null];
                const context = [p.sublabel, p.tag].filter(Boolean).join(' · ');
                return [context ? `${p.display} — ${context}` : p.display, ''];
              }}
              labelFormatter={(label) => label}
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
            />
            <Bar dataKey="base" stackId="bridge" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="delta" stackId="bridge" radius={[2, 2, 2, 2]} isAnimationActive={false}>
              {rows.map((row, i) => {
                const signed = parseMagnitude(row.display);
                const color = row.anchor ? neutralColor : Number.isFinite(signed) && signed < 0 ? negativeColor : positiveColor;
                return <Cell key={i} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </BlockCard>
  );
}
