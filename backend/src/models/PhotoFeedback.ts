import { pool } from "../db";
import { PhotoFeedback as AIPhotoFeedback } from "../services/ai.service";

export interface PhotoFeedback {
  id: string;
  client_profile_id: string;
  photo_url: string;
  isolation_score: number;
  direction_score: number;
  styling_score: number;
  overall_score: number;
  notes: string;
  mock: boolean;
  created_at: string;
}

export async function createPhotoFeedback(
  clientProfileId: string,
  photoUrl: string,
  feedback: AIPhotoFeedback,
): Promise<PhotoFeedback> {
  const result = await pool.query<PhotoFeedback>(
    `INSERT INTO photo_feedback
       (client_profile_id, photo_url, isolation_score, direction_score, styling_score, overall_score, notes, mock)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      clientProfileId,
      photoUrl,
      feedback.isolation_score,
      feedback.direction_score,
      feedback.styling_score,
      feedback.overall_score,
      feedback.notes,
      feedback.mock,
    ],
  );
  return result.rows[0];
}

export async function getPhotoFeedbackByClientProfileId(
  clientProfileId: string,
): Promise<PhotoFeedback[]> {
  const result = await pool.query<PhotoFeedback>(
    "SELECT * FROM photo_feedback WHERE client_profile_id = $1 ORDER BY created_at DESC",
    [clientProfileId],
  );
  return result.rows;
}
