-- Adds a per-user admin flag (there was previously no admin concept tied to a real
-- user account — only a shared-secret HTTP Basic Auth key for the read-only stats
-- dashboard) plus the schema for granting complimentary subscriptions to influencers
-- and alerting them in-app. See ADMIN_EMAILS allowlist self-heal in
-- routes/middleware/requireUser.ts for how is_admin gets set beyond this migration.

ALTER TABLE users ADD COLUMN is_admin boolean NOT NULL DEFAULT false;

CREATE TABLE subscription_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by_admin_id uuid NOT NULL REFERENCES users(id),
  plan text NOT NULL CHECK (plan IN ('free', 'pro', 'educator', 'salon', 'enterprise')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscription_grants_user_id ON subscription_grants(user_id);

CREATE TABLE user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('comp_subscription_grant')),
  payload jsonb NOT NULL,
  seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_notifications_user_id_unseen ON user_notifications(user_id) WHERE seen_at IS NULL;
