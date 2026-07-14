import { pool } from "../db";

export type MediaPurpose =
  | "eye_analysis"
  | "photo_feedback"
  | "lash_preview"
  | "photo_edit"
  | "photo_retouch";

export interface MediaAsset {
  id: string;
  owner_user_id: string;
  client_profile_id: string;
  object_key: string;
  content_type: "image/jpeg" | "image/png" | "image/webp";
  byte_size: number;
  purpose: MediaPurpose;
  // Only set for purpose = 'lash_preview' or 'photo_retouch' — which technician
  // confirmed the client consented to this AI-generated/edited image being created
  // from their photo.
  consented_by_user_id: string | null;
  consented_at: string | null;
  created_at: string;
}

export async function createMediaAsset(input: {
  ownerUserId: string;
  clientProfileId: string;
  objectKey: string;
  contentType: MediaAsset["content_type"];
  byteSize: number;
  purpose: MediaPurpose;
  consentedByUserId?: string;
}): Promise<MediaAsset> {
  const result = await pool.query<MediaAsset>(
    `INSERT INTO media_assets
       (owner_user_id, client_profile_id, object_key, content_type, byte_size, purpose, consented_by_user_id, consented_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $7::uuid IS NULL THEN NULL ELSE now() END)
     RETURNING *`,
    [
      input.ownerUserId,
      input.clientProfileId,
      input.objectKey,
      input.contentType,
      input.byteSize,
      input.purpose,
      input.consentedByUserId ?? null,
    ],
  );
  return result.rows[0];
}

export async function getOwnedMediaAsset(id: string, ownerUserId: string): Promise<MediaAsset | null> {
  const result = await pool.query<MediaAsset>(
    "SELECT * FROM media_assets WHERE id = $1 AND owner_user_id = $2",
    [id, ownerUserId],
  );
  return result.rows[0] ?? null;
}

export async function getMediaAssetsByClientProfileId(clientProfileId: string): Promise<MediaAsset[]> {
  const result = await pool.query<MediaAsset>(
    "SELECT * FROM media_assets WHERE client_profile_id = $1 ORDER BY created_at ASC",
    [clientProfileId],
  );
  return result.rows;
}

export async function getMediaAssetsByOwnerUserId(ownerUserId: string): Promise<MediaAsset[]> {
  const result = await pool.query<MediaAsset>(
    "SELECT * FROM media_assets WHERE owner_user_id = $1 ORDER BY created_at ASC",
    [ownerUserId],
  );
  return result.rows;
}

export async function deleteMediaAsset(id: string): Promise<void> {
  await pool.query("DELETE FROM media_assets WHERE id = $1", [id]);
}
