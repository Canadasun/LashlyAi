import Stripe from "stripe";
import { SubscriptionPlan, SubscriptionStatus } from "../models/Subscription";
import { logger } from "../utils/logger";

/**
 * Web-only billing (checkout, self-service management, refunds) for salon/enterprise
 * customers who sign up via lashlyai.com — completely separate from the mobile app,
 * which stays 100% Apple StoreKit / Google Play Billing per App Store guideline 3.1.1.
 * Stub-safe like appleReceipt.service.ts: every exported function throws a clear error
 * if STRIPE_SECRET_KEY isn't configured, rather than silently faking a paid plan —
 * this codebase's established rule for anything that touches real money.
 */

const secretKey = process.env.STRIPE_SECRET_KEY;
export const stripeConfigured = Boolean(secretKey);

// Pinned explicitly rather than left to the SDK's default: several call sites below
// (mapStripeSubscription's per-item current_period_end, refundLatestInvoiceForSubscription's
// invoicePayments lookup, the invoice.parent.subscription_details webhook path) are
// hand-tuned to this exact response shape. Without a pin, a routine `npm update` inside
// this package's "^22.3.2" range could silently bump the SDK's default API version and
// change those shapes with no compile-time signal. Bump this deliberately, alongside
// re-checking the call sites above, not as a side effect of a dependency update.
const STRIPE_API_VERSION = "2026-06-24.dahlia";

const stripeClient = secretKey ? new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION }) : undefined;

function requireStripeClient(): Stripe {
  if (!stripeClient) {
    throw new Error("STRIPE_SECRET_KEY is not configured. Stripe billing is required in this environment.");
  }
  return stripeClient;
}

// One Stripe Price per billable plan, set once real products/prices are created in
// the Stripe Dashboard (test mode first). A plan with no price id configured yet
// simply isn't purchasable — callers check this and return 503, same pattern as
// APPLE_SHARED_SECRET being unset.
const PLAN_TO_PRICE_ID: Partial<Record<Exclude<SubscriptionPlan, "free">, string>> = {
  pro: process.env.STRIPE_PRICE_ID_PRO,
  educator: process.env.STRIPE_PRICE_ID_EDUCATOR,
  salon: process.env.STRIPE_PRICE_ID_SALON,
  enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE,
};

const PRICE_ID_TO_PLAN: Record<string, SubscriptionPlan> = Object.fromEntries(
  Object.entries(PLAN_TO_PRICE_ID)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([plan, priceId]) => [priceId, plan as SubscriptionPlan]),
);

export function priceIdForPlan(plan: Exclude<SubscriptionPlan, "free">): string | undefined {
  return PLAN_TO_PRICE_ID[plan];
}

export function planForPriceId(priceId: string): SubscriptionPlan | undefined {
  return PRICE_ID_TO_PLAN[priceId];
}

function publicBaseUrl(): string {
  return process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
}

/**
 * Reuses a stored Stripe customer id if one exists (looked up by caller from the
 * user's subscription row) rather than creating a new Customer object on every
 * checkout — Stripe customers accumulate payment methods/invoice history, and a fresh
 * one per purchase would fragment that.
 */
export async function getOrCreateStripeCustomer(input: {
  userId: string;
  email: string;
  existingStripeCustomerId?: string | null;
}): Promise<string> {
  const stripe = requireStripeClient();

  if (input.existingStripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(input.existingStripeCustomerId);
      if (!existing.deleted) {
        return existing.id;
      }
    } catch (err) {
      // A stored customer id can become unretrievable in ways that aren't "this
      // customer was deleted" — most commonly STRIPE_SECRET_KEY switching between
      // test and live mode, where every previously-stored id 404s under the new key.
      // Falling through to create a fresh customer keeps checkout working instead of
      // permanently locking this user out of ever subscribing again.
      logger.error(
        `[stripe.service] Could not retrieve stored Stripe customer ${input.existingStripeCustomerId} for user ${input.userId}, creating a new one`,
        err,
      );
    }
  }

  const customer = await stripe.customers.create({
    email: input.email,
    metadata: { user_id: input.userId },
  });
  return customer.id;
}

