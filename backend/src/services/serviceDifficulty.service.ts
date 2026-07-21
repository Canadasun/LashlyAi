import { EyeShape, EyeSymmetry, LashDensity } from "./ai.service";
import { LashSetOption, LashTechnique } from "./lashMapRules.data";

/**
 * Estimates how technically demanding a lash-map appointment will be and roughly how
 * long it'll take, purely from inputs the lash-map generator already has (eye shape,
 * natural density, symmetry, chosen lash set, technique) — no new AI call, no new
 * client-facing input. Base minutes/scores below are estimates derived from typical
 * lash-industry appointment lengths, not owner-verified figures — same PLACEHOLDER
 * convention as lashMapRules.data.ts; flag for owner review before treating as fact.
 */

export type DifficultyLabel = "Quick" | "Standard" | "Technical" | "Expert-Level";

export interface ServiceDifficulty {
  score: number;
  label: DifficultyLabel;
  estimated_minutes: { min: number; max: number };
}

const DIFFICULTY_BASE_BY_LASH_SET: Record<LashSetOption, number> = {
  classic: 20,
  hybrid: 35,
  volume: 45,
  megavolume: 75,
  wet_set: 40,
  wet_wispy_set: 60,
  medusa_set: 65,
  anime_set: 80,
  angel_set: 40,
  yy_set: 40,
};

const MINUTES_BASE_BY_LASH_SET: Record<LashSetOption, number> = {
  classic: 100,
  hybrid: 115,
  volume: 130,
  megavolume: 160,
  wet_set: 100,
  wet_wispy_set: 130,
  medusa_set: 145,
  anime_set: 160,
  angel_set: 115,
  yy_set: 115,
};

// Fallback base when no Lash Set was chosen (legacy eye-shape-derived style path).
const DIFFICULTY_BASE_DEFAULT = 25;
const MINUTES_BASE_DEFAULT = 105;

// Reduced lid visibility/access makes isolation slower and more error-prone regardless
// of which lash set is chosen.
const HARDER_ACCESS_EYE_SHAPES: readonly EyeShape[] = ["hooded", "monolid", "deep_set", "close_set"];

function difficultyLabel(score: number): DifficultyLabel {
  if (score <= 30) return "Quick";
  if (score <= 55) return "Standard";
  if (score <= 75) return "Technical";
  return "Expert-Level";
}

export function computeServiceDifficulty(input: {
  eyeShape: EyeShape;
  lashDensity: LashDensity;
  eyeSymmetry?: EyeSymmetry;
  lashSet?: LashSetOption;
  technique?: LashTechnique;
}): ServiceDifficulty {
  const { eyeShape, lashDensity, eyeSymmetry, lashSet, technique } = input;

  let score = lashSet ? DIFFICULTY_BASE_BY_LASH_SET[lashSet] : DIFFICULTY_BASE_DEFAULT;
  let minutes = lashSet ? MINUTES_BASE_BY_LASH_SET[lashSet] : MINUTES_BASE_DEFAULT;

  if (lashDensity === "sparse") {
    // Fewer natural lashes to isolate onto — less margin for error, slower isolation.
    score += 10;
    minutes += 15;
  } else if (lashDensity === "dense") {
    // More natural lashes to separate/isolate individually.
    score += 5;
    minutes += 10;
  }

  if (HARDER_ACCESS_EYE_SHAPES.includes(eyeShape)) {
    score += 10;
    minutes += 15;
  }

  if (technique === "wispy") {
    // Extra spike placement layered on top of the base set.
    score += 10;
    minutes += 15;
  }

  if (eyeSymmetry === "notable_asymmetry") {
    score += 8;
    minutes += 15;
  } else if (eyeSymmetry === "mild_asymmetry") {
    score += 4;
    minutes += 8;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    label: difficultyLabel(score),
    estimated_minutes: { min: minutes, max: minutes + 30 },
  };
}
