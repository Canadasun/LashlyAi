/**
 * Deterministic — not AI-based, same reasoning as lashmap.service.ts. See
 * docs/lash-rules.md §8 for the placeholder table this mirrors.
 */
export interface GlueRecommendation {
  band: "low" | "ideal" | "high";
  recommended_viscosity: string;
  approx_bonding_time: string;
  notes: string;
}

export function recommendGlue(humidityPct: number): GlueRecommendation {
  if (humidityPct < 30) {
    return {
      band: "low",
      recommended_viscosity: "Thinner viscosity",
      approx_bonding_time: "Longer, ~5-6 seconds per lash",
      notes:
        "Consider a humidifier near the workstation; low humidity slows cure.",
    };
  }

  if (humidityPct > 70) {
    return {
      band: "high",
      recommended_viscosity: "Thicker viscosity",
      approx_bonding_time: "Faster, ~1-2 seconds per lash",
      notes:
        "Consider a dehumidifier; high humidity over-accelerates cure and can cause " +
        "bonding issues.",
    };
  }

  return {
    band: "ideal",
    recommended_viscosity: "Standard viscosity",
    approx_bonding_time: "Standard, ~2-3 seconds per lash",
    notes: "This is the target range most glues are formulated for.",
  };
}
