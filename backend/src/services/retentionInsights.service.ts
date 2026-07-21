/**
 * Retention Intelligence: turns the retention-check history that was previously
 * captured for one AI call and then discarded (see retention_checks migration comment)
 * into a per-client next-fill estimate and cross-client "which lash set/glue held up
 * best" aggregate. Deliberately simple/linear given how little data typically exists
 * per client — labeled as an estimate everywhere it surfaces, not a clinical model.
 */

export interface RetentionCheckLike {
  days_since_application: number;
  retention_pct: number | string;
  lash_set: string | null;
  style: string;
  glue_used: string | null;
}

// Industry-cited rough threshold for "time to book a fill" — PLACEHOLDER, not
// owner-verified, same caveat as the rest of the rules-engine estimates.
const FILL_THRESHOLD_PCT = 60;

export interface NextFillEstimate {
  estimated_days_remaining: number;
  estimated_fill_day: number;
}

/**
 * Projects forward from the single most recent check, assuming a straight-line
 * retention decay from 100% at day 0 through (days_since_application, retention_pct).
 * Returns null when there isn't enough signal to project from (no checks yet, the
 * check was logged at day 0, or retention hasn't dropped at all).
 */
export function estimateNextFill(checks: RetentionCheckLike[]): NextFillEstimate | null {
  if (checks.length === 0) return null;
  const latest = checks[checks.length - 1];
  const retentionPct = Number(latest.retention_pct);
  const days = latest.days_since_application;

  if (days <= 0 || retentionPct >= 100) return null;
  const lossPerDay = (100 - retentionPct) / days;
  if (lossPerDay <= 0) return null;

  const fillDay = (100 - FILL_THRESHOLD_PCT) / lossPerDay;
  const daysRemaining = Math.round(fillDay - days);
  if (daysRemaining <= 0) {
    return { estimated_days_remaining: 0, estimated_fill_day: Math.round(fillDay) };
  }
  return { estimated_days_remaining: daysRemaining, estimated_fill_day: Math.round(fillDay) };
}

export interface RetentionAggregateRow {
  label: string;
  average_retention_pct: number;
  sample_size: number;
}

function average(values: number[]): number {
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function aggregateByLashSet(checks: RetentionCheckLike[]): RetentionAggregateRow[] {
  const groups = new Map<string, number[]>();
  for (const check of checks) {
    const label = check.lash_set ?? check.style;
    const values = groups.get(label) ?? [];
    values.push(Number(check.retention_pct));
    groups.set(label, values);
  }
  return Array.from(groups.entries())
    .map(([label, values]) => ({ label, average_retention_pct: average(values), sample_size: values.length }))
    .sort((a, b) => b.average_retention_pct - a.average_retention_pct);
}

export function aggregateByGlue(checks: RetentionCheckLike[]): RetentionAggregateRow[] {
  const groups = new Map<string, number[]>();
  for (const check of checks) {
    if (!check.glue_used) continue;
    const values = groups.get(check.glue_used) ?? [];
    values.push(Number(check.retention_pct));
    groups.set(check.glue_used, values);
  }
  return Array.from(groups.entries())
    .map(([label, values]) => ({ label, average_retention_pct: average(values), sample_size: values.length }))
    .sort((a, b) => b.average_retention_pct - a.average_retention_pct);
}
