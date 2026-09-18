/**
 * Presentational-only: turns composeSections.js's already-computed `{ main, rail }` region/section/
 * row structure into DOM. Deliberately "dumb" — no binding, no validation, no grouping/region
 * decisions happen here (composeSections.js owns all of that now — see its own doc comment for the
 * region-resolution order), so it can't grow into a second god component the way StageRenderer.jsx
 * was trending toward (AUDIT_REPORT.md §18/§25's own warning). `nodesBySlot` supplies the actual
 * rendered (already ErrorBoundary-wrapped, already `compact`-aware) block element for each slotName;
 * this component only arranges them.
 *
 * Two-column composition, taken directly from the reference design system's own mockups (every
 * `S*-*.dc.html` stage screen uses a `1fr 320px` main-content + contextual-rail split): a "main"
 * section renders in the wide left column, a "rail" section in the narrow right column — which
 * region a section belongs to is now a property of the section itself (`region`, declared by the
 * manifest, or the legacy name-based fallback for an older manifest — see composeSections.js), never
 * assumed here from the section's id/name (FORENSIC_AUDIT_S9.1.md §1/§5/§9/§19: that assumption is
 * exactly what used to send a stage's own headline to the rail merely because it classified as a
 * scalar `text` block).
 *
 * Two distinct "grid row" treatments, by ORIGIN (not by content), reflecting two different
 * authoring intents:
 *   - a HEURISTIC row (composeSections' own scalar/small-object adjacency fallback — no manifest
 *     ever asked for this explicitly) renders as `GridPanel`: a tight metric-strip, N short values
 *     divided by hairlines, sized evenly by how many share the row.
 *   - an EXPLICIT row (the manifest declared a real `layout.group`, e.g. fusing a headline with
 *     its supporting metrics chart and a proportional mix bar into one recommendation panel) renders
 *     as `ComposedPanel`: a vertical narrative stack, each member spanning its own declared width out
 *     of a 12-column grid (`layout.span`), no forced hairline rhythm — this is FIX #2/#3/#7's
 *     composition primitive: "a thin wrapper that arranges already-rendered blocks; no block needs
 *     to know it's inside one."
 * A THIRD row shape, `flow` (composeSections.js's `packFlowables` — the successor task's mixed-
 * width composition model): non-scalar blocks with no explicit relationship to each other, but each
 * individually compact enough (by a generic, data-driven width heuristic — see layout/blockSizing.js)
 * to genuinely share a row — a 3-column supporting table next to a small chart, two short option
 * cards side by side. Renders as `FlowRow`: each member keeps its OWN card, placed by width in a
 * 12-column grid, never merged into one shared container the way GridPanel/ComposedPanel are.
 * A "single" row (composeSections already decided this block doesn't share a row — either nothing
 * else was compact enough, or it's genuinely full-width content) renders as its own bare div —
 * whatever full-width node the block itself produced (its own BlockCard, unless it's a rail member,
 * which already rendered `compact`).
 */

import { DEPTH_SECTION, depthAttrs } from '@/features/action-stories/blocks/renderDepth';
import { typeRole } from '../blocks/typeRole';
function SectionHeading({ title, className }) {
  if (!title) return null;
  return (
    <h2 className={className ?? typeRole('label', 'text-rf-text-secondary').className}>
      {title}
    </h2>
  );
}

