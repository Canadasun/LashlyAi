-- AI photo feedback (Phase 5): scores a photo of the artist's completed lash
-- application on isolation, direction, and styling. Distinct from eye_analysis,
-- which is scored on the client's pre-work natural eye/lashes.

CREATE TABLE photo_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  isolation_score int NOT NULL CHECK (isolation_score BETWEEN 0 AND 100),
  direction_score int NOT NULL CHECK (direction_score BETWEEN 0 AND 100),
  styling_score int NOT NULL CHECK (styling_score BETWEEN 0 AND 100),
  overall_score int NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  notes text NOT NULL,
  mock boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_photo_feedback_client_profile_id ON photo_feedback(client_profile_id);
