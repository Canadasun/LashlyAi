-- Voice logging (Pro tier): quick mid-service notes, dictated hands-free via on-device
-- speech-to-text (mobile/src/hooks/useVoiceDictation.ts) or typed manually. Kept as
-- its own table rather than folded into client_profiles.lash_history (which is
-- specifically lash-map-shaped entries) or the single client_profiles.notes scalar
-- (which has no append/history mechanism at all).

CREATE TABLE client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'voice')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_notes_client_profile_id ON client_notes(client_profile_id);
