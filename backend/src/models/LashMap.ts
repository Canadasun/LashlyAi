import { pool } from "../db";
import { GeneratedLashMap } from "../services/lashmap.service";

export interface LashMap {
  id: string;
  client_profile_id: string;
  style: string;
  curl: string;
  lengths: Record<string, number>;
  diameter: string;
  fan_type: string;
  visual_map: unknown;
  retention_pct: number | null;
  created_at: string;
}

export async function createLashMap(
  clientProfileId: string,
  map: GeneratedLashMap,
): Promise<LashMap> {
  const result = await pool.query<LashMap>(
    `INSERT INTO lash_maps (client_profile_id, style, curl, lengths, diameter, fan_type, visual_map)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      clientProfileId,
      map.style,
      map.curl,
      JSON.stringify(map.lengths),
      map.diameter,
      map.fan_type,
      JSON.stringify(map.visual_map),
    ],
  );
  return result.rows[0];
}

export async function getLashMapsByClientProfileId(clientProfileId: string): Promise<LashMap[]> {
  const result = await pool.query<LashMap>(
    "SELECT * FROM lash_maps WHERE client_profile_id = $1 ORDER BY created_at DESC",
    [clientProfileId],
  );
  return result.rows;
}
