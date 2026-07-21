import { Router } from "express";
import Stripe from "stripe";
import { requireUser } from "./middleware/requireUser";
import { asyncHandler } from "../utils/asyncHandler";
import {
  getSubscriptionByStripeCustomerId,
  getSubscriptionByStripeSubscriptionId,
  getSubscriptionByUserId,
  SubscriptionPlan,
  upsertSubscription,
} from "../models/Subscription";
import { findUserById } from "../models/User";
import { logLifecycleEvent } from "../models/UserLifecycleEvent";
import {
  isStripeWebhookEventAlreadyProcessed,
  markStripeWebhookEventProcessed,
} from "../models/StripeWebhookEvent";
import { sendEmailBestEffort } from "../services/email.service";
import {
  stripePaymentFailedEmail,
  stripeSubscriptionActiveEmail,
  stripeSubscriptionCanceledEmail,
} from "../services/notificationTemplates";
import {
  constructWebhookEvent,
  createBillingPortalSession,
  createCheckoutSession,
  mapStripeSubscription,
  retrieveStripeSubscription,
  stripeConfigured,
} from "../services/stripe.service";
import { logger } from "../utils/logger";

export const billingRouter = Router();

// Separate router so index.ts can mount it BEFORE the global express.json() with its
// own express.raw() body parser — Stripe's signature is verified against the exact
// raw bytes of the request, which a re-serialized JSON object can't reproduce even
// with a correct secret. Kept out of billingRouter itself so /checkout, /portal,
// /success, and /cancel still get normal JSON body parsing via the app-wide
// express.json() middleware, unaffected by this route's raw-body requirement.
export const billingWebhookRouter = Router();

// Web-only billing for salon/enterprise customers signing up via lashlyai.com. The
// mobile app never calls any of this — it stays 100% Apple StoreKit / Google Play
// Billing (see subscriptions.routes.ts) per App Store guideline 3.1.1.
const BILLABLE_PLANS: Exclude<SubscriptionPlan, "free">[] = [
  "pro",
  "educator",
  "salon",
  "enterprise",
];

