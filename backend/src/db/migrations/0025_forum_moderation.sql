-- Forum moderation: report + block, closing the App Review Guideline 1.2 gap
-- (no way to flag objectionable content or block abusive users existed before this).

ALTER TABLE forum_posts ADD COLUMN hidden boolean NOT NULL DEFAULT false;
ALTER TABLE forum_comments ADD COLUMN hidden boolean NOT NULL DEFAULT false;

CREATE TABLE forum_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SET NULL rather than CASCADE: a report should survive the reporter deleting their
  -- account — it's evidence of what was flagged, not something that belongs to them.
  reporter_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_at timestamptz,
  resolved_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_forum_reports_status ON forum_reports(status);

CREATE TABLE forum_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_user_id, blocked_user_id)
);
