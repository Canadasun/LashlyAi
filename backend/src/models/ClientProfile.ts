import { pool } from "../db";
import { EyeAnalysis } from "../services/ai.service";

export interface ClientProfile {
  id: string;
  owner_user_id: string;
  name: string;
  photos: string[];
  eye_analysis: EyeAnalysis | null;
  lash_history: unknown[];
  notes: string | null;
  created_at: string;
}

export async function createClientProfile(input: {
  ownerUserId: string;
  name: string;
  notes?: string;
}): Promise<ClientProfile> {
  const result = await pool.query<ClientProfile>(
    `INSERT INTO client_profiles (owner_user_id, name, notes)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.ownerUserId, input.name, input.notes ?? null],
  );
  return result.rows[0];
}

export async function getClientProfileById(id: string): Promise<ClientProfile | null> {
  const result = await pool.query<ClientProfile>("SELECT * FROM client_profiles WHERE id = $1", [
    id,
  ]);
  return result.rows[0] ?? null;
}

export async function getClientProfilesByOwner(ownerUserId: string): Promise<ClientProfile[]> {
  const result = await pool.query<ClientProfile>(
    "SELECT * FROM client_profiles WHERE owner_user_id = $1 ORDER BY created_at DESC",
    [ownerUserId],
  );
  return result.rows;
}

export async function deleteClientProfile(id: string): Promise<void> {
  await pool.query("DELETE FROM client_profiles WHERE id = $1", [id]);
}

export async function addPhotoAndEyeAnalysis(
  id: string,
  photoUrl: string,
  eyeAnalysis: EyeAnalysis,
): Promise<ClientProfile> {
  const result = await pool.query<ClientProfile>(
    `UPDATE client_profiles
     SET photos = array_append(photos, $2),
         eye_analysis = $3
     WHERE id = $1
     RETURNING *`,
    [id, photoUrl, JSON.stringify(eyeAnalysis)],
  );
  return result.rows[0];
}

export async function appendLashHistoryEntry(id: string, entry: unknown): Promise<void> {
  await pool.query(
    `UPDATE client_profiles
     SET lash_history = lash_history || $2::jsonb
     WHERE id = $1`,
    [id, JSON.stringify([entry])],
  );
}
