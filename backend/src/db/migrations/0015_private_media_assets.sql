-- Private object metadata for client photos. Object bytes live in S3-compatible storage;
-- this table is the authorization boundary and deletion inventory.

CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_profile_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size int NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  purpose text NOT NULL CHECK (purpose IN ('eye_analysis', 'photo_feedback')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_assets_owner_user_id ON media_assets(owner_user_id);
CREATE INDEX idx_media_assets_client_profile_id ON media_assets(client_profile_id);

