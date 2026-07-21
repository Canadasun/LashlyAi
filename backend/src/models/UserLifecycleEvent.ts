import { pool } from "../db";

export type LifecycleEventType =
  | "joiner_signup"
  | "mover_plan_change"
  | "mover_admin_grant"
  | "mover_admin_grant_revoked"
  | "mover_admin_status_changed"
  | "mover_refund_issued"
  | "leaver_subscription_expired"
  | "leaver_account_deleted";

export interface UserLifecycleEvent {
  id: string;
  user_id: string | null;
  user_email: string;
  event_type: LifecycleEventType;
  details: Record<string, unknown>;
  created_at: string;
}

export async function logLifecycleEvent(input: {
  userId: string;
  userEmail: string;
  eventType: LifecycleEventType;
  details?: Record<string, unknown>;
}): Promise<UserLifecycleEvent> {
  const result = await pool.query<UserLifecycleEvent>(
    `INSERT INTO user_lifecycle_events (user_id, user_email, event_type, details)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.userId, input.userEmail, input.eventType, JSON.stringify(input.details ?? {})],
  );
  return result.rows[0];
}

export async function getRecentLifecycleEvents(limit = 100): Promise<UserLifecycleEvent[]> {
  const result = await pool.query<UserLifecycleEvent>(
    "SELECT * FROM user_lifecycle_events ORDER BY created_at DESC LIMIT $1",
    [limit],
  );
  return result.rows;
}

export async function getLifecycleEventsForUser(userId: string): Promise<UserLifecycleEvent[]> {
  const result = await pool.query<UserLifecycleEvent>(
    "SELECT * FROM user_lifecycle_events WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );
  return result.rows;
}
