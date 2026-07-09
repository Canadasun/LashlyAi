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
  if (plan !== "free") return quotaStatus(0, null);

  const clients = await getClientProfilesByOwner(userId);
  return quotaStatus(clients.length, FREE_LIMITS.clientProfiles);
}

export async function checkCoachQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  if (plan !== "free") return quotaStatus(0, null);

  const used = await countEventsToday(userId, "coach_question");
  return quotaStatus(used, FREE_LIMITS.coachQuestionsPerDay);
}

export async function checkEyeScanQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  if (plan !== "free") return quotaStatus(0, null);

  const used = await countEventsThisMonth(userId, "eye_scan");
  return quotaStatus(used, FREE_LIMITS.eyeScansPerMonth);
}
