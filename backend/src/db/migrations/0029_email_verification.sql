-- Tracks whether a user has actually proven control of their email address. Defaults
-- false for every existing row too — non-blocking in v1 (nothing is gated behind this
-- yet), just tracked and surfaced so enforcement can be added later without another
-- migration.
ALTER TABLE users ADD COLUMN email_verified boolean NOT NULL DEFAULT false;

CREATE TABLE email_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_email_verification_codes_user_id ON email_verification_codes(user_id);
