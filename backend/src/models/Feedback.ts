import { pool } from "../db";

export interface Feedback {
  id: string;
  user_id: string | null;
  message: string;
  context: unknown;
  is_priority: boolean;
  created_at: string;
}

export async function createFeedback(input: {
  userId: string;
  message: string;
  context?: unknown;
  isPriority?: boolean;
}): Promise<Feedback> {
  const result = await pool.query<Feedback>(
    `INSERT INTO feedback (user_id, message, context, is_priority)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      input.userId,
      input.message,
      input.context ? JSON.stringify(input.context) : null,
      input.isPriority ?? false,
    ],
  );
  return result.rows[0];
}

export async function getFeedbackByUserId(userId: string): Promise<Feedback[]> {
  const result = await pool.query<Feedback>(
    "SELECT * FROM feedback WHERE user_id = $1 ORDER BY is_priority DESC, created_at DESC",
    [userId],
  );
  return result.rows;
}
