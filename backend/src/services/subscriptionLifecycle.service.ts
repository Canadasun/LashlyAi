import { ACTIVE_SUBSCRIPTION_STATUSES } from "./planLimits.service";
import { getLapsedSubscriptions, upsertSubscription } from "../models/Subscription";
import { findUserById } from "../models/User";
import { logLifecycleEvent } from "../models/UserLifecycleEvent";

/**
 * Leaver via lapse. Nothing in this codebase actively re-checks a subscription's
 * renews_at once it's stored — plan access only ever gets recomputed lazily, the next
 * time getUserPlan() happens to run for that user (see planLimits.service.ts). That
 * means a Pro user whose subscription lapsed keeps showing as "expired" in the DB
 * forever without this ever running (harmless, since getUserPlan already treats a
 * lapsed renews_at as inactive on every check) — but there's also no event, no
 * notification, and no audit trail of the lapse itself until something calls this.
 *
 * Not wired to a schedule yet (no cron infra in this repo — see
 * backend/src/routes/admin.routes.ts's POST /admin/jobs/expire-subscriptions for the
 * manually/cron-triggerable entry point). Idempotent: a subscription already flipped
 * to "expired" no longer matches ACTIVE_SUBSCRIPTION_STATUSES, so re-running this
 * finds nothing to do for it.
 */
export async function expireLapsedSubscriptions(): Promise<{
  expiredCount: number;
  expiredUserIds: string[];
}> {
  const lapsed = await getLapsedSubscriptions([...ACTIVE_SUBSCRIPTION_STATUSES]);
  const expiredUserIds: string[] = [];

  for (const subscription of lapsed) {
    await upsertSubscription({
      userId: subscription.user_id,
      plan: subscription.plan,
      status: "expired",
      appleTransactionId: subscription.apple_transaction_id ?? undefined,
      renewsAt: subscription.renews_at ?? undefined,
    });

    const user = await findUserById(subscription.user_id);
    if (user) {
      await logLifecycleEvent({
        userId: user.id,
        userEmail: user.email,
        eventType: "leaver_subscription_expired",
        details: {
          plan_at_expiry: subscription.plan,
          previous_status: subscription.status,
          renews_at: subscription.renews_at,
        },
      });
    }
    expiredUserIds.push(subscription.user_id);
  }

  return { expiredCount: expiredUserIds.length, expiredUserIds };
}
