-- Joiner/Mover/Leaver lifecycle audit trail. Deliberately NOT cascade-deleted with the
-- user (user_id goes to NULL, not gone) — an audit trail that vanishes the moment the
-- account it describes is deleted defeats its own purpose. user_email is a denormalized
-- snapshot for the same reason: it stays readable even after user_id goes NULL.
CREATE TABLE user_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'joiner_signup',
    'mover_plan_change',
    'mover_admin_grant',
    'mover_admin_grant_revoked',
    'mover_admin_status_changed',
    'leaver_subscription_expired',
    'leaver_account_deleted'
  )),
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_lifecycle_events_user_id ON user_lifecycle_events(user_id);
CREATE INDEX idx_user_lifecycle_events_type_created ON user_lifecycle_events(event_type, created_at);

-- Deleting an admin account who ever granted a comp subscription would otherwise fail
-- outright (no ON DELETE action = restrict) — found auditing the Leaver path 2026-07-15.
-- SET NULL preserves the grant record itself (who received it, what plan, when it
-- expires) while just losing the "granted by" attribution, same pattern already used
-- for feedback.user_id / error_logs.user_id.
ALTER TABLE subscription_grants
  DROP CONSTRAINT subscription_grants_granted_by_admin_id_fkey,
  ALTER COLUMN granted_by_admin_id DROP NOT NULL,
  ADD CONSTRAINT subscription_grants_granted_by_admin_id_fkey
    FOREIGN KEY (granted_by_admin_id) REFERENCES users(id) ON DELETE SET NULL;

-- Grants previously had no way to end early — only their own expires_at passing, which
-- nothing actively enforced either (see leaver_subscription_expired sweep). Needed for
-- POST /admin/grants/:id/revoke.
ALTER TABLE subscription_grants ADD COLUMN revoked_at timestamptz;
ALTER TABLE subscription_grants ADD COLUMN revoked_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- Lets the mobile CompSubscriptionBanner show a revoke notice the same way it already
-- shows a grant notice, instead of the revoke silently having no user-visible signal.
ALTER TABLE user_notifications DROP CONSTRAINT user_notifications_type_check;
ALTER TABLE user_notifications ADD CONSTRAINT user_notifications_type_check
  CHECK (type IN ('comp_subscription_grant', 'comp_subscription_revoked'));
