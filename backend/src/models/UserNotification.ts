import { pool } from "../db";

export type UserNotificationType = "comp_subscription_grant";

export interface UserNotification {
  id: string;
  user_id: string;
  type: UserNotificationType;
  payload: Record<string, unknown>;
  seen_at: string | null;
  created_at: string;
}

export async function createUserNotification(input: {
  userId: string;
  type: UserNotificationType;
  payload: Record<string, unknown>;
}): Promise<UserNotification> {
  const result = await pool.query<UserNotification>(
    `INSERT INTO user_notifications (user_id, type, payload)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.userId, input.type, input.payload],
  );
  return result.rows[0];
}

export async function getUnseenNotifications(userId: string): Promise<UserNotification[]> {
  const result = await pool.query<UserNotification>(
    `SELECT * FROM user_notifications WHERE user_id = $1 AND seen_at IS NULL ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function markNotificationSeen(
  userId: string,
  notificationId: string,
): Promise<UserNotification | null> {
  const result = await pool.query<UserNotification>(
    `UPDATE user_notifications SET seen_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [notificationId, userId],
  );
  return result.rows[0] ?? null;
}