function brandedPage(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="font-family: -apple-system, 'Segoe UI', sans-serif; background: #FAF7F4; padding: 48px 16px; color: #241D20; margin: 0;">
  <div style="max-width: 480px; margin: 0 auto; background: #FFFFFF; border-radius: 14px; padding: 40px 32px; text-align: center;">
    <div style="font-weight: 800; font-size: 18px; color: #B85C7A; margin-bottom: 24px;">LashlyAI</div>
    ${bodyHtml}
  </div>
</body>
</html>`;
}

billingRouter.post(
  "/checkout",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!stripeConfigured) {
      res.status(503).json({ error: "STRIPE_SECRET_KEY is not configured. Billing is required in this environment." });
      return;
    }

    const { plan } = (req.body ?? {}) as { plan?: unknown };
    if (typeof plan !== "string" || !BILLABLE_PLANS.includes(plan as (typeof BILLABLE_PLANS)[number])) {
      res.status(400).json({ error: `plan must be one of: ${BILLABLE_PLANS.join(", ")}` });
      return;
    }

    const existing = await getSubscriptionByUserId(req.currentUser!.id);
    try {
      const session = await createCheckoutSession({
        userId: req.currentUser!.id,
        email: req.currentUser!.email,
        plan: plan as Exclude<SubscriptionPlan, "free">,
        existingStripeCustomerId: existing?.stripe_customer_id,
      });
      res.json(session);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("No Stripe price configured")) {
        res.status(503).json({ error: err.message });
        return;
      }
      throw err;
    }
  }),
);

billingRouter.post(
  "/portal",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!stripeConfigured) {
      res.status(503).json({ error: "STRIPE_SECRET_KEY is not configured. Billing is required in this environment." });
      return;
    }

    const existing = await getSubscriptionByUserId(req.currentUser!.id);
    if (!existing?.stripe_customer_id) {
      res.status(404).json({ error: "No Stripe billing account found for this user." });
      return;
    }

    const session = await createBillingPortalSession(existing.stripe_customer_id);
    res.json(session);
  }),
);

// Mounted at the exact /billing/webhook path in index.ts (not /billing), so this
// route is registered at "/" relative to that mount point.
billingWebhookRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(req.body as Buffer, signature);
    } catch (err) {
      logger.error("[billing.routes] Stripe webhook signature verification failed", err);
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    const alreadyProcessed = await isStripeWebhookEventAlreadyProcessed(event.id);
    if (alreadyProcessed) {
      res.status(200).json({ received: true, deduped: true });
      return;
    }

    // Only recorded as processed AFTER handleStripeEvent succeeds — marking it first
    // would mean a transient failure mid-processing (e.g. a DB write error) still gets
    // remembered as "done," so Stripe's automatic retry would be silently swallowed
    // instead of actually reprocessing the event.
    await handleStripeEvent(event);
    await markStripeWebhookEventProcessed(event.id, event.type);
    res.status(200).json({ received: true });
  }),
);

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (!userId || !subscriptionId || !customerId) {
        logger.warn(`[billing.routes] checkout.session.completed ${session.id} missing userId/subscriptionId/customerId`);
        return;
      }

      await syncStripeSubscription({ userId, stripeSubscriptionId: subscriptionId, stripeCustomerId: customerId });
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const local = await getSubscriptionByStripeSubscriptionId(subscription.id);
      const resolvedUserId = userId ?? local?.user_id;
      if (!resolvedUserId) {
        logger.warn(`[billing.routes] ${event.type} for ${subscription.id} has no resolvable user_id`);
        return;
      }
      await syncStripeSubscription({
        userId: resolvedUserId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        stripeSubscriptionObject: subscription,
      });
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionRef = invoice.parent?.subscription_details?.subscription;
      const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
      if (!subscriptionId) {
        logger.warn(`[billing.routes] invoice.payment_failed ${invoice.id} has no linked subscription`);
        return;
      }
      const local = await getSubscriptionByStripeSubscriptionId(subscriptionId);
      if (!local) {
        logger.warn(`[billing.routes] invoice.payment_failed for unknown subscription ${subscriptionId}`);
        return;
      }
      if (local.status !== "billing_retry") {
        await upsertSubscription({
          userId: local.user_id,
          plan: local.plan,
          status: "billing_retry",
          renewsAt: local.renews_at ?? undefined,
          paymentProvider: "stripe",
          stripeCustomerId: local.stripe_customer_id ?? undefined,
          stripeSubscriptionId: local.stripe_subscription_id ?? undefined,
        });
        const user = await findUserById(local.user_id);
        if (user) {
          await logLifecycleEvent({
            userId: user.id,
            userEmail: user.email,
            eventType: "mover_plan_change",
            details: { source: "stripe_invoice_payment_failed", from_status: local.status, to_status: "billing_retry", plan: local.plan },
          });
          void sendEmailBestEffort({ to: user.email, ...stripePaymentFailedEmail(local.plan) });
        }
      }
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const customerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
      if (!customerId) {
        logger.warn(`[billing.routes] charge.refunded ${charge.id} has no customer to attribute`);
        return;
      }
      const local = await getSubscriptionByStripeCustomerId(customerId);
      const user = local ? await findUserById(local.user_id) : null;
      if (user && local) {
        await logLifecycleEvent({
          userId: user.id,
          userEmail: user.email,
          eventType: "mover_refund_issued",
          details: {
            source: "stripe_webhook",
            stripe_charge_id: charge.id,
            amount_refunded: charge.amount_refunded,
            currency: charge.currency,
            plan: local.plan,
          },
        });
      } else {
        logger.warn(`[billing.routes] charge.refunded ${charge.id} could not be attributed to a local user`);
      }
      break;
    }
    default:
      break;
  }
}

async function syncStripeSubscription(input: {
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripeSubscriptionObject?: Stripe.Subscription;
}): Promise<void> {
  const subscription =
    input.stripeSubscriptionObject ?? (await retrieveStripeSubscription(input.stripeSubscriptionId));

  const mapped = mapStripeSubscription(subscription);
  if (!mapped) return;

  const previous = await getSubscriptionByUserId(input.userId);

  const updated = await upsertSubscription({
    userId: input.userId,
    plan: mapped.plan,
    status: mapped.status,
    renewsAt: mapped.renewsAt ?? undefined,
    paymentProvider: "stripe",
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
  });

  const user = await findUserById(input.userId);
  if (!user) return;

  const changed = previous?.plan !== updated.plan || previous?.status !== updated.status;
  if (changed) {
    await logLifecycleEvent({
      userId: user.id,
      userEmail: user.email,
      eventType: updated.status === "expired" ? "leaver_subscription_expired" : "mover_plan_change",
      details: {
        source: "stripe_webhook",
        from_plan: previous?.plan ?? null,
        from_status: previous?.status ?? null,
        to_plan: updated.plan,
        to_status: updated.status,
      },
    });
  }

  if (!previous && updated.status === "active") {
    void sendEmailBestEffort({ to: user.email, ...stripeSubscriptionActiveEmail(updated.plan) });
  } else if (previous?.status !== "expired" && updated.status === "expired") {
    void sendEmailBestEffort({ to: user.email, ...stripeSubscriptionCanceledEmail(updated.plan) });
  } else if (previous?.status === "billing_retry" && updated.status === "active") {
    void sendEmailBestEffort({ to: user.email, ...stripeSubscriptionActiveEmail(updated.plan) });
  }
}

billingRouter.get(
  "/success",
  asyncHandler(async (req, res) => {
    res.set("Content-Type", "text/html");
    res.send(
      brandedPage(
        "Subscription confirmed",
        `<h1 style="font-size: 22px; margin: 0 0 12px;">You're all set 🎉</h1>
         <p style="font-size: 14px; color: #746A6E; line-height: 1.6;">
           Your subscription is active. A confirmation email is on its way — you can
           close this window and return to LashlyAI.
         </p>`,
      ),
    );
  }),
);

billingRouter.get(
  "/cancel",
  asyncHandler(async (_req, res) => {
    res.set("Content-Type", "text/html");
    res.send(
      brandedPage(
        "Checkout canceled",
        `<h1 style="font-size: 22px; margin: 0 0 12px;">Checkout canceled</h1>
         <p style="font-size: 14px; color: #746A6E; line-height: 1.6;">
           No changes were made. You can close this window any time to try again.
         </p>`,
      ),
    );
  }),
);
