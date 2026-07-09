import { pool } from "../db";

export interface Feedback {
  id: string;
  user_id: string | null;
  message: string;
  context: unknown;
  created_at: string;
}

export async function createFeedback(input: {
  userId: string;
  message: string;
  context?: unknown;
}): Promise<Feedback> {
  const result = await pool.query<Feedback>(
    `INSERT INTO feedback (user_id, message, context)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.userId, input.message, input.context ? JSON.stringify(input.context) : null],
  );
  return result.rows[0];
}
