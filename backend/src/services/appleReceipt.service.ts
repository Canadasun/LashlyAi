import { SubscriptionPlan, SubscriptionStatus } from "../models/Subscription";

const PRODUCTION_URL = "https://buy.itunes.apple.com/verifyReceipt";
const SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

// Apple's response code for "this receipt is from the sandbox but was sent to
// production" — the documented signal to retry against the sandbox URL.
const SANDBOX_RECEIPT_ON_PRODUCTION_STATUS = 21007;

/**
 * Product ID -> plan mapping, matching the products configured in App Store Connect
 * (see docs/roadmap.md Phase 3). lashlyai_salon_monthly is the new Salon tier
 * (2026-07-24) — monthly-only for now, no yearly SKU.
 */
const PRODUCT_ID_TO_PLAN: Record<string, SubscriptionPlan> = {
  lashlyai_pro_monthly: "pro",
  lashlyai_pro_yearly: "pro",
  lashlyai_salon_monthly: "salon",
};

export interface VerifiedReceipt {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
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

interface ReceiptCandidate {
  product_id: string;
  transaction_id: string;
  expires_date_ms: string;
}

export function selectLatestReceipt(
  receipts: AppleVerifyResponse["latest_receipt_info"],
): ReceiptCandidate | null {
  const candidates =
    receipts
      ?.filter(
        (receipt): receipt is ReceiptCandidate =>
          !!receipt &&
          typeof receipt.product_id === "string" &&
          typeof receipt.transaction_id === "string" &&
          typeof receipt.expires_date_ms === "string" &&
          Number.isFinite(Number(receipt.expires_date_ms)),
      )
      .sort((a, b) => {
        const expiresDelta = Number(b.expires_date_ms) - Number(a.expires_date_ms);
        if (expiresDelta !== 0) {
          return expiresDelta;
        }
        return b.transaction_id.localeCompare(a.transaction_id);
      }) ?? [];

  return candidates[0] ?? null;
}

export function resolveSubscriptionStatus(expiresAt: string): SubscriptionStatus {
  return new Date(expiresAt).getTime() > Date.now() ? "active" : "expired";
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
      "APPLE_SHARED_SECRET is not configured. Real receipt verification is required in this environment.",
    );
  }

  let result = await callAppleVerify(PRODUCTION_URL, receiptData, sharedSecret);
  if (result.status === SANDBOX_RECEIPT_ON_PRODUCTION_STATUS) {
    result = await callAppleVerify(SANDBOX_URL, receiptData, sharedSecret);
  }

  if (result.status !== 0) {
    throw new Error(`Apple rejected the receipt (status ${result.status})`);
  }

  const latest = selectLatestReceipt(result.latest_receipt_info);
  if (!latest) {
    throw new Error("Apple's response had no usable subscription transaction info");
  }

  const plan = PRODUCT_ID_TO_PLAN[latest.product_id];
  if (!plan) {
    throw new Error(`Unrecognized product_id "${latest.product_id}"`);
  }

  const renewsAt = new Date(Number(latest.expires_date_ms)).toISOString();
  return {
    plan,
    status: resolveSubscriptionStatus(renewsAt),
    appleTransactionId: latest.transaction_id,
    renewsAt,
  };
}
