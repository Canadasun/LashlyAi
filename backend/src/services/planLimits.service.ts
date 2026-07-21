import { getSubscriptionByUserId, Subscription, SubscriptionPlan } from "../models/Subscription";
import { getClientProfilesByOwner } from "../models/ClientProfile";
import { countEventsThisMonth, countEventsToday } from "../models/UsageEvent";
import { ADVANCED_LASH_SETS, isLashSetOption, LashSetOption } from "./lashMapRules.data";

/**
 * Enforcement is OFF by default (ENFORCE_PLAN_LIMITS unset) — this is a deliberate
 * testing-phase decision from the owner: every tier is free/unlimited while testing,
 * but usage is still tracked and surfaced in the UI so quotas are visible and ready
 * to switch on later without more backend work.
 */
export const ENFORCEMENT_ENABLED = process.env.ENFORCE_PLAN_LIMITS === "true";

// Aligned to the promised paywall copy (docs/pricing.md if present, else the paywall
// screen itself) — 2026-07-15 pass: eyeScansPerMonth and clientProfiles were shrunk
// from 3/5 to match "2 eye-shape scans per month" / "Save up to 2 client profiles".
// retentionChecksPerMonth and marketingGenerationsPerDay were zeroed since the promise
// frames retention troubleshooting / AI captions / AI replies as Paid-exclusive
// ("Paid Includes everything in Starter, plus..."), not a free taste quota.
const FREE_LIMITS = {
  clientProfiles: 2,
  coachQuestionsPerDay: 5,
  eyeScansPerMonth: 2,
  photoFeedbackPerMonth: 5,
  lashMapGenerationsPerMonth: 5,
  // Paid-exclusive per the promised copy — was 5, taste-quota is gone.
  retentionChecksPerMonth: 0,
  forumPostsPerMonth: 5,
  // Paid-exclusive per the promised copy — was 5, taste-quota is gone. Shared bucket
  // for both AI social media captions and AI replies to client messages.
  marketingGenerationsPerDay: 0,
  // AI preview costs a real image-generation call (pricier than the text-based
  // features above) — free tier doesn't get it at all, only Pro and above.
  lashPreviewsPerMonth: 0,
  // Same real image-generation cost profile as lashPreviewsPerMonth — free tier
  // doesn't get it at all, only Pro and above.
  photoRetouchesPerMonth: 0,
};

// Photo editor is paid-tier only (free gets zero, not a reduced quota) — but unlike
// every other feature above, paid tiers get a flat daily cap rather than unlimited,
// since exports are high-res and this is a distinct monetized feature, not a taste of
// an eventually-unlimited one.
const PAID_PHOTO_EDIT_DAILY_CAP = 10;

// Exported so the expiry sweep (subscriptionLifecycle.service.ts) checks the exact
// same set of "currently grants access" statuses this file uses — one definition,
// not two that could silently drift apart.
export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "grace_period"]);

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

export async function checkPhotoFeedbackQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  const used = await countEventsThisMonth(userId, "photo_feedback");
  const limit = plan === "free" ? FREE_LIMITS.photoFeedbackPerMonth : null;
  return quotaStatus(used, limit);
}

export async function checkLashMapQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  const used = await countEventsThisMonth(userId, "lash_map_generation");
  const limit = plan === "free" ? FREE_LIMITS.lashMapGenerationsPerMonth : null;
  return quotaStatus(used, limit);
}

export async function checkRetentionCheckQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  const used = await countEventsThisMonth(userId, "retention_check");
  const limit = plan === "free" ? FREE_LIMITS.retentionChecksPerMonth : null;
  return quotaStatus(used, limit);
}

export async function checkForumPostQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  const used = await countEventsThisMonth(userId, "forum_post");
  const limit = plan === "free" ? FREE_LIMITS.forumPostsPerMonth : null;
  return quotaStatus(used, limit);
}

export async function checkMarketingQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  const used = await countEventsToday(userId, "marketing_generation");
  const limit = plan === "free" ? FREE_LIMITS.marketingGenerationsPerDay : null;
  return quotaStatus(used, limit);
}

export async function checkLashPreviewQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  const used = await countEventsThisMonth(userId, "lash_preview_generation");
  const limit = plan === "free" ? FREE_LIMITS.lashPreviewsPerMonth : null;
  return quotaStatus(used, limit);
}

