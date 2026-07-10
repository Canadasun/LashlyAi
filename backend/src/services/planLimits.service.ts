import { getSubscriptionByUserId, SubscriptionPlan } from "../models/Subscription";
import { getClientProfilesByOwner } from "../models/ClientProfile";
import { countEventsThisMonth, countEventsToday } from "../models/UsageEvent";

/**
 * Enforcement is OFF by default (ENFORCE_PLAN_LIMITS unset) — this is a deliberate
 * testing-phase decision from the owner: every tier is free/unlimited while testing,
 * but usage is still tracked and surfaced in the UI so quotas are visible and ready
 * to switch on later without more backend work.
 */
export const ENFORCEMENT_ENABLED = process.env.ENFORCE_PLAN_LIMITS === "true";

const FREE_LIMITS = {
  clientProfiles: 5,
  coachQuestionsPerDay: 5,
  eyeScansPerMonth: 3,
};

export async function getUserPlan(userId: string): Promise<SubscriptionPlan> {
  const subscription = await getSubscriptionByUserId(userId);
  return subscription?.plan ?? "free";
}

export interface QuotaStatus {
  used: number;
  limit: number | null; // null = unlimited
  allowed: boolean;
}

async function quotaStatus(used: number, limit: number | null): Promise<QuotaStatus> {
  const allowed = limit === null || used < limit || !ENFORCEMENT_ENABLED;
  return { used, limit, allowed };
}

export async function checkClientProfileQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  // Usage is always counted for real, regardless of plan — only the *limit* (and
  // therefore enforcement) is plan-gated. Previously this short-circuited to a
  // hardcoded `used: 0` for any non-free plan, which meant a Pro artist's own usage
  // banner would falsely show "0 clients" no matter how many they actually had.
  const clients = await getClientProfilesByOwner(userId);
  const limit = plan === "free" ? FREE_LIMITS.clientProfiles : null;
  return quotaStatus(clients.length, limit);
}

export async function checkCoachQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  const used = await countEventsToday(userId, "coach_question");
  const limit = plan === "free" ? FREE_LIMITS.coachQuestionsPerDay : null;
  return quotaStatus(used, limit);
}

export async function checkEyeScanQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  const used = await countEventsThisMonth(userId, "eye_scan");
  const limit = plan === "free" ? FREE_LIMITS.eyeScansPerMonth : null;
  return quotaStatus(used, limit);
}
