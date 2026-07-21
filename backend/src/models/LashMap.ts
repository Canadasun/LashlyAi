import { pool } from "../db";
import {
  deriveClassicPresentation,
  GeneratedLashMap,
  TexturedMap,
  ZoneSummary,
} from "../services/lashmap.service";
import { ZoneName } from "../services/lashMapRules.data";
import { DifficultyLabel } from "../services/serviceDifficulty.service";

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
  technique: "classic" | "wispy";
  style_label: string;
  curl_label: string;
  spike_lengths?: number[];
  zone_summary: ZoneSummary;
  lash_set?: string;
  lash_style?: string;
  lash_set_label?: string;
  lash_style_label?: string;
  difficulty_score?: number;
  difficulty_label?: DifficultyLabel;
  estimated_minutes?: { min: number; max: number };
  textured_map?: TexturedMap;
}

type LashMapPresentation = Pick<
  LashMap,
  | "technique"
  | "style_label"
  | "curl_label"
  | "spike_lengths"
  | "zone_summary"
  | "lash_set"
  | "lash_style"
  | "lash_set_label"
  | "lash_style_label"
  | "difficulty_score"
  | "difficulty_label"
  | "estimated_minutes"
  | "textured_map"
>;

interface LashMapRow {
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
  presentation: LashMapPresentation | null;
}

function mapLashMapRow(row: LashMapRow): LashMap {
  const presentation =
    row.presentation ??
    deriveClassicPresentation(row.style, row.curl, row.lengths as Record<ZoneName, number>);
  return {
    id: row.id,
    client_profile_id: row.client_profile_id,
    style: row.style,
    curl: row.curl,
    lengths: row.lengths,
    diameter: row.diameter,
    fan_type: row.fan_type,
    visual_map: row.visual_map,
    retention_pct: row.retention_pct,
    created_at: row.created_at,
    ...presentation,
  };
}

export async function createLashMap(
  clientProfileId: string,
  map: GeneratedLashMap,
): Promise<LashMap> {
  const presentation: LashMapPresentation = {
    technique: map.technique,
    style_label: map.style_label,
    curl_label: map.curl_label,
    spike_lengths: map.spike_lengths,
    zone_summary: map.zone_summary,
    lash_set: map.lash_set,
    lash_style: map.lash_style,
    lash_set_label: map.lash_set_label,
    lash_style_label: map.lash_style_label,
    difficulty_score: map.difficulty_score,
    difficulty_label: map.difficulty_label,
    estimated_minutes: map.estimated_minutes,
    textured_map: map.textured_map,
  };
  const result = await pool.query<LashMapRow>(
    `INSERT INTO lash_maps (client_profile_id, style, curl, lengths, diameter, fan_type, visual_map, presentation)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      clientProfileId,
      map.style,
      map.curl,
      JSON.stringify(map.lengths),
      map.diameter,
      map.fan_type,
      JSON.stringify(map.visual_map),
      JSON.stringify(presentation),
    ],
  );
  return mapLashMapRow(result.rows[0]);
}

export async function getLashMapsByClientProfileId(clientProfileId: string): Promise<LashMap[]> {
  const result = await pool.query<LashMapRow>(
    "SELECT * FROM lash_maps WHERE client_profile_id = $1 ORDER BY created_at DESC",
    [clientProfileId],
  );
  return result.rows.map(mapLashMapRow);
}

export async function getLashMapById(id: string): Promise<LashMap | null> {
  const result = await pool.query<LashMapRow>("SELECT * FROM lash_maps WHERE id = $1", [id]);
  const row = result.rows[0];
  return row ? mapLashMapRow(row) : null;
}

export async function updateLashMapRetention(id: string, retentionPct: number): Promise<LashMap> {
  const result = await pool.query<LashMapRow>(
    "UPDATE lash_maps SET retention_pct = $2 WHERE id = $1 RETURNING *",
    [id, retentionPct],
  );
  return mapLashMapRow(result.rows[0]);
}
