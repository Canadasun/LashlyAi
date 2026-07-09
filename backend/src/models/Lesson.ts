import { pool } from "../db";

export interface Lesson {
  id: string;
  order_index: number;
  title: string;
  summary: string;
  content: string;
  created_at: string;
}

export async function getAllLessons(): Promise<Lesson[]> {
  const result = await pool.query<Lesson>("SELECT * FROM lessons ORDER BY order_index ASC");
  return result.rows;
}

export async function getLessonById(id: string): Promise<Lesson | null> {
  const result = await pool.query<Lesson>("SELECT * FROM lessons WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function getCompletedLessonIds(userId: string): Promise<Set<string>> {
  const result = await pool.query<{ lesson_id: string }>(
    "SELECT lesson_id FROM lesson_completions WHERE user_id = $1",
    [userId],
  );
  return new Set(result.rows.map((r) => r.lesson_id));
}

export async function markLessonComplete(userId: string, lessonId: string): Promise<void> {
  await pool.query(
    `INSERT INTO lesson_completions (user_id, lesson_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, lesson_id) DO NOTHING`,
    [userId, lessonId],
  );
}
