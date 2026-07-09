import { EyeAnalysis } from "./ai.service";
import {
  DIAMETER_BY_DENSITY,
  FAN_TYPE_BY_DENSITY,
  STYLE_CURL_BY_EYE_SHAPE,
  ZONE_LENGTHS_MM,
  ZoneName,
} from "./lashMapRules.data";

export interface VisualMapZone {
  zone: ZoneName;
  length_mm: number;
  direction: "outward" | "vertical";
}

export interface GeneratedLashMap {
  style: string;
  curl: string;
  lengths: Record<ZoneName, number>;
  diameter: string;
  fan_type: string;
  visual_map: { zones: VisualMapZone[] };
}

const ZONE_ORDER: ZoneName[] = ["inner", "inner_mid", "center", "outer_mid", "outer"];

/**
 * Turns an AI-classified eye analysis into a fully deterministic LashMap by looking
 * up /docs/lash-rules.md-derived tables — never freeform AI guesswork for the
 * technical values. See lashMapRules.data.ts for the placeholder tables in use.
 */
export function generateLashMap(eyeAnalysis: Pick<EyeAnalysis, "eye_shape" | "lash_density">): GeneratedLashMap {
  const { style, curl } = STYLE_CURL_BY_EYE_SHAPE[eyeAnalysis.eye_shape];
  const lengths = ZONE_LENGTHS_MM[style];
  const diameter = DIAMETER_BY_DENSITY[eyeAnalysis.lash_density];
  const fanType = FAN_TYPE_BY_DENSITY[eyeAnalysis.lash_density];

  const zones: VisualMapZone[] = ZONE_ORDER.map((zone) => ({
    zone,
    length_mm: lengths[zone],
    direction: zone === "center" ? "vertical" : "outward",
  }));

  return {
    style,
    curl,
    lengths,
    diameter,
    fan_type: fanType,
    visual_map: { zones },
  };
}
