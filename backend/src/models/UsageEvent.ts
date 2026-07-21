import { pool } from "../db";

export type UsageEventType =
  | "coach_question"
  | "eye_scan"
  | "retention_check"
  | "photo_feedback"
  | "lash_map_generation"
  | "forum_post"
  | "marketing_generation"
  | "lash_preview_generation"
  | "photo_edit"
  | "photo_retouch_generation"
  | "video_retouch";

export async function logUsageEvent(userId: string, eventType: UsageEventType): Promise<void> {
  await pool.query("INSERT INTO usage_events (user_id, event_type) VALUES ($1, $2)", [
    userId,
    eventType,
  ]);
}

export async function countEventsToday(userId: string, eventType: UsageEventType): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM usage_events
     WHERE user_id = $1 AND event_type = $2 AND created_at >= date_trunc('day', now())`,
    [userId, eventType],
  );
  return Number(result.rows[0].count);
}

export async function countEventsThisMonth(
  userId: string,
  eventType: UsageEventType,
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM usage_events
     WHERE user_id = $1 AND event_type = $2 AND created_at >= date_trunc('month', now())`,
    [userId, eventType],
  );
  return Number(result.rows[0].count);
}
