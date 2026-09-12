import { useState } from 'react';
import { resolveBinding } from '@/features/action-stories/manifests/resolveBinding';
import { validateBlockData } from '@/features/action-stories/manifests/blockTypes';
import { BLOCK_REGISTRY } from '@/features/action-stories/blocks';
import { humanizeSlotName } from '@/features/action-stories/blocks/humanizeSlotName';
import { findNearestStep } from '@/features/action-stories/blocks/sliderSteps';
import BlockErrorBoundary from '@/features/action-stories/blocks/BlockErrorBoundary';
import { composeSections } from '@/features/action-stories/layout/composeSections';
import StageSections from '@/features/action-stories/components/StageSections';

/** A block's binding is always `data.<rawKey>` — this is the fixture's own field name, independent
 * of whatever slotName vocabulary renaming a manifest applied to it. */
function rawKeyOf(binding) {
  return typeof binding === 'string' && binding.startsWith('data.') ? binding.slice('data.'.length) : binding;
}

function BlockPlaceholder({ slotName, reason }) {
  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
      <span className="font-semibold">{humanizeSlotName(slotName)}</span> — {reason}
    </div>
  );
}

/**
 * Every slotName that should render its `compact` variant (a bare label/value row, or a card-less
 * chart/list, instead of its own bordered card) — anything sharing a row with siblings inside a
 * shared panel, wherever that panel ends up: every block composeSections placed in the `rail`
 * region (a lone item there still nests inside that section's one shared panel, never a second,
 * redundant border-within-a-border), plus every block that's part of a `grid`-type row in EITHER
 * region — a heuristic metric-strip (GridPanel) or an explicitly-authored composed panel
 * (ComposedPanel; see StageSections.jsx) both already provide the shared card, so their own members
 * render bare.
 */
function computeCompactSlots({ main, rail }) {
  const compact = new Set();
  for (const section of rail) {
    for (const row of section.rows) {
      if (row.type === 'grid') row.items.forEach((item) => compact.add(item.slotName));
      else compact.add(row.slotName);
    }
  }
  for (const section of main) {
    for (const row of section.rows) {
      if (row.type === 'grid') row.items.forEach((item) => compact.add(item.slotName));
    }
  }
  return compact;
}

/**
 * Renders one stage's manifest against its fixture data: resolve each block's binding (Part 2's
 * resolveBinding, never throws), validate the resolved value against its declared blockType
 * (Part 2's validateBlockData), and hand it to whichever component the block registry has for
 * that type.
 *
 * StageRenderer owns exactly that data pipeline — binding, validation, registry lookup, error
 * isolation, and the slider cross-block state below — and nothing about *layout*. Composition
 * (which blocks share a row, which section they belong to) is delegated to composeSections.js (a
 * pure function) + StageSections.jsx (the presentational component that turns its output into DOM)
 * — see those files' own doc comments for why that split exists (AUDIT_REPORT.md §18/§25: a layout
 * heuristic is a different *kind* of concern from this file's data-pipeline orchestration, and
 * letting it grow here risked a second god-component responsibility on top of the first).
 *
 * Runs in two passes on purpose: the first resolves/validates every block and builds the
 * *metadata* composeSections needs (no JSX yet); composeSections then decides the section/row
 * structure; only then does the second pass build each block's actual node, now knowing whether it
 * should render `compact` (grouped with siblings inside one shared panel) or as its own full card.
 * A block can't know this about itself — it's a property of its neighbors and its section, which
 * is exactly the kind of decision this file delegates to the layout layer rather than owning.
 *
 * An unknown blockType, or a binding that resolves to nothing, never crashes the page and never
 * disappears silently — both render a visibly labeled placeholder and log a console warning, so a
 * bad manifest entry is loud during development instead of an invisible gap in production. A
 * genuine JS exception thrown *inside* a block's own render (not a validation failure this
 * pipeline already caught, but a real bug — a Recharts edge case, a null-deref) is caught too: every
 * block is wrapped in its own BlockErrorBoundary, so one bad block shows a small inline error
 * instead of white-screening the whole stage (AUDIT_REPORT.md §14/§24 P0 #1).
 *
 * `sliderPositions` and `overrides` are the only cross-block state in this renderer. A slider
 * block (SliderBlock.jsx) is a plain, stateless function like every other block — StageRenderer
 * owns its current position, and derives what any *other* block on the same screen should show
 * instead of its real resolved value by looking up the nearest precomputed `steps` entry (see
 * findNearestStep). All of it is local React state: reset the moment you navigate away (StagePage
 * remounts per stage), never persisted, never sent anywhere.
 *
 * `overrides` is keyed by RAW FIXTURE KEY (see rawKeyOf above), not by slotName — a `steps` entry
 * (`{at, ...rawKey: itsValueAtThatPosition}`) is extraction-time data (see
 * extraction/dcLogicSandbox.js's computeControlPayload), generated before any manifest-level
 * slotName renaming happens, so matching overrides by the block's own binding rather than its
 * slotName is what keeps this correct regardless of whether a particular field happened to get a
 * vocabulary rename. DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §9/§11: this mechanism used to be fully
 * wired but never exercised by real data (0 of 105 fixtures ever produced a `{min,max,value}`
 * slider shape) — extraction now measures and populates real `steps` for every real slider found in
 * the reference corpus (S9.11/S9.2/S9.12's own Decide-stage controls), so dragging one now actually
 * recomputes its real dependent blocks.
 *
 * Every manifest block renders here, in place — including a `role: "hero"` block (see
 * layout/heroSlot.js's HERO_SLOT_NAMES, and classifyBlocks.js's `planSections`), which is no longer
 * plucked out of the body and duplicated into the page header as a stand-in subtitle. That old
 * mechanism conflated two different problems — "this stage's own headline deserves prominent
 * treatment" and "the page needs a per-instance subtitle" — with one hack; FORENSIC_AUDIT_S9.1.md
 * §6 traces why. The two are solved separately now: a hero block gets real in-place prominence via
 * its own section's `region: "main"` (see classifyBlocks.js's `recommendation` section) and
 * TextBlock's existing hero visual treatment, while the page header's subtitle is the Action
 * Story's own real, extracted `headline` field (see StagePage.jsx) — never fixture content
 * standing in for it.
 */
