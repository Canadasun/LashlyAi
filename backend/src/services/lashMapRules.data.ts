/**
 * Deterministic rules data mirroring /docs/lash-rules.md. Keep these two in sync —
 * docs/lash-rules.md is the human-editable source the owner reviews and corrects;
 * this file is what the rules engine actually runs against.
 *
 * STATUS: PLACEHOLDER. Same caveat as docs/lash-rules.md — these are conservative,
 * clearly-labeled defaults, not verified lash industry standards. Do not treat as
 * accurate until the owner has reviewed them (see docs/lash-rules.md §8).
 */
import { EyeShape, LashDensity } from "./ai.service";

export type LashStyle = "natural" | "wispy" | "cat-eye" | "doll eye";
export type LashCurl = "C" | "CC" | "D";
export type ZoneName = "inner" | "inner_mid" | "center" | "outer_mid" | "outer";

export const STYLE_CURL_BY_EYE_SHAPE: Record<EyeShape, { style: LashStyle; curl: LashCurl }> = {
  round: { style: "cat-eye", curl: "C" },
  almond: { style: "wispy", curl: "CC" },
  hooded: { style: "cat-eye", curl: "CC" },
  monolid: { style: "doll eye", curl: "CC" },
  downturned: { style: "cat-eye", curl: "CC" },
  upturned: { style: "doll eye", curl: "C" },
  deep_set: { style: "wispy", curl: "CC" },
  close_set: { style: "cat-eye", curl: "C" },
  wide_set: { style: "doll eye", curl: "C" },
};

export const ZONE_LENGTHS_MM: Record<LashStyle, Record<ZoneName, number>> = {
  natural: { inner: 8, inner_mid: 9, center: 10, outer_mid: 10, outer: 9 },
  wispy: { inner: 7, inner_mid: 9, center: 11, outer_mid: 11, outer: 10 },
  "cat-eye": { inner: 7, inner_mid: 9, center: 10, outer_mid: 12, outer: 13 },
  "doll eye": { inner: 9, inner_mid: 10, center: 11, outer_mid: 10, outer: 8 },
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