export interface CreateCheckoutSessionInput {
  userId: string;
  email: string;
  plan: Exclude<SubscriptionPlan, "free">;
  existingStripeCustomerId?: string | null;
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<{ url: string }> {
  const stripe = requireStripeClient();
  const priceId = priceIdForPlan(input.plan);
  if (!priceId) {
    throw new Error(`No Stripe price configured for plan "${input.plan}"`);
  }

  const customerId = await getOrCreateStripeCustomer(input);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    client_reference_id: input.userId,
    subscription_data: { metadata: { user_id: input.userId } },
    success_url: `${publicBaseUrl()}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${publicBaseUrl()}/billing/cancel`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout Session URL");
  }
  return { url: session.url };
}

/**
 * Stripe's hosted Customer Portal — covers "subscription management" (cancel,
 * upgrade/downgrade between the plans attached to the portal configuration, update
 * payment method, view/download invoices) without this app needing to build any of
 * that UI itself.
 */
export async function createBillingPortalSession(
  stripeCustomerId: string,
): Promise<{ url: string }> {
  const stripe = requireStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: publicBaseUrl(),
  });
  return { url: session.url };
}

export async function retrieveStripeSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
  const stripe = requireStripeClient();
  return stripe.subscriptions.retrieve(stripeSubscriptionId);
}

export function constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
  const stripe = requireStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured. Cannot verify webhook signatures.");
  }
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

export interface MappedStripeSubscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  renewsAt: string | null;
}

/**
 * Maps a Stripe subscription status onto this app's own SubscriptionStatus values.
 * "trialing" collapses onto "active" rather than becoming a new stored status —
 * planLimits.service.ts's ACTIVE_SUBSCRIPTION_STATUSES already treats the two as
 * access-equivalent, so there's nothing a distinct "trialing" row would add. "past_due"
 * maps to the existing "billing_retry" status (Stripe's own dunning-retry window,
 * exact semantic match for a status this codebase already modeled before Stripe
 * existed here). Trials aren't offered by createCheckoutSession above (no
 * subscription_data.trial_period_days set), so "trialing" shouldn't occur yet in
 * practice — handled anyway in case a trial gets configured directly in Stripe later.
 */
export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
    case "active":
      return "active";
    case "past_due":
      return "billing_retry";
    case "incomplete":
      return "pending";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
    case "paused":
      return "expired";
    default:
      return "expired";
  }
}

export function mapStripeSubscription(
  subscription: Stripe.Subscription,
): MappedStripeSubscription | null {
  const item = subscription.items.data[0];
  const priceId = item?.price?.id;
  const plan = priceId ? planForPriceId(priceId) : undefined;
  if (!plan) {
    logger.warn(
      `[stripe.service] Stripe subscription ${subscription.id} has unrecognized price id "${priceId}" — no local plan mapping, skipping`,
    );
    return null;
  }

  const periodEnd = item?.current_period_end;
  return {
    plan,
    status: mapStripeSubscriptionStatus(subscription.status),
    renewsAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  };
}

/**
 * Refunds the payment behind a subscription's most recent paid invoice — the
 * "find the right charge" step an admin shouldn't have to do by hand in the Stripe
 * Dashboard. Full refund only in v1 (no partial-amount input) to match the existing
 * admin-grant/revoke pattern's simplicity; a specific amount can be added later if
 * partial refunds are ever needed.
 *
 * Invoices no longer carry a direct `payment_intent` field on this API version —
 * looked up via the InvoicePayments list instead (Stripe's documented replacement),
 * taking the paid entry and refunding whichever of payment_intent/charge it carries.
 */
export async function refundLatestInvoiceForSubscription(
  stripeSubscriptionId: string,
  reason?: Stripe.RefundCreateParams.Reason,
): Promise<Stripe.Refund> {
  const stripe = requireStripeClient();
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  const invoiceId =
    typeof subscription.latest_invoice === "string"
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id;
  if (!invoiceId) {
    throw new Error(`Subscription ${stripeSubscriptionId} has no latest_invoice to refund`);
  }

  const payments = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 10 });
  const paidPayment = payments.data.find((payment) => payment.status === "paid");
  if (!paidPayment) {
    throw new Error(`Invoice ${invoiceId} has no paid InvoicePayment to refund`);
  }

  const { payment_intent: paymentIntent, charge } = paidPayment.payment;
  const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
  const chargeId = typeof charge === "string" ? charge : charge?.id;
  if (!paymentIntentId && !chargeId) {
    throw new Error(`Invoice ${invoiceId}'s paid InvoicePayment has neither a payment_intent nor a charge to refund`);
  }

  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    charge: paymentIntentId ? undefined : chargeId,
    reason,
  });
}
