-- Widens user_lifecycle_events.event_type for the Stripe refund flow. Stripe-driven
-- plan/status changes and cancellations reuse the existing provider-agnostic
-- 'mover_plan_change' / 'leaver_subscription_expired' types (details.source
-- distinguishes "apple_receipt_verify" from "stripe_webhook") — a refund has no
-- existing equivalent, so it's the one genuinely new type.
ALTER TABLE user_lifecycle_events DROP CONSTRAINT user_lifecycle_events_event_type_check;
ALTER TABLE user_lifecycle_events ADD CONSTRAINT user_lifecycle_events_event_type_check
  CHECK (event_type IN (
    'joiner_signup',
    'mover_plan_change',
    'mover_admin_grant',
    'mover_admin_grant_revoked',
    'mover_admin_status_changed',
    'mover_refund_issued',
    'leaver_subscription_expired',
    'leaver_account_deleted'
  ));
