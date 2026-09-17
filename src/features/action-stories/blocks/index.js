import TextBlock from './TextBlock';
import NumberBlock from './NumberBlock';
import FlagBlock from './FlagBlock';
import LabelValueListBlock from './LabelValueListBlock';
import TableBlock from './TableBlock';
import ItemQueueBlock from './ItemQueueBlock';
import LineChartBlock from './LineChartBlock';
import BarChartBlock from './BarChartBlock';
import ScatterChartBlock from './ScatterChartBlock';
import WaterfallChartBlock from './WaterfallChartBlock';
import HeatmapGridBlock from './HeatmapGridBlock';
import ObjectBlock from './ObjectBlock';
import SliderBlock from './SliderBlock';
import GaugeBlock from './GaugeBlock';
// Phase 3B: four new CONCEPTS, not parity with the 51 slots (I6). Each owns a group of slots that
// were previously rendering through a block that meant something else — see each component's header.
import ChecklistBlock from './ChecklistBlock';
import StatListBlock from './StatListBlock';
import CardSetBlock from './CardSetBlock';
import RosterBlock from './RosterBlock';
// Phase 3C: a chronology. Found by comparing the rendered app against the reference build — the
// reference renders `trigger` as a stacked eyebrow + prose, never as a two-column table.
import TimelineBlock from './TimelineBlock';

/**
 * blockType -> component. Adding a new block type later is one entry here plus one component
 * file — StageRenderer.jsx never changes; it only ever looks a blockType up in this object.
 */
export const BLOCK_REGISTRY = {
  text: TextBlock,
  number: NumberBlock,
  flag: FlagBlock,
  labelValueList: LabelValueListBlock,
  table: TableBlock,
  itemQueue: ItemQueueBlock,
  lineChart: LineChartBlock,
  barChart: BarChartBlock,
  scatterChart: ScatterChartBlock,
  waterfallChart: WaterfallChartBlock,
  heatmapGrid: HeatmapGridBlock,
  object: ObjectBlock,
  slider: SliderBlock,
  gauge: GaugeBlock,
  checklist: ChecklistBlock,
  statList: StatListBlock,
  cardSet: CardSetBlock,
  roster: RosterBlock,
  timeline: TimelineBlock,
};
