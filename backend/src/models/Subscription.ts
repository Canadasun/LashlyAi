import { pool } from "../db";

export type SubscriptionPlan = "free" | "pro" | "educator" | "salon" | "enterprise";

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: string;
  apple_transaction_id: string | null;
  renews_at: string | null;
  created_at: string;
}

export async function upsertSubscription(input: {
  userId: string;
  plan: SubscriptionPlan;
  status: string;
  appleTransactionId?: string;
  renewsAt?: string;
}): Promise<Subscription> {
  const result = await pool.query<Subscription>(
    `INSERT INTO subscriptions (user_id, plan, status, apple_transaction_id, renews_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE
       SET plan = EXCLUDED.plan,
           status = EXCLUDED.status,
           apple_transaction_id = EXCLUDED.apple_transaction_id,
           renews_at = EXCLUDED.renews_at
     RETURNING *`,
    [
      input.userId,
      input.plan,
      input.status,
      input.appleTransactionId ?? null,
      input.renewsAt ?? null,
    ],
  );
  return result.rows[0];
}

export async function getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
  const result = await pool.query<Subscription>(
    "SELECT * FROM subscriptions WHERE user_id = $1",
    [userId],
  );
  return result.rows[0] ?? null;
}
