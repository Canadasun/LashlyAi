import { pool } from "../db";

export type SubscriptionPlan = "free" | "pro" | "educator" | "salon" | "enterprise";
export type SubscriptionStatus = "active" | "expired" | "revoked" | "pending" | "billing_retry";
export type PaymentProvider = "apple" | "google" | "stripe";

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: string;
  apple_transaction_id: string | null;
  renews_at: string | null;
  created_at: string;
  payment_provider: PaymentProvider;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  // Set once, only via migration 0037 (for whoever was already an active Pro
  // subscriber at cutover) — never written by upsertSubscription, so it survives every
  // future plan/status change untouched. See that migration for the full rationale.
  legacy_pro_features_grandfathered: boolean;
}

// Every field here is written verbatim on every upsert (single row per user, no
// history table) — callers doing an update unrelated to a specific field (e.g. an
// admin comp-grant, or the lapse-expiry sweep) MUST re-pass that field's current value
// explicitly, or it silently gets wiped to null/'apple'. See admin.routes.ts's grant
// guard and subscriptionLifecycle.service.ts for the established "read the row first,
// carry its fields forward" idiom this depends on.
export async function upsertSubscription(input: {
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  appleTransactionId?: string;
  renewsAt?: string;
  paymentProvider?: PaymentProvider;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}): Promise<Subscription> {
  const result = await pool.query<Subscription>(
    `INSERT INTO subscriptions
       (user_id, plan, status, apple_transaction_id, renews_at, payment_provider, stripe_customer_id, stripe_subscription_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id) DO UPDATE
       SET plan = EXCLUDED.plan,
           status = EXCLUDED.status,
           apple_transaction_id = EXCLUDED.apple_transaction_id,
           renews_at = EXCLUDED.renews_at,
           payment_provider = EXCLUDED.payment_provider,
           stripe_customer_id = EXCLUDED.stripe_customer_id,
           stripe_subscription_id = EXCLUDED.stripe_subscription_id
     RETURNING *`,
    [
      input.userId,
      input.plan,
      input.status,
      input.appleTransactionId ?? null,
      input.renewsAt ?? null,
      input.paymentProvider ?? "apple",
      input.stripeCustomerId ?? null,
      input.stripeSubscriptionId ?? null,
    ],
  );
  return result.rows[0];
}

export async function getSubscriptionByStripeCustomerId(
  stripeCustomerId: string,
): Promise<Subscription | null> {
  const result = await pool.query<Subscription>(
    "SELECT * FROM subscriptions WHERE stripe_customer_id = $1",
    [stripeCustomerId],
  );
  return result.rows[0] ?? null;
}

export async function getSubscriptionByStripeSubscriptionId(
  stripeSubscriptionId: string,
): Promise<Subscription | null> {
  const result = await pool.query<Subscription>(
    "SELECT * FROM subscriptions WHERE stripe_subscription_id = $1",
    [stripeSubscriptionId],
  );
  return result.rows[0] ?? null;
}

export async function getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
  const result = await pool.query<Subscription>(
    "SELECT * FROM subscriptions WHERE user_id = $1",
    [userId],
  );
  return result.rows[0] ?? null;
}

// Leaver via lapse: subscriptions currently reporting a status that grants access
// (activeStatuses) whose renews_at has already passed — nothing else in this codebase
// ever actively re-checks that on its own; see subscriptionLifecycle.service.ts.
export async function getLapsedSubscriptions(
  activeStatuses: string[],
  now: Date = new Date(),
): Promise<Subscription[]> {
  const result = await pool.query<Subscription>(
    `SELECT * FROM subscriptions
     WHERE status = ANY($1::text[])
       AND renews_at IS NOT NULL
       AND renews_at < $2`,
    [activeStatuses, now.toISOString()],
  );
  return result.rows;
}
