-- New Salon tier (2026-07-24, $39.99/mo, product id lashlyai_salon_monthly): Video
-- Retouch, Face Deep Scan AR, and Inventory move from Pro-included to Salon-exclusive.
-- Per explicit owner decision, every subscriber who was already on an active Pro plan
-- before this change keeps these three features going forward for as long as they
-- remain continuously subscribed to Pro or above — only new/renewing-after-a-lapse Pro
-- subscribers are limited to the narrower feature set from here on.
--
-- upsertSubscription() (Subscription.ts) never lists this column in its INSERT/UPDATE,
-- so once set it survives every future plan/status upsert (renewals, plan changes,
-- lapse-expiry sweeps) untouched — it only ever needs to be set here, once, for the
-- currently-active Pro population at the moment of this migration.
ALTER TABLE subscriptions ADD COLUMN legacy_pro_features_grandfathered boolean NOT NULL DEFAULT false;

UPDATE subscriptions
SET legacy_pro_features_grandfathered = true
WHERE plan = 'pro'
  AND status IN ('active', 'trialing', 'billing_retry');
