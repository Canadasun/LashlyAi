import assert from "node:assert/strict";
import test from "node:test";
import { isSubscriptionActive } from "./planLimits.service";

test("isSubscriptionActive requires an active status and a non-expired renewal", () => {
  assert.equal(
    isSubscriptionActive({
      id: "sub-1",
      user_id: "user-1",
      plan: "pro",
      status: "active",
      apple_transaction_id: null,
      renews_at: new Date(Date.now() + 60_000).toISOString(),
      created_at: new Date().toISOString(),
    }),
    true,
  );

  assert.equal(
    isSubscriptionActive({
      id: "sub-2",
      user_id: "user-1",
      plan: "pro",
      status: "expired",
      apple_transaction_id: null,
      renews_at: new Date(Date.now() + 60_000).toISOString(),
      created_at: new Date().toISOString(),
    }),
    false,
  );

  assert.equal(
    isSubscriptionActive({
      id: "sub-3",
      user_id: "user-1",
      plan: "pro",
      status: "active",
      apple_transaction_id: null,
      renews_at: new Date(Date.now() - 60_000).toISOString(),
      created_at: new Date().toISOString(),
    }),
    false,
  );

  // Stripe's dunning/payment-retry window (see stripe.service.ts's
  // mapStripeSubscriptionStatus) must still grant access — the subscription hasn't
  // actually been canceled yet, Stripe is just retrying the charge.
  assert.equal(
    isSubscriptionActive({
      id: "sub-4",
      user_id: "user-1",
      plan: "salon",
      status: "billing_retry",
      apple_transaction_id: null,
      renews_at: new Date(Date.now() + 60_000).toISOString(),
      created_at: new Date().toISOString(),
    }),
    true,
  );
});
