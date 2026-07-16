-- Closes the "admin can view feedback but never respond" gap — feedback was write-only
-- from the user's side and read-only from the admin's side, with no way to close the
-- loop back to the person who sent it.
CREATE TABLE feedback_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_replies_feedback_id ON feedback_replies(feedback_id);
