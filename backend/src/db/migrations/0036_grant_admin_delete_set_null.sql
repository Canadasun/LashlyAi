-- subscription_grants.granted_by_admin_id had no ON DELETE clause at all (default
-- RESTRICT), unlike its sibling revoked_by_admin_id (0023_jml_lifecycle.sql), which
-- already uses ON DELETE SET NULL for the same "which admin did this" attribution
-- pattern. Found auditing account deletion (DELETE /users/me) for Apple's Guideline
-- 5.1.1(v) resubmission: any admin who has ever granted a complimentary subscription
-- to another user could not delete their own account — the DELETE would 500 with a
-- foreign key violation, since the grant record referencing them as granter still
-- exists (the beneficiary's own user_id already correctly ON DELETE CASCADEs, this is
-- purely the attribution field). Mirrors revoked_by_admin_id exactly: keep the grant
-- record (the beneficiary's comp access is unaffected either way), just null out who
-- granted it once that admin's account no longer exists.
ALTER TABLE subscription_grants ALTER COLUMN granted_by_admin_id DROP NOT NULL;
ALTER TABLE subscription_grants DROP CONSTRAINT subscription_grants_granted_by_admin_id_fkey;
ALTER TABLE subscription_grants ADD CONSTRAINT subscription_grants_granted_by_admin_id_fkey
  FOREIGN KEY (granted_by_admin_id) REFERENCES users(id) ON DELETE SET NULL;
