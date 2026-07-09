-- Simple in-app "report an issue" intake (Phase 2).

CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  message text NOT NULL,
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
