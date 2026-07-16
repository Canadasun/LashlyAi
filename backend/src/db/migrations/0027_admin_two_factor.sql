-- Two-factor codes for critical admin actions (comp subscription grant/revoke — the
-- only backend-controlled action that creates or destroys real subscription value;
-- real StoreKit purchases are already Face ID/Touch ID-authenticated by Apple itself).
-- Same hashed-code shape as password_reset_codes, kept as a separate table since the
-- two are different security domains (unauthenticated recovery vs. an already-
-- authenticated admin escalating to a sensitive action) — a bug in one must not be
-- able to leak into the other.
CREATE TABLE admin_action_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_action_codes_admin_user_id ON admin_action_codes(admin_user_id);
