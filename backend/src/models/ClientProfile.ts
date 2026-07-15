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

export async function getClientProfilesByOwner(
  ownerUserId: string,
  search?: string,
): Promise<ClientProfile[]> {
  if (search) {
    const result = await pool.query<ClientProfile>(
      "SELECT * FROM client_profiles WHERE owner_user_id = $1 AND name ILIKE $2 ORDER BY created_at DESC",
      [ownerUserId, `%${search}%`],
    );
    return result.rows;
  }
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

// For photo-edit / photo-retouch outputs (mobile PhotoEditorScreen "Upload as Client
// Photo" / "Retouch Skin") — unlike addPhotoAndEyeAnalysis, this never touches
// eye_analysis, since an edited/retouched photo doesn't carry a new eye-analysis
// result. Without this, those two routes uploaded the image to storage but never
// added it to the client's photo history, so the edit was effectively lost.
export async function appendPhoto(id: string, photoUrl: string): Promise<ClientProfile> {
  const result = await pool.query<ClientProfile>(
    `UPDATE client_profiles
     SET photos = array_append(photos, $2)
     WHERE id = $1
     RETURNING *`,
    [id, photoUrl],
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
