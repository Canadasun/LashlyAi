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
import { isSubscriptionActive } from "../services/planLimits.service";
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

function brandedPage(title: string, bodyHtml: string, maxWidth = 480): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="font-family: -apple-system, 'Segoe UI', sans-serif; background: #FAF7F4; padding: 48px 16px; color: #241D20; margin: 0;">
  <div style="max-width: ${maxWidth}px; margin: 0 auto; background: #FFFFFF; border-radius: 14px; padding: 40px 32px; text-align: center;">
    <div style="font-weight: 800; font-size: 18px; color: #B85C7A; margin-bottom: 24px;">LashlyAI</div>
    ${bodyHtml}
  </div>
</body>
</html>`;
}

// The three plans meant to be bought this way — "pro" is reachable here too via the
// underlying /billing/checkout API (nothing stops it), but individual artists buy Pro
// in the mobile app via Apple StoreKit; this page exists specifically for the
// salon/educator/enterprise customers that flow was never meant to serve, so only
// those three are shown.
const B2B_WEB_PLANS: { plan: Exclude<SubscriptionPlan, "free" | "pro">; label: string; blurb: string }[] = [
  { plan: "educator", label: "Educator", blurb: "For lash educators running courses and certifying students." },
  { plan: "salon", label: "Salon", blurb: "For salons managing multiple artists under one account." },
  { plan: "enterprise", label: "Enterprise", blurb: "For academies and larger multi-location businesses." },
];

// Minimal, self-contained web signup/checkout flow — the one piece of the B2B billing
// surface that was entirely missing: the backend could already create Stripe Checkout
// Sessions, but nothing anywhere let a salon/educator/enterprise prospect actually
// reach that call, since the mobile app deliberately never does (Apple StoreKit only).
// Reuses the exact same JSON APIs the mobile app uses (/auth/login, /auth/register,
// /billing/checkout, /billing/portal) via plain fetch() from inline JS — the session
// token lives in sessionStorage, the same bearer-token model as mobile, not a cookie,
// so this doesn't introduce any new session mechanism or CSRF surface to this codebase.
// Real prices aren't hardcoded here — Stripe's own hosted Checkout page shows the
// actual configured price at checkout time.
billingRouter.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    res.set("Content-Type", "text/html");
    res.send(
      brandedPage(
        "LashlyAI for teams",
        `
      <h1 style="font-size: 22px; margin: 0 0 6px;">LashlyAI for teams</h1>
      <p style="font-size: 13px; color: #746A6E; margin: 0 0 28px;">Educator, salon, and enterprise accounts.</p>

      <div id="authBox">
        <div id="authError" style="display:none; background:#FBEAE8; color:#B3261E; border-radius:8px; padding:10px; font-size:12px; margin-bottom:14px;"></div>
        <input id="authEmail" type="email" placeholder="you@example.com" autocomplete="email"
          style="width:100%; box-sizing:border-box; padding:11px 12px; border:1px solid #E4D5CB; border-radius:8px; font-size:14px; margin-bottom:10px;" />
        <input id="authPassword" type="password" placeholder="Password" autocomplete="current-password"
          style="width:100%; box-sizing:border-box; padding:11px 12px; border:1px solid #E4D5CB; border-radius:8px; font-size:14px; margin-bottom:14px;" />
        <button id="signInBtn" style="width:100%; padding:12px; border:none; border-radius:9px; background:#B85C7A; color:#fff; font-weight:700; font-size:14px; cursor:pointer; margin-bottom:8px;">Sign in</button>
        <button id="registerBtn" style="width:100%; padding:12px; border:1px solid #E4D5CB; border-radius:9px; background:#fff; color:#241D20; font-weight:700; font-size:14px; cursor:pointer;">Create account</button>
      </div>

      <div id="plansBox" style="display:none;">
        <div id="plansError" style="display:none; background:#FBEAE8; color:#B3261E; border-radius:8px; padding:10px; font-size:12px; margin-bottom:14px;"></div>
        ${B2B_WEB_PLANS.map(
          (p) => `
        <div style="border:1px solid #E4D5CB; border-radius:10px; padding:16px; text-align:left; margin-bottom:10px;">
          <div style="font-weight:700; font-size:14px;">${p.label}</div>
          <div style="font-size:12px; color:#746A6E; margin:4px 0 12px;">${p.blurb}</div>
          <button class="planBtn" data-plan="${p.plan}" style="width:100%; padding:10px; border:none; border-radius:8px; background:#B85C7A; color:#fff; font-weight:700; font-size:13px; cursor:pointer;">Subscribe to ${p.label}</button>
        </div>`,
        ).join("")}
        <button id="portalBtn" style="width:100%; padding:11px; border:1px solid #E4D5CB; border-radius:9px; background:#fff; color:#241D20; font-weight:600; font-size:13px; cursor:pointer; margin-top:6px;">Manage existing billing</button>
        <button id="signOutBtn" style="width:100%; padding:8px; border:none; background:transparent; color:#9b8f8c; font-size:12px; cursor:pointer; margin-top:14px;">Sign out</button>
      </div>

      <script src="/billing/plans.js"></script>
      `,
        560,
      ),
    );
  }),
);

// Served as an external same-origin file, not inlined into /billing/plans, because
// helmet()'s default Content-Security-Policy (script-src 'self', no 'unsafe-inline')
// blocks inline <script> tags — a same-origin <script src> is allowed under that
// exact same default policy, no CSP relaxation needed.
billingRouter.get("/plans.js", (_req, res) => {
  res.set("Content-Type", "application/javascript");
  res.send(`
    var TOKEN_KEY = 'lashlyai_billing_token';
    var authBox = document.getElementById('authBox');
    var plansBox = document.getElementById('plansBox');
    var authError = document.getElementById('authError');
    var plansError = document.getElementById('plansError');

    function showError(el, message) {
      el.textContent = message;
      el.style.display = 'block';
    }
    function hideError(el) { el.style.display = 'none'; }

    function showPlans() {
      authBox.style.display = 'none';
      plansBox.style.display = 'block';
    }

    async function api(path, body) {
      var res = await fetch(path, {
        method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json' },
          sessionStorage.getItem(TOKEN_KEY) ? { Authorization: 'Bearer ' + sessionStorage.getItem(TOKEN_KEY) } : {}
        ),
        body: JSON.stringify(body || {}),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
      return data;
    }

    async function authenticate(path) {
      hideError(authError);
      var email = document.getElementById('authEmail').value.trim();
      var password = document.getElementById('authPassword').value;
      if (!email || !password) { showError(authError, 'Enter an email and password.'); return; }
      try {
        var result = await api(path, { email: email, password: password });
        sessionStorage.setItem(TOKEN_KEY, result.token);
        showPlans();
      } catch (err) {
        showError(authError, err.message);
      }
    }

    document.getElementById('signInBtn').addEventListener('click', function () { authenticate('/auth/login'); });
    document.getElementById('registerBtn').addEventListener('click', function () { authenticate('/auth/register'); });

    document.getElementById('signOutBtn').addEventListener('click', function () {
      sessionStorage.removeItem(TOKEN_KEY);
      plansBox.style.display = 'none';
      authBox.style.display = 'block';
    });

    document.querySelectorAll('.planBtn').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        hideError(plansError);
        btn.disabled = true;
        try {
          var session = await api('/billing/checkout', { plan: btn.getAttribute('data-plan') });
          window.location.href = session.url;
        } catch (err) {
          showError(plansError, err.message);
          btn.disabled = false;
        }
      });
    });

    document.getElementById('portalBtn').addEventListener('click', async function () {
      hideError(plansError);
      try {
        var session = await api('/billing/portal', {});
        window.location.href = session.url;
      } catch (err) {
        showError(plansError, err.message);
      }
    });

    if (sessionStorage.getItem(TOKEN_KEY)) showPlans();
  `);
});

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

    // Without this, calling /checkout again while already subscribed creates a
    // *second* live Stripe subscription for the same customer — subscriptions is a
    // single row per user (see Subscription.ts), so only whichever webhook lands
    // last is ever tracked or refundable locally, while the other keeps billing the
    // customer's card with no local record of it at all.
    if (existing && isSubscriptionActive(existing) && (existing.stripe_subscription_id || existing.apple_transaction_id)) {
      res.status(409).json({
        error: existing.stripe_subscription_id
          ? "You already have an active subscription. Manage or change your plan from the billing portal instead."
          : "Your subscription is managed through the App Store and can't be changed here.",
      });
      return;
    }

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
