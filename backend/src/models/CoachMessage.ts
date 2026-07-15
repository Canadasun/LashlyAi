import { pool } from "../db";

export type CoachMessageRole = "user" | "coach";

export interface CoachMessage {
  id: string;
  owner_user_id: string;
  role: CoachMessageRole;
  text: string;
  mock: boolean;
  created_at: string;
}

// "To some extent" — Pro users get continuity, not unbounded history. Caps what
// /coach/history returns (and by extension keeps the query cheap) rather than
// paginating; a lash artist's coaching questions don't need deeper archaeology.
const HISTORY_LIMIT = 50;

export async function saveCoachMessage(input: {
  ownerUserId: string;
  role: CoachMessageRole;
  text: string;
  mock?: boolean;
}): Promise<CoachMessage> {
  const result = await pool.query<CoachMessage>(
    `INSERT INTO coach_messages (owner_user_id, role, text, mock)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.ownerUserId, input.role, input.text, input.mock ?? false],
  );
  return result.rows[0];
}

export async function getRecentCoachMessages(ownerUserId: string): Promise<CoachMessage[]> {
  const result = await pool.query<CoachMessage>(
    `SELECT * FROM (
       SELECT * FROM coach_messages WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT $2
     ) recent
     ORDER BY created_at ASC`,
    [ownerUserId, HISTORY_LIMIT],
  );
  return result.rows;
}
