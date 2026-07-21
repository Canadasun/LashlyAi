import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { mapStripeSubscription, mapStripeSubscriptionStatus } from "./stripe.service";

test("mapStripeSubscriptionStatus maps every Stripe status to a valid local SubscriptionStatus", () => {
  assert.equal(mapStripeSubscriptionStatus("active"), "active");
  // Trials collapse onto "active" — planLimits.service.ts's ACTIVE_SUBSCRIPTION_STATUSES
  // already treats "trialing" as access-equivalent to "active", so a distinct stored
  // status would add nothing.
  assert.equal(mapStripeSubscriptionStatus("trialing"), "active");
  // Stripe's own dunning-retry window maps onto this codebase's pre-existing
  // "billing_retry" status — an exact semantic match, not a new concept.
  assert.equal(mapStripeSubscriptionStatus("past_due"), "billing_retry");
  assert.equal(mapStripeSubscriptionStatus("incomplete"), "pending");
  assert.equal(mapStripeSubscriptionStatus("canceled"), "expired");
  assert.equal(mapStripeSubscriptionStatus("unpaid"), "expired");
  assert.equal(mapStripeSubscriptionStatus("incomplete_expired"), "expired");
  assert.equal(mapStripeSubscriptionStatus("paused"), "expired");
});

// PLAN_TO_PRICE_ID is built from STRIPE_PRICE_ID_* env vars at module load — none are
// set in this test environment, so every price id is genuinely unrecognized. This
// still exercises the real, important behavior: an unmapped price must never silently
// grant a plan, it must return null so the caller skips the sync entirely.
test("mapStripeSubscription returns null for a price id with no local plan mapping", () => {
  const fakeSubscription = {
    id: "sub_test123",
    status: "active",
    items: {
      data: [
        {
          price: { id: "price_not_configured_anywhere" },
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
        },
      ],
    },
  } as unknown as Stripe.Subscription;

  assert.equal(mapStripeSubscription(fakeSubscription), null);
});
