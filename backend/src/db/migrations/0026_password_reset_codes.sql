-- Forgot password: email-a-6-digit-code flow. Codes are stored hashed (SHA-256 is
-- fine here, unlike password hashing — this is high-entropy random data, not a
-- low-entropy user-chosen secret) so a DB leak alone can't be used to reset accounts.
CREATE TABLE password_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_password_reset_codes_user_id ON password_reset_codes(user_id);
