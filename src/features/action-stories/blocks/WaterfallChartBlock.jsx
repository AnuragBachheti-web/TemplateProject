import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip } from 'recharts';
import { humanizeSlotName } from './humanizeSlotName';
import { bridgeGeometry, parseMagnitude } from './chartGeometry';
import { positiveColor, negativeColor, neutralColor } from './chartPalette';
import { BlockCard, BlockTitle } from './BlockCard';
import { EmptyState, ErrorState } from './BlockStates';

/**
 * Recharts has no native waterfall/bridge chart — the standard technique is a stacked bar pair per
 * category: an invisible `base` segment that lifts the bar to where it starts, plus the visible
 * `delta` segment floating on top of it.
 *
 * BOTH OF THOSE ARE DERIVED HERE, from the rows' own business values. This block used to read
 * `top`/`height` straight off its data — pre-computed pixel offsets the source mockup happened to
 * carry — which made it the one chart in the system whose contract was drawing instructions rather
 * than business facts. The hygiene pass strips geometry (correctly), so the block could never
 * render at all: 0 of 105 Decision Objects (docs/REFERENCE_TO_TEMPLATE_BLOCK_AUDIT.md §11.3).
 *
 * The business contract is now `{label, value, anchor?}` per row — the same shape BarChartBlock
 * already takes, plus one flag. `anchor: true` marks a row that is an absolute LEVEL (the opening
 * baseline, the closing actual) rather than a step; everything between them accumulates.
 *
 * Color comes from the sign of the row's own `value`, never from a leftover `fill`/`valueTone`;
 * an anchor row is neutral regardless of sign, because a running total is not a delta.
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

  const parsed = data.map((item, i) => ({
    label: item?.label ?? String(i + 1),
    display: item?.value,
    anchor: item?.anchor === true,
    // `tag` ("unexpected"/"our action"/"expected") and `sublabel` are real per-bar context the
    // source mockup carried alongside the bridge geometry — S10.1/analyze.bars' own reason for
    // *why* a variance driver moved. Previously read by nothing in this component and lost
    // entirely (AUDIT_REPORT.md §7.5); surfaced in the tooltip below instead.
    tag: typeof item?.tag === 'string' ? item.tag : undefined,
    sublabel: typeof item?.sublabel === 'string' ? item.sublabel : undefined,
  }));

  const geometry = bridgeGeometry(parsed);
  const rows = parsed.map((row, i) => ({ ...row, ...geometry[i] }));

  if (!rows.some((r) => r.delta !== 0)) {
    return <ErrorState slotName={slotName} message="no usable numbers in this bridge's values" />;
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
