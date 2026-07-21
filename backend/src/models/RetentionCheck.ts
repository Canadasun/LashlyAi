import { pool } from "../db";

export interface RetentionCheck {
  id: string;
  lash_map_id: string;
  days_since_application: number;
  retention_pct: number;
  humidity_pct: number | null;
  glue_used: string | null;
  symptoms: string[];
  created_at: string;
}

export async function createRetentionCheck(input: {
  lashMapId: string;
  daysSinceApplication: number;
  retentionPct: number;
  humidityPct?: number;
  glueUsed?: string;
  symptoms: string[];
}): Promise<RetentionCheck> {
  const result = await pool.query<RetentionCheck>(
    `INSERT INTO retention_checks (lash_map_id, days_since_application, retention_pct, humidity_pct, glue_used, symptoms)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.lashMapId,
      input.daysSinceApplication,
      input.retentionPct,
      input.humidityPct ?? null,
      input.glueUsed ?? null,
      JSON.stringify(input.symptoms),
    ],
  );
  return result.rows[0];
}

export async function getRetentionChecksByClientProfileId(
  clientProfileId: string,
): Promise<(RetentionCheck & { lash_set: string | null; style: string })[]> {
  const result = await pool.query(
    `SELECT rc.*, lm.style, lm.presentation->>'lash_set' AS lash_set
     FROM retention_checks rc
     JOIN lash_maps lm ON lm.id = rc.lash_map_id
     WHERE lm.client_profile_id = $1
     ORDER BY rc.created_at ASC`,
    [clientProfileId],
  );
  return result.rows;
}

export async function getRetentionChecksByOwner(
  ownerUserId: string,
): Promise<(RetentionCheck & { lash_set: string | null; style: string })[]> {
  const result = await pool.query(
    `SELECT rc.*, lm.style, lm.presentation->>'lash_set' AS lash_set
     FROM retention_checks rc
     JOIN lash_maps lm ON lm.id = rc.lash_map_id
     JOIN client_profiles cp ON cp.id = lm.client_profile_id
     WHERE cp.owner_user_id = $1
     ORDER BY rc.created_at ASC`,
    [ownerUserId],
  );
  return result.rows;
}