export async function checkPhotoEditQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  const used = await countEventsToday(userId, "photo_edit");
  const limit = plan === "free" ? 0 : PAID_PHOTO_EDIT_DAILY_CAP;
  return quotaStatus(used, limit);
}

export async function checkPhotoRetouchQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  const used = await countEventsThisMonth(userId, "photo_retouch_generation");
  const limit = plan === "free" ? FREE_LIMITS.photoRetouchesPerMonth : null;
  return quotaStatus(used, limit);
}

export interface AdvancedLashSetAccess {
  allowed: boolean;
  // Only set when the request actually named one of ADVANCED_LASH_SETS — lets the
  // caller build an error message ("X is a Pro-tier lash set") without re-validating.
  lashSet?: LashSetOption;
}

/**
 * Gates the Pro-tier Lash Sets (see lashMapRules.data.ts's ADVANCED_LASH_SETS) the
 * same way every other feature in this file is gated — respects ENFORCEMENT_ENABLED,
 * so during the current testing phase this always allows, same as every check*Quota
 * function above, but is ready to enforce for real once that flag flips on.
 */
export async function checkAdvancedLashSetAccess(
  userId: string,
  requestedLashSet: unknown,
): Promise<AdvancedLashSetAccess> {
  if (!isLashSetOption(requestedLashSet) || !ADVANCED_LASH_SETS.includes(requestedLashSet)) {
    return { allowed: true };
  }
  const plan = await getUserPlan(userId);
  const allowed = plan !== "free" || !ENFORCEMENT_ENABLED;
  return { allowed, lashSet: requestedLashSet };
}

/**
 * Inventory tracking is a flat Pro-only feature, not a quota — before 2026-07-15
 * there was no gating at all on inventory.routes.ts, so free users had full CRUD
 * access. Respects ENFORCEMENT_ENABLED like every other gate in this file.
 */
export async function checkInventoryAccess(userId: string): Promise<{ allowed: boolean }> {
  const plan = await getUserPlan(userId);
  return { allowed: plan !== "free" || !ENFORCEMENT_ENABLED };
}

/**
 * Custom lash sets (artist-specified zone lengths/curl/diameter, bypassing the vetted
 * preset tables entirely) are a flat Pro-only feature — deliberately gated higher than
 * the fixed advanced sets, since going off the owner-vetted defaults carries more
 * skill/liability risk, not less.
 */
export async function checkCustomLashMapAccess(userId: string): Promise<{ allowed: boolean }> {
  const plan = await getUserPlan(userId);
  return { allowed: plan !== "free" || !ENFORCEMENT_ENABLED };
}

/**
 * Retention Intelligence (per-client next-fill estimate + cross-client lash-set/glue
 * aggregates) is a flat Pro-only read feature, same shape as inventory/custom lash
 * maps above — retention troubleshooting itself is already Paid-exclusive
 * (retentionChecksPerMonth: 0 in FREE_LIMITS), so the insights built from that data
 * follow the same gate rather than a separate quota.
 */
export async function checkRetentionInsightsAccess(userId: string): Promise<{ allowed: boolean }> {
  const plan = await getUserPlan(userId);
  return { allowed: plan !== "free" || !ENFORCEMENT_ENABLED };
}

/**
 * Asking the Coach "about this client" (folds that client's eye analysis/lash map/
 * retention history into the prompt, see ai.service.ts's askCoach()) is a flat Pro-only
 * enhancement layered on top of the base Coach quota — the question itself still
 * counts against checkCoachQuota as normal, this only gates the extra context.
 */
export async function checkClientAwareCoachAccess(userId: string): Promise<{ allowed: boolean }> {
  const plan = await getUserPlan(userId);
  return { allowed: plan !== "free" || !ENFORCEMENT_ENABLED };
}

/**
 * Voice-dictated client notes (mobile/src/hooks/useVoiceDictation.ts, on-device
 * speech-to-text) are a flat Pro-only feature — same shape as the other flat gates in
 * this file.
 */
export async function checkClientNotesAccess(userId: string): Promise<{ allowed: boolean }> {
  const plan = await getUserPlan(userId);
  return { allowed: plan !== "free" || !ENFORCEMENT_ENABLED };
}
