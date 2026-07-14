-- Forces a password change on next login for accounts provisioned with a generated
-- default password (see backend/src/scripts/seedAdmin.ts) instead of a self-chosen one.
ALTER TABLE users ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

-- Persisted error log so the admin dashboard can surface real production errors
-- instead of requiring a Railway log dump — see middleware/errorHandler.ts.
CREATE TABLE error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method text NOT NULL,
  path text NOT NULL,
  status_code int,
  message text NOT NULL,
  stack text,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
