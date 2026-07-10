import { EyeAnalysis } from "./ai.service";
import {
  ADVANCED_STYLE_CURL,
  ADVANCED_STYLES,
  AdvancedLashStyle,
  CURL_BUMP,
  DIAMETER_BY_DENSITY,
  FAN_TYPE_BY_DENSITY,
  LashCurl,
  LashTechnique,
  STYLE_CURL_BY_EYE_SHAPE,
  STYLE_LABELS,
  ZONE_LENGTHS_MM,
  ZoneName,
} from "./lashMapRules.data";

export function isAdvancedStyle(value: unknown): value is AdvancedLashStyle {
  return ADVANCED_STYLES.includes(value as AdvancedLashStyle);
}

function isLashTechnique(value: unknown): value is LashTechnique {
  return value === "classic" || value === "wispy";
}

export interface VisualMapZone {
  zone: ZoneName;
  length_mm: number;
  direction: "outward" | "vertical";
}

export interface ZoneRange {
  min: number;
  max: number;
}

export interface ZoneSummary {
  inner: ZoneRange;
  middle: ZoneRange;
  outer: ZoneRange;
}

export interface GeneratedLashMap {
  style: string;
  curl: string;
  lengths: Record<ZoneName, number>;
  diameter: string;
  fan_type: string;
  visual_map: { zones: VisualMapZone[] };
  // Presentation layer (see lashMapRules.data.ts's LashTechnique doc comment) — derived
  // from the fields above via the same deterministic rules tables, never AI guesswork.
  technique: LashTechnique;
  style_label: string;
  curl_label: string;
  spike_lengths?: number[];
  zone_summary: ZoneSummary;
}

const ZONE_ORDER: ZoneName[] = ["inner", "inner_mid", "center", "outer_mid", "outer"];

function range(values: number[]): ZoneRange {
  return { min: Math.min(...values), max: Math.max(...values) };
}

// Splits an ascending-ish list of lengths into Inner/Middle/Outer bands — 2 zones on
// each end, everything else in the middle. Works for both the 5-zone classic case
// (2/1/2) and the 7-point wispy spike case (2/3/2).
function bandify(values: number[]): ZoneSummary {
  const inner = values.slice(0, 2);
  const outer = values.slice(values.length - 2);
  const middle = values.slice(2, values.length - 2);
  return {
    inner: range(inner),
    middle: range(middle.length ? middle : [values[Math.floor(values.length / 2)]]),
    outer: range(outer),
  };
}

// 7 ascending stops spanning the style's true min-to-max zone length, for the
// textured/mixed-length look of a wispy technique — deterministic from the same
// ZONE_LENGTHS_MM table, not freeform.
function buildSpikeLengths(lengths: Record<ZoneName, number>): number[] {
  const values = ZONE_ORDER.map((zone) => lengths[zone]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return Array(7).fill(min);
  return Array.from({ length: 7 }, (_, i) => Math.round(min + ((max - min) * i) / 6));
}

function buildStyleLabel(style: string, technique: LashTechnique): string {
  const baseLabel = STYLE_LABELS[style as keyof typeof STYLE_LABELS] ?? style;
  if (technique === "wispy" && style !== "wispy") {
    return `Wispy ${baseLabel}`;
  }
  return baseLabel;
}

function buildCurlLabel(curl: LashCurl, technique: LashTechnique): string {
  if (technique !== "wispy") return curl;
  const spikeCurl = CURL_BUMP[curl];
  return spikeCurl === curl ? curl : `${curl} + ${spikeCurl} spikes`;
}

/**
 * For lash maps saved before the presentation column existed (migration
 * 0013_lash_map_presentation.sql) — derives the same "classic" presentation fields
 * from the row's existing style/curl/lengths instead of leaving them undefined.
 */
export function deriveClassicPresentation(
  style: string,
  curl: string,
  lengths: Record<ZoneName, number>,
): Pick<GeneratedLashMap, "technique" | "style_label" | "curl_label" | "zone_summary"> {
  return {
    technique: "classic",
    style_label: buildStyleLabel(style, "classic"),
    curl_label: buildCurlLabel(curl as LashCurl, "classic"),
    zone_summary: bandify(ZONE_ORDER.map((zone) => lengths[zone])),
  };
}

/**
 * Turns an AI-classified eye analysis into a fully deterministic LashMap by looking
 * up /docs/lash-rules.md-derived tables — never freeform AI guesswork for the
 * technical values. See lashMapRules.data.ts for the placeholder tables in use.
 *
 * `requestedStyle` lets the artist explicitly ask for one of the named advanced
 * styles (Anime, Medusa, Wet Set, Kim K, Strip Lash Effect) instead of the
 * eye-shape-derived default — those are requested, never auto-derived.
 *
 * `requestedTechnique` is orthogonal to style — "wispy" layers a textured, mixed
 * length/curl look on top of whichever style was resolved above (e.g. style Cat Eye +
 * technique wispy -> "Wispy Cat Eye"), producing the combined style/curl labels and
 * spike lengths. Defaults to "classic" (the plain style, unchanged from before this
 * was added).
 */
export function generateLashMap(
  eyeAnalysis: Pick<EyeAnalysis, "eye_shape" | "lash_density">,
  requestedStyle?: string,
  requestedTechnique?: string,
): GeneratedLashMap {
  const eyeShapeDefault = STYLE_CURL_BY_EYE_SHAPE[eyeAnalysis.eye_shape];

  const style = isAdvancedStyle(requestedStyle) ? requestedStyle : eyeShapeDefault.style;
  const curl = isAdvancedStyle(requestedStyle) ? ADVANCED_STYLE_CURL[requestedStyle] : eyeShapeDefault.curl;
  const lengths = ZONE_LENGTHS_MM[style];
  const diameter = DIAMETER_BY_DENSITY[eyeAnalysis.lash_density];
  const fanType = FAN_TYPE_BY_DENSITY[eyeAnalysis.lash_density];
  const technique = isLashTechnique(requestedTechnique) ? requestedTechnique : "classic";

  const zones: VisualMapZone[] = ZONE_ORDER.map((zone) => ({
    zone,
    length_mm: lengths[zone],
    direction: zone === "center" ? "vertical" : "outward",
  }));

  const spikeLengths = technique === "wispy" ? buildSpikeLengths(lengths) : undefined;
  const zoneSummary = bandify(spikeLengths ?? ZONE_ORDER.map((zone) => lengths[zone]));

  return {
    style,
    curl,
    lengths,
    diameter,
    fan_type: fanType,
    visual_map: { zones },
    technique,
    style_label: buildStyleLabel(style, technique),
    curl_label: buildCurlLabel(curl, technique),
    ...(spikeLengths ? { spike_lengths: spikeLengths } : {}),
    zone_summary: zoneSummary,
  };
}