// Column count at the wide breakpoint, by how many siblings actually share this HEURISTIC row — a
// run of 2 gets 2 columns, 3 gets 3, 4+ settles at a comfortable 4 and wraps to another row past
// that, rather than ever squeezing more than 4 short values across one line. Unrelated to
// `layout.span` (see ComposedPanel below) — a heuristic row never carries authored span intent.
const WIDE_COLS_CLASS = { 1: '', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3' };

/**
 * A run of heuristically-grouped siblings as one shared panel with dividers — the metric-strip
 * pattern. Uses the SECONDARY surface tier (`rf-surface-raised`, a faint tint below white) rather
 * than the PRIMARY white `rf-surface-canvas` ComposedPanel/BlockCard use — a run of small metadata
 * scalars is supporting context, not this stage's primary content, and now reads that way at a
 * glance instead of every panel on the page competing for the identical visual weight.
 */
function GridPanel({ row, nodesBySlot }) {
  const wideColsClass = WIDE_COLS_CLASS[row.items.length] ?? 'lg:grid-cols-4';
  return (
    <div
      data-grid-panel
      className={`grid grid-cols-1 divide-y divide-rf-border-subtle overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface-raised px-4 shadow-xs sm:grid-cols-2 sm:divide-y-0 sm:divide-x sm:px-0 ${wideColsClass}`}
    >
      {row.items.map(({ slotName }) => (
        <div key={slotName} data-block-slot={slotName} className="min-w-0 sm:px-4 sm:py-3">
          {nodesBySlot[slotName]}
        </div>
      ))}
    </div>
  );
}

/**
 * An explicitly-authored `layout.group` as one shared panel — a headline, a supporting chart, a
 * proportional bar, all fused into one narrative unit (the reference's Decide-stage "recommendation"
 * card is exactly this shape). Members stack top to bottom in manifest order; each occupies its own
 * declared `span` out of a 12-column grid (defaulting to a full-width 12, i.e. its own row) — a
 * `span: 6` member shares its row with a sibling `span: 6` (or two `span: 6`s land side by side),
 * unlike GridPanel's fixed even-column layout. No hairline dividers between members (this is one
 * continuous narrative, not a checklist) — generous vertical spacing instead.
 */
function ComposedPanel({ row, nodesBySlot }) {
  return (
    <div data-composed-panel className="rounded-2xl border border-rf-border-subtle bg-rf-surface-canvas p-4 shadow-xs">
      <div className="grid grid-cols-12 gap-x-4 gap-y-2">
        {row.items.map(({ slotName, span }) => (
          <div key={slotName} data-block-slot={slotName} className="min-w-0" style={{ gridColumn: `span ${span} / span ${span}` }}>
            {nodesBySlot[slotName]}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A heuristic "grid" row that only ever had ONE eligible member (nothing to actually group it
 * with — e.g. `display_mode` on a stage with no other scalar) used to still render through
 * GridPanel's full bordered/shadowed card treatment: a full-width panel around one already-compact
 * bare row (RENDERED_UI_FORENSIC_AUDIT.md §3.7, confirmed on S9.1/Analyze — a single word,
 * "Suggest", in its own ~60px bordered panel). A lone scalar gets a lightweight tinted strip
 * instead — real visual presence (it doesn't vanish into the page), never a card-sized box for
 * one value. Never applies to an EXPLICIT (authored) group of 1, which is a deliberate composition
 * choice, not a heuristic fallback with nothing better to do.
 */
function LoneScalarStrip({ slotName, nodesBySlot }) {
  // The SECONDARY surface tier, same reasoning as GridPanel above — `rf-surface-sunken` (the page
  // canvas's own background) would make this strip visually disappear into the page around it,
  // exactly the opposite of "real visual presence" this component exists for.
  return <div data-block-slot={slotName} className="rounded-lg bg-rf-surface-raised px-3 py-1">{nodesBySlot[slotName]}</div>;
}

/**
 * A `type: 'flow'` row (composeSections.js's `packFlowables`) — two or more otherwise-unrelated,
 * non-scalar blocks (a table, an itemQueue, a chart, a large object) that a generic width heuristic
 * decided are individually compact enough to genuinely SHARE a row, unlike an authored
 * `layout.group` (one continuous narrative, ComposedPanel) or the scalar metric-strip (GridPanel,
 * one shared card). Each member keeps its OWN full card/table/chart treatment — they're placed side
 * by side by width, never merged into one shared container, because unlike a GridPanel/ComposedPanel
 * run these blocks were never declared to belong together, only sized to fit together. `min-w-0` on
 * each cell lets a table's own internal scroll-shadow do its job instead of forcing the row wider
 * than its column. Falls back to one column per row below `sm:` (12 → 1, per the responsive
 * requirement) — nothing here ever causes horizontal page overflow.
 */
function FlowRow({ row, nodesBySlot }) {
  return (
    // `data-pack-row` marks a row the packer PAIRED, so a test can assert the 1d rule against the
    // DOM rather than only against the packer's return value. One column below `lg:` — ruling C4's
    // "below 1280 every span collapses to full", expressed as the grid simply not splitting.
    // THE VERTICAL CONTRACT (Phase 5D, ruling R66): the two cells stretch to equal height — which a
    // grid already does — AND the block's card fills the cell it was given, which it did not. Before
    // this, S10.2/reason's paired row had two 277px cells holding a 277px card and a 235px card:
    // 42px of dead space inside the shorter one, with the next row starting past both.
    //
    // `[&>*]:h-full` is the layout layer telling the cell's child to fill it, and it stays on THIS
    // side of the boundary deliberately — a block still does not know it is in a packed row, exactly
    // as it does not know its own span. Content inside the card stays top-aligned, so the extra
    // height reads as card padding rather than as a gap between two cards.
    //
    // The reference justifies stretch over content-sizing: its own two-column row
    // (S10.1-1-reason.dc.html:248, `grid-template-columns:1fr 1fr`) uses the default stretch and
    // renders two equal-height cards.
    <div data-pack-row className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {row.items.map(({ slotName, span }) => (
        <div key={slotName} data-block-slot={slotName} className="min-w-0 lg:h-full lg:[&>*]:h-full" style={{ gridColumn: `span ${span} / span ${span}` }}>
          {nodesBySlot[slotName]}
        </div>
      ))}
    </div>
  );
}

function Row({ row, nodesBySlot }) {
  if (row.type === 'single') return <div data-block-slot={row.slotName}>{nodesBySlot[row.slotName]}</div>;
  if (row.type === 'flow') return <FlowRow row={row} nodesBySlot={nodesBySlot} />;
  if (row.type === 'grid' && !row.explicit && row.items.length === 1) {
    return <LoneScalarStrip slotName={row.items[0].slotName} nodesBySlot={nodesBySlot} />;
  }
  return row.explicit ? <ComposedPanel row={row} nodesBySlot={nodesBySlot} /> : <GridPanel row={row} nodesBySlot={nodesBySlot} />;
}

function MainRows({ rows, nodesBySlot }) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <Row key={row.type === 'single' ? row.slotName : `row-${i}`} row={row} nodesBySlot={nodesBySlot} />
      ))}
    </div>
  );
}

/**
 * A rail section (Guardrails/Summary/...): one shared panel; every member already renders
 * `compact`. Secondary surface tier (`rf-surface-raised`) — the rail is inherently contextual/
 * supporting information, never this stage's primary content, and now visually reads that way
 * against the main column's white, stronger-surfaced panels.
 */
/**
 * `data-block-slot` is emitted on every slot's own wrapper, in both regions.
 *
 * Which BLOCK TYPE rendered was already observable (`data-block-type`); which SLOT it rendered for
 * was not, and that is the thing the density budgets and the no-duplicate-fact rule are about. A
 * rail holding four panels made of nine blocks and a rail holding four blocks are different screens,
 * and without this they look identical from the DOM.
 */
function RailPanel({ section, nodesBySlot }) {
  const slots = section.rows.flatMap((row) => (row.type === 'grid' ? row.items.map((i) => i.slotName) : [row.slotName]));
  return (
    <section aria-label={section.title ?? undefined} className="rounded-2xl border border-rf-border-subtle bg-rf-surface-raised p-4 shadow-xs">
      {/* Same semantic level as a main-column section (<h2>, under the page's own <h1>) even though
          it's styled lighter here — a rail panel is structurally a section too, not a lesser thing
          a screen-reader user navigating by heading should have to guess at. */}
      {section.title && (
        <SectionHeading
          title={section.title}
          {...typeRole('label', 'mb-1 text-rf-text-secondary')}
        />
      )}
      <div className="flex flex-col divide-y divide-rf-border-subtle">
        {slots.map((slotName) => (
          <div key={slotName} data-block-slot={slotName}>{nodesBySlot[slotName]}</div>
        ))}
      </div>
    </section>
  );
}

/**
 * @param {{ main: Array, rail: Array }} sections - composeSections.js's output: which section goes
 *   in which region is already decided; this component only lays the two regions out.
 * @param {Record<string, ReactNode>} nodesBySlot - slotName -> the block's rendered node.
 */
export default function StageSections({ sections, nodesBySlot }) {
  const { main, rail } = sections;
  // RENDERED_UI_FORENSIC_AUDIT.md §3.9/§8: the 2-column template used to apply unconditionally —
  // even with no `<aside>` ever rendered, CSS still reserved the 300px+gap second column, so a
  // stage with no rail content (Reason/Analyze on a small stage) kept the exact same narrower main
  // width as one that actually has a rail, for no reason. The main column now genuinely reclaims
  // that width when there's nothing to share it with.
  const hasRail = rail.length > 0;

  return (
    // TWO INDEPENDENT SCROLL REGIONS (Phase 5C, invariant I6), which is what the reference builds:
    //   S10.1-1-reason.dc.html:196  flex:1;min-height:0;display:grid;grid-template-columns:1fr 320px;
    //                               grid-template-rows:minmax(0,1fr)
    //   :198 main   min-width:0;min-height:0;overflow-y:auto
    //   :333 aside  min-width:0;min-height:0;overflow-y:auto
    //
    // `lg:grid-rows-[minmax(0,1fr)]` is the part that is easy to leave out and without which none
    // of it works: a grid row defaults to `auto`, which sizes to content, so both columns would
    // grow to their full height and the overflow would never engage no matter what the children
    // declare. Each column then needs `min-h-0` for the same reason one level down.
    //
    // Below `lg:` the two columns collapse to one and this becomes a single ordinary column — the
    // regions stack and the page-level container scrolls them together, which is the honest
    // behaviour at a width that cannot show a rail beside the main content at all.
    //
    // PHASE 5D: `lg:items-start` WAS HERE, and it negated the line it shared. `align-items: start`
    // makes a grid item size to its own CONTENT instead of being stretched to its track — so each
    // region became as tall as everything inside it, `overflow-y: auto` had nothing to scroll (an
    // auto-height box grows rather than scrolling), and the region overflowed the track to be
    // clipped by `main`'s `overflow: hidden`. Measured in Chrome at 1440x700 on S10.2/reason:
    // clientHeight 500, scrollHeight 500, 155px past the track, 86px of content unreachable.
    // Removing it restores the stretch that `minmax(0,1fr)` was written for.
    <div className={`grid h-full min-h-0 grid-cols-1 gap-4 px-6 py-4 lg:grid-rows-[minmax(0,1fr)] ${hasRail ? 'lg:grid-cols-[minmax(0,1fr)_300px]' : ''}`}>
      {/* Rail sections come FIRST in source order — a screen-reader/keyboard user reading linearly
          hits decision-critical context (can I approve? what's blocking?) before the supporting
          analysis, even though `lg:order-2` visually places this column on the right. Source order
          and visual order are deliberately decoupled here via CSS `order`, not the same thing. */}
      {hasRail && (
        <aside
          aria-label="Context"
          data-scroll-region="rail"
          className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto lg:order-2"
        >
          {rail.map((section, i) => (
            <div key={section.id ?? `rail-${i}`} className="shrink-0" {...depthAttrs(DEPTH_SECTION)}>
              <RailPanel section={section} nodesBySlot={nodesBySlot} />
            </div>
          ))}
        </aside>
      )}

      <div data-scroll-region="main" className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto lg:order-1">
        {main.map((section, i) =>
          section.title ? (
            <section
              key={section.id ?? `main-${i}`}
              aria-label={section.title}
              className="flex shrink-0 flex-col gap-2"
              {...depthAttrs(DEPTH_SECTION)}
            >
              <SectionHeading title={section.title} />
              <MainRows rows={section.rows} nodesBySlot={nodesBySlot} />
            </section>
          ) : (
            <div key={`unsectioned-${section.id ?? i}`} className="shrink-0" {...depthAttrs(DEPTH_SECTION)}>
              <MainRows rows={section.rows} nodesBySlot={nodesBySlot} />
            </div>
          ),
        )}
      </div>
    </div>
  );
}
