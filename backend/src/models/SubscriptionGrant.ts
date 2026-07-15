import { pool } from "../db";
import { SubscriptionPlan } from "./Subscription";

export interface SubscriptionGrant {
  id: string;
  user_id: string;
  granted_by_admin_id: string | null;
  plan: SubscriptionPlan;
  expires_at: string;
  revoked_at: string | null;
  revoked_by_admin_id: string | null;
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

export async function getSubscriptionGrantById(id: string): Promise<SubscriptionGrant | null> {
  const result = await pool.query<SubscriptionGrant>(
    "SELECT * FROM subscription_grants WHERE id = $1",
    [id],
  );
  return result.rows[0] ?? null;
}

export async function revokeSubscriptionGrant(
  id: string,
  revokedByAdminId: string,
): Promise<SubscriptionGrant> {
  const result = await pool.query<SubscriptionGrant>(
    `UPDATE subscription_grants
     SET revoked_at = now(), revoked_by_admin_id = $2
     WHERE id = $1
     RETURNING *`,
    [id, revokedByAdminId],
  );
  return result.rows[0];
}
