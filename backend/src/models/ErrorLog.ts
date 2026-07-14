import { pool } from "../db";

export interface ErrorLog {
  id: string;
  method: string;
  path: string;
  status_code: number | null;
  message: string;
  stack: string | null;
  user_id: string | null;
  created_at: string;
}

export async function createErrorLog(input: {
  method: string;
  path: string;
  statusCode: number | null;
  message: string;
  stack?: string | null;
  userId?: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO error_logs (method, path, status_code, message, stack, user_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.method,
      input.path,
      input.statusCode,
      input.message,
      input.stack ?? null,
      input.userId ?? null,
    ],
  );
}

export async function getRecentErrorLogs(limit = 50): Promise<ErrorLog[]> {
  const result = await pool.query<ErrorLog>(
    "SELECT * FROM error_logs ORDER BY created_at DESC LIMIT $1",
    [limit],
  );
  return result.rows;
}

export async function getErrorLogCountSince(hoursAgo: number): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM error_logs WHERE created_at >= now() - ($1 || ' hours')::interval`,
    [hoursAgo],
  );
  return Number(result.rows[0].count);
}
