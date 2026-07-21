import { pool } from "../db";
import { LashCurl, ZoneName } from "../services/lashMapRules.data";

export interface LashMapTemplate {
  id: string;
  owner_user_id: string;
  label: string;
  curl: LashCurl;
  diameter: string;
  lengths: Record<ZoneName, number>;
  created_at: string;
}

export async function createLashMapTemplate(input: {
  ownerUserId: string;
  label: string;
  curl: LashCurl;
  diameter: string;
  lengths: Record<ZoneName, number>;
}): Promise<LashMapTemplate> {
  const result = await pool.query<LashMapTemplate>(
    `INSERT INTO lash_map_templates (owner_user_id, label, curl, diameter, lengths)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.ownerUserId, input.label, input.curl, input.diameter, JSON.stringify(input.lengths)],
  );
  return result.rows[0];
}

export async function getLashMapTemplatesByOwner(ownerUserId: string): Promise<LashMapTemplate[]> {
  const result = await pool.query<LashMapTemplate>(
    "SELECT * FROM lash_map_templates WHERE owner_user_id = $1 ORDER BY created_at DESC",
    [ownerUserId],
  );
  return result.rows;
}

export async function getLashMapTemplateById(id: string): Promise<LashMapTemplate | null> {
  const result = await pool.query<LashMapTemplate>("SELECT * FROM lash_map_templates WHERE id = $1", [
    id,
  ]);
  return result.rows[0] ?? null;
}

export async function deleteLashMapTemplate(id: string): Promise<void> {
  await pool.query("DELETE FROM lash_map_templates WHERE id = $1", [id]);
}
