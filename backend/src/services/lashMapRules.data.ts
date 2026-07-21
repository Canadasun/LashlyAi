/**
 * Deterministic rules data mirroring /docs/lash-rules.md. Keep these two in sync —
 * docs/lash-rules.md is the human-editable source the owner reviews and corrects;
 * this file is what the rules engine actually runs against.
 *
 * STATUS: MOSTLY PLACEHOLDER, PARTIALLY OWNER-CONFIRMED (updated 2026-07-15). Zone
 * lengths and curls throughout this file are still conservative, clearly-labeled
 * defaults, not verified lash industry standards. LASH_SET_DIAMETERS_MM and
 * ADVANCED_LASH_SETS below, however, are owner-provided real data — see
 * docs/lash-rules.md §9 for the source and §10 for one flagged judgment call
 * (megavolume's Pro gate) that still needs owner confirmation.
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

/**
 * Technique is orthogonal to style: style is the shape (Cat Eye, Doll Eye, ...),
 * technique is how the lashes are placed within that shape. "wispy" here means the
 * textured/mixed-length, mixed-curl look (as in "Wispy Cat Eye"), layered on top of
 * any base style rather than being a style on its own. (The "wispy" *style* above is
 * kept separate/unchanged for artists who explicitly request just that base shape.)
 */
export type LashTechnique = "classic" | "wispy";

export const STYLE_LABELS: Record<LashStyle, string> = {
  natural: "Natural",
  "cat-eye": "Cat Eye",
  "doll eye": "Doll Eye",
  wispy: "Wispy",
  anime: "Anime",
  medusa: "Medusa",
  "wet-set": "Wet Set",
  "kim-k": "Kim K",
  "strip-lash-effect": "Strip Lash Effect",
};

/**
 * One step more dramatic than the base curl, used for the "spike" lashes mixed into
 * a wispy technique (e.g. base CC + D spikes). Caps at D — there's nothing beyond it.
 */
export const CURL_BUMP: Record<LashCurl, LashCurl> = {
  C: "CC",
  CC: "D",
  D: "D",
};

/**
 * "Lash sets" and "Lash styles" (added 2026-07) replace the old "Style (Pro)" /
 * "Technique" picker labels in the mobile UI with lash-industry-standard vocabulary.
 * They are a NEW, additive axis — not a renaming of BasicLashStyle/AdvancedLashStyle
 * above, whose values don't map 1:1 onto these (existing lash_maps rows keep their
 * original style/curl/technique; new rows additionally carry lash_set/lash_style, see
 * lashmap.service.ts and LashMap.ts's `presentation` JSONB column).
 *
 * STATUS: PLACEHOLDER, same caveat as the rest of this file — zone lengths/curls for
 * each Lash Set below are conservative guesses, not verified lash-artist standards.
 * Flagged for owner review before treating as accurate.
 */
export type LashSetOption =
  | "classic"
  | "hybrid"
  | "volume"
  | "megavolume"
  | "wet_set"
  | "wet_wispy_set"
  | "medusa_set"
  | "anime_set"
  | "angel_set"
  | "yy_set";

export type LashStyleOption =
  | "cateye"
  | "kitten_eye"
  | "doll_eye"
  | "open_eye"
  | "squirrel_eye"
  | "fox_eye"
  | "natural_eye";

export const LASH_SET_OPTIONS: LashSetOption[] = [
  "classic",
  "hybrid",
  "volume",
  "megavolume",
  "wet_set",
  "wet_wispy_set",
  "medusa_set",
  "anime_set",
  "angel_set",
  "yy_set",
];

export const LASH_STYLE_OPTIONS: LashStyleOption[] = [
  "cateye",
  "kitten_eye",
  "doll_eye",
  "open_eye",
  "squirrel_eye",
  "fox_eye",
  "natural_eye",
];

export const LASH_SET_LABELS: Record<LashSetOption, string> = {
  classic: "Classic",
  hybrid: "Hybrid",
  volume: "Volume",
  megavolume: "Megavolume",
  wet_set: "Wet Set",
  wet_wispy_set: "Wet Wispy Set",
  medusa_set: "Medusa Set",
  anime_set: "Anime Set",
  angel_set: "Angel Set",
  yy_set: "YY Set",
};

export const LASH_STYLE_LABELS: Record<LashStyleOption, string> = {
  cateye: "Cat Eye",
  kitten_eye: "Kitten Eye",
  doll_eye: "Doll Eye",
  open_eye: "Open Eye",
  squirrel_eye: "Squirrel Eye",
  fox_eye: "Fox Eye",
  natural_eye: "Natural Eye",
};

