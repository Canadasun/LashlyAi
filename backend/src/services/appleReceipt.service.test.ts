import assert from "node:assert/strict";
import test from "node:test";
import { resolveSubscriptionStatus, selectLatestReceipt } from "./appleReceipt.service";

test("selectLatestReceipt prefers the newest unexpired transaction", () => {
  const selected = selectLatestReceipt([
    {
      product_id: "lashlyai_pro_monthly",
      transaction_id: "1000001",
      expires_date_ms: "1710000000000",
    },
    {
      product_id: "lashlyai_pro_yearly",
      transaction_id: "1000002",
      expires_date_ms: "1720000000000",
    },
  ]);

  assert.deepEqual(selected, {
    product_id: "lashlyai_pro_yearly",
    transaction_id: "1000002",
    expires_date_ms: "1720000000000",
  });
});

test("resolveSubscriptionStatus marks past renewals as expired", () => {
  const now = Date.now();
  assert.equal(resolveSubscriptionStatus(new Date(now + 60_000).toISOString()), "active");
  assert.equal(resolveSubscriptionStatus(new Date(now - 60_000).toISOString()), "expired");
});
