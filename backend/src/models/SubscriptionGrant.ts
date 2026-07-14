import { pool } from "../db";
import { SubscriptionPlan } from "./Subscription";

export interface SubscriptionGrant {
  id: string;
  user_id: string;
  granted_by_admin_id: string;
  plan: SubscriptionPlan;
  expires_at: string;
  created_at: string;
}

export async function createSubscriptionGrant(input: {
  userId: string;
  grantedByAdminId: string;
  plan: SubscriptionPlan;
  expiresAt: string;
}): Promise<SubscriptionGrant> {
  const result = await pool.query<SubscriptionGrant>(
    `INSERT INTO subscription_grants (user_id, granted_by_admin_id, plan, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.userId, input.grantedByAdminId, input.plan, input.expiresAt],
  );
  return result.rows[0];
}
