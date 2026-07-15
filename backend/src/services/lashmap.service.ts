import { EyeAnalysis } from "./ai.service";
import {
  ADVANCED_STYLE_CURL,
  ADVANCED_STYLES,
  AdvancedLashStyle,
  CURL_BUMP,
  DIAMETER_BY_DENSITY,
  FAN_TYPE_BY_DENSITY,
  isLashSetOption,
  isLashStyleOption,
  LASH_SET_CURL,
  LASH_SET_DIAMETERS_MM,
  LASH_SET_LABELS,
  LASH_SET_ZONE_LENGTHS_MM,
  LASH_STYLE_LABELS,
  LashCurl,
  LashSetOption,
  LashStyleOption,
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
  // New, additive axis (see lashMapRules.data.ts) — only set when the artist picks a
  // Lash Set / Lash Style from the mobile UI's replacement for the old Style (Pro) /
  // Technique pickers.
  lash_set?: LashSetOption;
  lash_style?: LashStyleOption;
  lash_set_label?: string;
  lash_style_label?: string;
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
  requestedLashSet?: string,
  requestedLashStyle?: string,
): GeneratedLashMap {
  const eyeShapeDefault = STYLE_CURL_BY_EYE_SHAPE[eyeAnalysis.eye_shape];
  const lashSet = isLashSetOption(requestedLashSet) ? requestedLashSet : undefined;
  const lashStyle = isLashStyleOption(requestedLashStyle) ? requestedLashStyle : undefined;

  // A recognized Lash Set takes precedence over the legacy eye-shape/advanced-style
  // derivation below — it's a direct artist choice, same precedence rule the old
  // requestedStyle already had over the eye-shape default.
  const legacyStyle = isAdvancedStyle(requestedStyle) ? requestedStyle : eyeShapeDefault.style;
  const legacyCurl = isAdvancedStyle(requestedStyle)
    ? ADVANCED_STYLE_CURL[requestedStyle]
    : eyeShapeDefault.curl;

  const style: string = lashSet ?? legacyStyle;
  const curl: LashCurl = lashSet ? LASH_SET_CURL[lashSet] : legacyCurl;
  const lengths = lashSet ? LASH_SET_ZONE_LENGTHS_MM[lashSet] : ZONE_LENGTHS_MM[legacyStyle];
  // A chosen Lash Set determines diameter first, when the owner has provided one
  // (LASH_SET_DIAMETERS_MM) — e.g. Megavolume needs 0.02-0.03mm regardless of the
  // client's natural lash density, and a density-only lookup would never produce that.
  // Falls back to the density-based estimate for sets without owner-provided diameters
  // yet, and for the legacy (no Lash Set requested) path, same as before this change.
  const diameter = (lashSet && LASH_SET_DIAMETERS_MM[lashSet]) || DIAMETER_BY_DENSITY[eyeAnalysis.lash_density];
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
    style_label: lashSet ? LASH_SET_LABELS[lashSet] : buildStyleLabel(style, technique),
    curl_label: buildCurlLabel(curl, technique),
    ...(spikeLengths ? { spike_lengths: spikeLengths } : {}),
    zone_summary: zoneSummary,
    ...(lashSet ? { lash_set: lashSet, lash_set_label: LASH_SET_LABELS[lashSet] } : {}),
    ...(lashStyle ? { lash_style: lashStyle, lash_style_label: LASH_STYLE_LABELS[lashStyle] } : {}),
  };
}
