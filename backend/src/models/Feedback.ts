import { pool } from "../db";

export interface Feedback {
  id: string;
  user_id: string | null;
  message: string;
  context: unknown;
  is_priority: boolean;
  created_at: string;
}

export interface FeedbackReply {
  id: string;
  feedback_id: string;
  admin_id: string | null;
  message: string;
  created_at: string;
}

export interface FeedbackWithReplies extends Feedback {
  replies: FeedbackReply[];
}

export interface FeedbackForAdmin extends Feedback {
  user_email: string | null;
  reply_count: number;
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

async function attachReplies(feedback: Feedback[]): Promise<FeedbackWithReplies[]> {
  if (feedback.length === 0) return [];
  const ids = feedback.map((f) => f.id);
  const repliesResult = await pool.query<FeedbackReply>(
    `SELECT * FROM feedback_replies WHERE feedback_id = ANY($1) ORDER BY created_at ASC`,
    [ids],
  );
  const byFeedbackId = new Map<string, FeedbackReply[]>();
  for (const reply of repliesResult.rows) {
    const list = byFeedbackId.get(reply.feedback_id) ?? [];
    list.push(reply);
    byFeedbackId.set(reply.feedback_id, list);
  }
  return feedback.map((f) => ({ ...f, replies: byFeedbackId.get(f.id) ?? [] }));
}

// Includes replies so a user revisiting their feedback history can actually see whether
// support responded, not just what they originally sent.
export async function getFeedbackByUserId(userId: string): Promise<FeedbackWithReplies[]> {
  const result = await pool.query<Feedback>(
    "SELECT * FROM feedback WHERE user_id = $1 ORDER BY is_priority DESC, created_at DESC",
    [userId],
  );
  return attachReplies(result.rows);
}

export async function getFeedbackById(id: string): Promise<Feedback | null> {
  const result = await pool.query<Feedback>("SELECT * FROM feedback WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

// For the admin dashboard — the previous query never joined the sender's email, so
// there was no way to know who to get back to. LEFT JOIN (not JOIN): feedback survives
// account deletion (user_id is nullable / ON DELETE SET NULL upstream), so a message
// from a since-deleted account should still be visible, just without a live contact.
export async function getRecentFeedbackForAdmin(limit: number): Promise<FeedbackForAdmin[]> {
  const result = await pool.query<FeedbackForAdmin>(
    `SELECT f.*, u.email AS user_email,
            (SELECT COUNT(*)::int FROM feedback_replies r WHERE r.feedback_id = f.id) AS reply_count
     FROM feedback f
     LEFT JOIN users u ON u.id = f.user_id
     ORDER BY f.is_priority DESC, f.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows;
}

export async function createFeedbackReply(input: {
  feedbackId: string;
  adminId: string;
  message: string;
}): Promise<FeedbackReply> {
  const result = await pool.query<FeedbackReply>(
    `INSERT INTO feedback_replies (feedback_id, admin_id, message)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.feedbackId, input.adminId, input.message],
  );
  return result.rows[0];
}
