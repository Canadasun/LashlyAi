import { getSubscriptionByUserId, Subscription, SubscriptionPlan } from "../models/Subscription";
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

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "grace_period"]);

function isNonExpiredRenewal(renewsAt: string | null, now: number) {
  if (!renewsAt) {
    return true;
  }
  const expiresAt = new Date(renewsAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function isSubscriptionActive(subscription: Subscription | null, now = Date.now()): boolean {
  if (!subscription) {
    return false;
  }
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    return false;
  }
  return isNonExpiredRenewal(subscription.renews_at, now);
}

export async function getUserPlan(userId: string): Promise<SubscriptionPlan> {
  const subscription = await getSubscriptionByUserId(userId);
  if (!subscription || !isSubscriptionActive(subscription)) {
    return "free";
  }
  return subscription.plan;
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