export default function StageRenderer({ manifest, fixture }) {
  const [sliderPositions, setSliderPositions] = useState({}); // slotName -> current numeric value
  const [overrides, setOverrides] = useState({}); // slotName -> value to show instead of the real one

  function handleSliderChange(slotName, sliderConfig, nextValue) {
    setSliderPositions((prev) => ({ ...prev, [slotName]: nextValue }));
    const nearest = findNearestStep(sliderConfig.steps, nextValue);
    if (nearest) {
      const linkedValues = { ...nearest };
      delete linkedValues.at;
      setOverrides((prev) => ({ ...prev, ...linkedValues }));
    }
  }

  // Pass 1 — resolve + validate every block; no JSX yet, just enough metadata for composeSections.
  const resolvedBlocks = manifest.blocks.map((block) => {
    const rawResolved = resolveBinding(block.binding, fixture);
    const override = overrides[rawKeyOf(block.binding)];
    let value = override !== undefined ? override : rawResolved;
    if (block.blockType === 'slider' && value && sliderPositions[block.slotName] !== undefined) {
      value = { ...value, value: sliderPositions[block.slotName] };
    }

    const Component = BLOCK_REGISTRY[block.blockType];
    let placeholderReason = null;
    if (!Component) {
      placeholderReason = `unknown block type "${block.blockType}"`;
    } else if (value === undefined) {
      placeholderReason = `binding "${block.binding}" resolved to nothing`;
    } else {
      const problems = validateBlockData(block.blockType, value);
      if (problems.length > 0) placeholderReason = problems.join('; ');
    }

    if (placeholderReason) {
      console.warn(`[StageRenderer] ${manifest.code}/${manifest.stageKey} "${block.slotName}": ${placeholderReason}`);
    }

    return { block, Component, value, placeholderReason };
  });

  const layoutItems = resolvedBlocks.map(({ block, value, placeholderReason }) => ({
    slotName: block.slotName,
    blockType: block.blockType,
    layout: block.layout,
    section: block.section,
    region: block.region,
    value,
    forceFullWidth: Boolean(placeholderReason) || block.blockType === 'slider',
  }));

  const sections = composeSections(layoutItems, manifest.sections);
  const compactSlots = computeCompactSlots(sections);

  // Pass 2 — build each block's actual node, now that compact-ness is known.
  const nodesBySlot = {};
  for (const { block, Component, value, placeholderReason } of resolvedBlocks) {
    if (placeholderReason) {
      nodesBySlot[block.slotName] = <BlockPlaceholder slotName={block.slotName} reason={placeholderReason} />;
      continue;
    }

    if (block.blockType === 'slider') {
      nodesBySlot[block.slotName] = (
        <BlockErrorBoundary slotName={block.slotName} blockType={block.blockType}>
          <Component
            slotName={block.slotName}
            data={value}
            onChange={(next) => handleSliderChange(block.slotName, value, next)}
          />
        </BlockErrorBoundary>
      );
      continue;
    }

    nodesBySlot[block.slotName] = (
      <BlockErrorBoundary slotName={block.slotName} blockType={block.blockType}>
        <Component slotName={block.slotName} data={value} compact={compactSlots.has(block.slotName)} role={block.role} />
      </BlockErrorBoundary>
    );
  }

  return <StageSections sections={sections} nodesBySlot={nodesBySlot} />;
}
