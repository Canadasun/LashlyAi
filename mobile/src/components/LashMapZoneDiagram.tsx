import { Fragment } from 'react';
import Svg, { Line, Polygon, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme/colors';
import { VisualMapZone } from '../types/api';

const WIDTH = 300;
const HEIGHT = 160;
const BASELINE_Y = 140;
const ZONE_X: Record<VisualMapZone['zone'], number> = {
  inner: 30,
  inner_mid: 90,
  center: 150,
  outer_mid: 210,
  outer: 270,
};
const LENGTH_SCALE = 6;
const TILT = 0.35; // horizontal lean per px of height, away from center

/**
 * Minimal v1 zone diagram: one "spike" line per zone, tip tilted inward/outward to
 * suggest lash direction, with a small arrowhead. Doesn't need to be fancy per the
 * brief — just inner-to-outer spike lengths and direction at a glance.
 */
export function LashMapZoneDiagram({ zones }: { zones: VisualMapZone[] }) {
  return (
    <Svg width={WIDTH} height={HEIGHT}>
      <Line x1={10} y1={BASELINE_Y} x2={WIDTH - 10} y2={BASELINE_Y} stroke={colors.text} strokeWidth={2} />
      {zones.map((zone) => {
        const x = ZONE_X[zone.zone];
        const height = zone.length_mm * LENGTH_SCALE;
        const lean = zone.direction === 'vertical' ? 0 : x < WIDTH / 2 ? -height * TILT : height * TILT;
        const tipX = x + lean;
        const tipY = BASELINE_Y - height;
        const arrowSize = 6;

        return (
          <Fragment key={zone.zone}>
            <Line x1={x} y1={BASELINE_Y} x2={tipX} y2={tipY} stroke={colors.primary} strokeWidth={3} />
            <Polygon
              points={`${tipX - arrowSize},${tipY + arrowSize} ${tipX + arrowSize},${tipY + arrowSize} ${tipX},${tipY - arrowSize}`}
              fill={colors.accent}
            />
            <SvgText x={x} y={BASELINE_Y + 16} fontSize={9} fill={colors.text} textAnchor="middle">
              {zone.length_mm}mm
            </SvgText>
          </Fragment>
        );
      })}
    </Svg>
  );
}
