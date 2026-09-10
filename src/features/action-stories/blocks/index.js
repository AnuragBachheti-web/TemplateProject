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
};
