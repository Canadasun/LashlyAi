/**
 * Deterministic rules data mirroring /docs/lash-rules.md. Keep these two in sync —
 * docs/lash-rules.md is the human-editable source the owner reviews and corrects;
 * this file is what the rules engine actually runs against.
 *
 * STATUS: PLACEHOLDER. Same caveat as docs/lash-rules.md — these are conservative,
 * clearly-labeled defaults, not verified lash industry standards. Do not treat as
 * accurate until the owner has reviewed them (see docs/lash-rules.md §9).
 */
import { EyeShape, LashDensity } from "./ai.service";

export type BasicLashStyle = "natural" | "cat-eye" | "doll eye";
export type AdvancedLashStyle = "wispy" | "anime" | "medusa" | "wet-set" | "kim-k" | "strip-lash-effect";
export type LashStyle = BasicLashStyle | AdvancedLashStyle;
export type LashCurl = "C" | "CC" | "D";
export type ZoneName = "inner" | "inner_mid" | "center" | "outer_mid" | "outer";

export const ADVANCED_STYLES: AdvancedLashStyle[] = [
  "wispy",
  "anime",
  "medusa",
  "wet-set",
  "kim-k",
  "strip-lash-effect",
];

// Wispy moved from a free auto-derived style to Pro-tier advanced (per the target
// pricing spec's "Advanced styles" list) — almond/deep_set now fall back to the
// closest free-tier basic style instead.
export const STYLE_CURL_BY_EYE_SHAPE: Record<EyeShape, { style: BasicLashStyle; curl: LashCurl }> = {
  round: { style: "cat-eye", curl: "C" },
  almond: { style: "natural", curl: "CC" },
  hooded: { style: "cat-eye", curl: "CC" },
  monolid: { style: "doll eye", curl: "CC" },
  downturned: { style: "cat-eye", curl: "CC" },
  upturned: { style: "doll eye", curl: "C" },
  deep_set: { style: "doll eye", curl: "CC" },
  close_set: { style: "cat-eye", curl: "C" },
  wide_set: { style: "doll eye", curl: "C" },
};

export const ZONE_LENGTHS_MM: Record<LashStyle, Record<ZoneName, number>> = {
  natural: { inner: 8, inner_mid: 9, center: 10, outer_mid: 10, outer: 9 },
  "cat-eye": { inner: 7, inner_mid: 9, center: 10, outer_mid: 12, outer: 13 },
  "doll eye": { inner: 9, inner_mid: 10, center: 11, outer_mid: 10, outer: 8 },
  // Advanced styles (Pro tier) — PLACEHOLDER numbers, same caveat as the rest of this
  // file. Requested explicitly by the artist rather than derived from eye shape.
  wispy: { inner: 7, inner_mid: 9, center: 11, outer_mid: 11, outer: 10 },
  anime: { inner: 10, inner_mid: 12, center: 15, outer_mid: 14, outer: 11 },
  medusa: { inner: 6, inner_mid: 11, center: 8, outer_mid: 13, outer: 9 },
  "wet-set": { inner: 6, inner_mid: 7, center: 8, outer_mid: 8, outer: 7 },
  "kim-k": { inner: 8, inner_mid: 11, center: 12, outer_mid: 15, outer: 16 },
  "strip-lash-effect": { inner: 11, inner_mid: 12, center: 13, outer_mid: 13, outer: 12 },
};

/**
 * Advanced styles also override the recommended curl regardless of eye shape, since
 * the look itself (e.g. Kim K's dramatic wing) depends on a specific curl. PLACEHOLDER.
 */
export const ADVANCED_STYLE_CURL: Record<AdvancedLashStyle, LashCurl> = {
  wispy: "CC",
  anime: "D",
  medusa: "CC",
  "wet-set": "C",
  "kim-k": "D",
  "strip-lash-effect": "CC",
};

export const DIAMETER_BY_DENSITY: Record<LashDensity, string> = {
  sparse: "0.12mm",
  medium: "0.15mm",
  dense: "0.18mm",
};

/**
 * Fan type ideally depends on client experience/retention goals (see
 * docs/lash-rules.md §5), which aren't captured by the AI eye-analysis step yet.
 * Approximated here from natural lash density until that input exists.
 */
export const FAN_TYPE_BY_DENSITY: Record<LashDensity, string> = {
  sparse: "classic (1:1)",
  medium: "3D-4D volume",
  dense: "5D-8D volume",
};