// PLACEHOLDER — progression from Classic (thin/short, natural fan) through Megavolume
// (fullest fans, longer), with the named "sets" (Wet Set, Medusa, Anime, Angel, YY)
// approximated from their typical finished look. Owner review required.
export const LASH_SET_ZONE_LENGTHS_MM: Record<LashSetOption, Record<ZoneName, number>> = {
  classic: { inner: 8, inner_mid: 9, center: 10, outer_mid: 10, outer: 9 },
  hybrid: { inner: 8, inner_mid: 10, center: 11, outer_mid: 11, outer: 10 },
  volume: { inner: 9, inner_mid: 11, center: 12, outer_mid: 12, outer: 11 },
  megavolume: { inner: 10, inner_mid: 12, center: 14, outer_mid: 14, outer: 12 },
  wet_set: { inner: 6, inner_mid: 7, center: 8, outer_mid: 8, outer: 7 },
  wet_wispy_set: { inner: 7, inner_mid: 9, center: 11, outer_mid: 11, outer: 10 },
  medusa_set: { inner: 6, inner_mid: 11, center: 8, outer_mid: 13, outer: 9 },
  anime_set: { inner: 10, inner_mid: 12, center: 15, outer_mid: 14, outer: 11 },
  angel_set: { inner: 9, inner_mid: 10, center: 12, outer_mid: 11, outer: 9 },
  yy_set: { inner: 8, inner_mid: 10, center: 11, outer_mid: 11, outer: 10 },
};

// PLACEHOLDER curl per Lash Set — owner review required.
export const LASH_SET_CURL: Record<LashSetOption, LashCurl> = {
  classic: "C",
  hybrid: "CC",
  volume: "CC",
  megavolume: "D",
  wet_set: "C",
  wet_wispy_set: "CC",
  medusa_set: "CC",
  anime_set: "D",
  angel_set: "CC",
  yy_set: "CC",
};

/**
 * Owner-confirmed allowed diameters per Lash Set (docs/lash-rules.md §9, provided
 * 2026-07-15) — NOT a placeholder for the sets listed here. `undefined` means the
 * owner hasn't provided a diameter for that set yet; generateLashMap() falls back to
 * DIAMETER_BY_DENSITY in that case (see lashmap.service.ts). Hybrid carries two
 * component diameters (classic base + volume fans) as a single descriptive string
 * since GeneratedLashMap.diameter is a single display field, not a structured value.
 */
export const LASH_SET_DIAMETERS_MM: Partial<Record<LashSetOption, string>> = {
  classic: "0.15mm / 0.18mm / 0.20mm",
  hybrid: "Classic: 0.15mm–0.20mm + Volume fans: 0.05mm / 0.07mm",
  volume: "0.05mm / 0.07mm / 0.10mm",
  megavolume: "0.02mm / 0.03mm",
  wet_wispy_set: "0.05mm / 0.07mm",
  anime_set: "0.05mm",
  // wet_set, medusa_set, angel_set, yy_set: not yet provided by the owner.
};

/**
 * Lash Sets gated to Pro subscribers (enforced in planLimits.service.ts's
 * checkAdvancedLashSetAccess, called from clients.routes.ts's POST /:id/lash-map).
 * wet_set / wet_wispy_set / medusa_set / anime_set carry over the pre-existing
 * "Advanced styles (Pro tier)" convention from ADVANCED_STYLES above (docs/lash-rules.md
 * §3). megavolume's gate is new, proposed 2026-07-15 based on its ultra-fine
 * 0.02mm–0.03mm diameter being a materially higher-skill/higher-risk technique — this
 * one is a flagged judgment call for the owner to confirm or override (see
 * docs/lash-rules.md §10), not an established fact like the other four.
 */
export const ADVANCED_LASH_SETS: LashSetOption[] = [
  "megavolume",
  "wet_set",
  "wet_wispy_set",
  "medusa_set",
  "anime_set",
];

/**
 * Textured Lash Sets (docs/lash-rules.md §9a, owner-provided 2026-07-15): these three
 * are spiky/mixed-length looks that need a distinct Base Layer Map (supporting lashes
 * between spikes) *and* Spike Map (spike location/length/distribution), rather than
 * the single flat zone list every other Lash Set uses. Previously flagged in §9a as
 * "not yet implemented in code" — see lashmap.service.ts's buildTexturedMap().
 */
export const TEXTURED_LASH_SETS: LashSetOption[] = ["wet_wispy_set", "medusa_set", "anime_set"];

export function isTexturedLashSet(value: LashSetOption): boolean {
  return TEXTURED_LASH_SETS.includes(value);
}

// Descriptive spike-distribution pattern per set, taken directly from the set's own
// existing §9 characterization in lash-rules.md rather than inventing a new claim.
export const TEXTURE_PATTERN_LABEL: Partial<Record<LashSetOption, string>> = {
  wet_wispy_set: "Evenly distributed mixed lengths across all zones (textured wet-look).",
  medusa_set: "Irregular, spiky placement across all zones — not a smooth curve.",
  anime_set: "Concentrated toward the center with a dramatic length increase.",
};

// Base layer (supporting lashes under the spikes) as a fraction of the full Lash Set
// zone length — PLACEHOLDER ratio, not owner-provided; flagged for review same as the
// rest of this file's estimated numbers.
export const BASE_LAYER_RATIO = 0.7;
export const MIN_BASE_LAYER_LENGTH_MM = 5;

export function isLashSetOption(value: unknown): value is LashSetOption {
  return LASH_SET_OPTIONS.includes(value as LashSetOption);
}

export function isLashStyleOption(value: unknown): value is LashStyleOption {
  return LASH_STYLE_OPTIONS.includes(value as LashStyleOption);
}
