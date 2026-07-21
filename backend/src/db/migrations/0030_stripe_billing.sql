-- Adds Stripe as a second payment provider alongside Apple StoreKit, for a future web
-- billing portal (salon/enterprise customers signing up via lashlyai.com). The mobile
-- app itself stays 100% StoreKit/Play Billing per App Store guideline 3.1.1 — Stripe
-- never touches the iOS/Android binaries, so this is additive columns only, nothing
-- about the existing Apple path changes shape.
ALTER TABLE subscriptions
  ADD COLUMN payment_provider text NOT NULL DEFAULT 'apple'
    CHECK (payment_provider IN ('apple', 'google', 'stripe')),
  ADD COLUMN stripe_customer_id text,
  ADD COLUMN stripe_subscription_id text;

CREATE UNIQUE INDEX idx_subscriptions_stripe_subscription_id
  ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- De-dupes Stripe webhook deliveries — Stripe retries on any non-2xx response and can
-- redeliver the same event even after a prior successful 200, so without this a
-- retried checkout.session.completed could double-log a lifecycle event or double-send
-- a confirmation email. Raw event id from Stripe is globally unique, used as-is as the
-- primary key rather than a generated uuid.
CREATE TABLE stripe_webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
