-- Saved custom lash-map templates (Pro tier): a reusable personal "signature set"
-- (label/curl/diameter/lengths) an artist can save once and apply to any client,
-- instead of re-entering a custom lash map from scratch every time. Same access gate
-- as an inline custom lash map (checkCustomLashMapAccess) since it's the same
-- higher-skill/liability surface, just made reusable.

CREATE TABLE lash_map_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text NOT NULL,
  curl text NOT NULL CHECK (curl IN ('C', 'CC', 'D')),
  diameter text NOT NULL,
  lengths jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lash_map_templates_owner_user_id ON lash_map_templates(owner_user_id);
