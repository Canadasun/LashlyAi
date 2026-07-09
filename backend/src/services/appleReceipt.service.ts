import { SubscriptionPlan } from "../models/Subscription";

const PRODUCTION_URL = "https://buy.itunes.apple.com/verifyReceipt";
const SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

// Apple's response code for "this receipt is from the sandbox but was sent to
// production" — the documented signal to retry against the sandbox URL.
const SANDBOX_RECEIPT_ON_PRODUCTION_STATUS = 21007;

/**
 * Placeholder product ID -> plan mapping. These identifiers don't exist yet — they
 * must match whatever subscription products get created in App Store Connect once a
 * real Apple Developer account exists (see docs/roadmap.md Phase 3).
 */
const PRODUCT_ID_TO_PLAN: Record<string, SubscriptionPlan> = {
  lashlyai_pro_monthly: "pro",
  lashlyai_pro_yearly: "pro",
};

export interface VerifiedReceipt {
  plan: SubscriptionPlan;
  status: string;
  appleTransactionId: string;
  renewsAt: string | null;
}

interface AppleVerifyResponse {
  status: number;
  latest_receipt_info?: Array<{
    product_id: string;
    transaction_id: string;
    expires_date_ms?: string;
  }>;
}

async function callAppleVerify(url: string, receiptData: string, sharedSecret: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "receipt-data": receiptData,
      password: sharedSecret,
      "exclude-old-transactions": true,
    }),
  });
  return (await response.json()) as AppleVerifyResponse;
}

export async function verifyAppleReceipt(receiptData: string): Promise<VerifiedReceipt> {
  const sharedSecret = process.env.APPLE_SHARED_SECRET;
  if (!sharedSecret) {
    throw new Error(
      "APPLE_SHARED_SECRET is not configured — set it up in App Store Connect once a " +
        "real subscription product exists (see backend/.env.example).",
    );
  }

  let result = await callAppleVerify(PRODUCTION_URL, receiptData, sharedSecret);
  if (result.status === SANDBOX_RECEIPT_ON_PRODUCTION_STATUS) {
    result = await callAppleVerify(SANDBOX_URL, receiptData, sharedSecret);
  }

  if (result.status !== 0) {
    throw new Error(`Apple rejected the receipt (status ${result.status})`);
  }

  const latest = result.latest_receipt_info?.[0];
  if (!latest) {
    throw new Error("Apple's response had no transaction info");
  }

  const plan = PRODUCT_ID_TO_PLAN[latest.product_id];
  if (!plan) {
    throw new Error(`Unrecognized product_id "${latest.product_id}"`);
  }

  return {
    plan,
    status: "active",
    appleTransactionId: latest.transaction_id,
    renewsAt: latest.expires_date_ms
      ? new Date(Number(latest.expires_date_ms)).toISOString()
      : null,
  };
}
