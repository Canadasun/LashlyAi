import { Request, Response, Router } from "express";
import { requireAdminAccount } from "./middleware/requireAdminAccount";
import { requireUser } from "./middleware/requireUser";
import { requireAdminUser } from "./middleware/requireAdminUser";
import { getAdminStats } from "../models/Admin";
import { asyncHandler } from "../utils/asyncHandler";
import { findUserByEmail, findUserById } from "../models/User";
import { getSubscriptionByUserId, SubscriptionPlan, upsertSubscription } from "../models/Subscription";
import {
  createSubscriptionGrant,
  getSubscriptionGrantById,
  revokeSubscriptionGrant,
} from "../models/SubscriptionGrant";
import { createUserNotification } from "../models/UserNotification";
import { logLifecycleEvent, getRecentLifecycleEvents } from "../models/UserLifecycleEvent";
import { expireLapsedSubscriptions } from "../services/subscriptionLifecycle.service";
import { getOpenForumReports, resolveForumReport } from "../models/Forum";
import { sendEmailBestEffort } from "../services/email.service";
import {
  compGrantEmail,
  compRevokeEmail,
  adminTwoFactorCodeEmail,
  supportReplyEmail,
  adminDirectContactEmail,
} from "../services/notificationTemplates";
import { createAdminActionCode, verifyAdminActionCode } from "../models/AdminActionCode";
import { createFeedbackReply, getFeedbackById } from "../models/Feedback";
import rateLimit from "express-rate-limit";

export const adminRouter = Router();

const GRANTABLE_PLANS: SubscriptionPlan[] = ["pro", "educator", "salon", "enterprise"];

// Loose enough for a legitimate "code expired, let me get a new one" retry, tight
// enough that this can't be used to spam an admin's inbox.
const twoFactorRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many code requests. Try again later." },
});

/**
 * Sends a fresh verification code to the requesting admin's own email — the first step
 * before any two-factor-gated action below. Scoped to the admin's own address (not
 * something a caller can redirect elsewhere), since the point is proving control of the
 * account that's about to take a sensitive action, not just proving control of *an*
 * inbox.
 */
adminRouter.post(
  "/2fa/request-code",
  requireUser,
  requireAdminUser,
  twoFactorRequestLimiter,
  asyncHandler(async (req, res) => {
    const code = await createAdminActionCode(req.currentUser!.id);
    void sendEmailBestEffort({
      to: req.currentUser!.email,
      ...adminTwoFactorCodeEmail(code, "a subscription grant or revocation"),
    });
    res.status(200).json({ message: "Verification code sent to your email." });
  }),
);

/**
 * Shared gate for every two-factor-protected admin action below — verifies
 * `two_factor_code` from the request body against a code this admin requested via
 * POST /2fa/request-code. Writes the 400 response itself (with a machine-readable
 * `code` field so the mobile client can distinguish "never requested a code" from "got
 * the code wrong" without string-matching the message) and returns false so call sites
 * can just `if (!(await requireTwoFactorCode(req, res))) return;`.
 */
async function requireTwoFactorCode(
  req: { currentUser?: { id: string }; body: unknown },
  res: { status: (code: number) => { json: (body: unknown) => void } },
): Promise<boolean> {
  const submitted = (req.body as { two_factor_code?: unknown })?.two_factor_code;
  if (typeof submitted !== "string" || !submitted.trim()) {
    res.status(400).json({
      error: "A verification code is required for this action.",
      code: "TWO_FACTOR_REQUIRED",
    });
    return false;
  }

  const verification = await verifyAdminActionCode(req.currentUser!.id, submitted.trim());
  if (!verification.ok) {
    res.status(400).json({
      error: "Invalid or expired verification code.",
      code: "TWO_FACTOR_INVALID",
    });
    return false;
  }

  return true;
}

/**
 * Grants a complimentary subscription (e.g. to an influencer) by email. Protected by
 * real-user + is_admin auth (requireAdminUser, Bearer token) — the same admin-account
 * gating the dashboard below now uses too, just via HTTP Basic Auth instead since this
 * one's called from the mobile app, not a browser.
 */
adminRouter.post(
  "/grants",
  requireUser,
  requireAdminUser,
  asyncHandler(async (req, res) => {
    if (!(await requireTwoFactorCode(req, res))) return;

    const { email, plan, expires_at: expiresAt } = (req.body ?? {}) as {
      email?: unknown;
      plan?: unknown;
      expires_at?: unknown;
    };

    if (typeof email !== "string" || !email.trim()) {
      res.status(400).json({ error: "email is required" });
      return;
    }
    if (typeof plan !== "string" || !GRANTABLE_PLANS.includes(plan as SubscriptionPlan)) {
      res.status(400).json({ error: `plan must be one of: ${GRANTABLE_PLANS.join(", ")}` });
      return;
    }
    const expiresAtDate = typeof expiresAt === "string" ? new Date(expiresAt) : null;
    if (!expiresAtDate || Number.isNaN(expiresAtDate.getTime()) || expiresAtDate <= new Date()) {
      res.status(400).json({ error: "expires_at must be a valid future ISO date" });
      return;
    }

    const targetUser = await findUserByEmail(email);
    if (!targetUser) {
      res.status(404).json({ error: `No user found with email ${email}` });
      return;
    }

    const existingSubscription = await getSubscriptionByUserId(targetUser.id);
    if (
      existingSubscription?.status === "active" &&
      existingSubscription.apple_transaction_id
    ) {
      res.status(409).json({
        error:
          "This user already has an active paid subscription verified through Apple. Granting a comp subscription would overwrite it, so this was blocked.",
      });
      return;
    }

    const grantedPlan = plan as SubscriptionPlan;
    const expiresAtIso = expiresAtDate.toISOString();

    await upsertSubscription({
      userId: targetUser.id,
      plan: grantedPlan,
      status: "active",
      renewsAt: expiresAtIso,
    });
    const grant = await createSubscriptionGrant({
      userId: targetUser.id,
      grantedByAdminId: req.currentUser!.id,
      plan: grantedPlan,
      expiresAt: expiresAtIso,
    });
    await createUserNotification({
      userId: targetUser.id,
      type: "comp_subscription_grant",
      payload: { plan: grantedPlan, expires_at: expiresAtIso },
    });
    void sendEmailBestEffort({ to: targetUser.email, ...compGrantEmail(grantedPlan, expiresAtIso) });
    await logLifecycleEvent({
      userId: targetUser.id,
      userEmail: targetUser.email,
      eventType: "mover_admin_grant",
      details: {
        grant_id: grant.id,
        plan: grantedPlan,
        expires_at: expiresAtIso,
        granted_by_admin_id: req.currentUser!.id,
      },
    });

    res.status(201).json({ user_id: targetUser.id, plan: grantedPlan, expires_at: expiresAtIso });
  }),
);

/**
 * Ends a comp subscription grant before its natural expiry. Only touches the
 * beneficiary's live subscription row if it still reflects that grant (no Apple
 * transaction id) — if they've since bought a real subscription, revoking the old
 * grant must not clobber a legitimate paid sub, so only the grant record itself gets
 * marked revoked in that case.
 */
adminRouter.post(
  "/grants/:id/revoke",
  requireUser,
  requireAdminUser,
  asyncHandler(async (req, res) => {
    if (!(await requireTwoFactorCode(req, res))) return;

    const grant = await getSubscriptionGrantById(req.params.id);
    if (!grant) {
      res.status(404).json({ error: "Grant not found" });
      return;
    }
    if (grant.revoked_at) {
      res.status(409).json({ error: "This grant was already revoked." });
      return;
    }

    const beneficiary = await findUserById(grant.user_id);
    const currentSubscription = await getSubscriptionByUserId(grant.user_id);
    let subscriptionTouched = false;
    if (currentSubscription && !currentSubscription.apple_transaction_id) {
      await upsertSubscription({
        userId: grant.user_id,
        plan: currentSubscription.plan,
        status: "revoked",
        renewsAt: currentSubscription.renews_at ?? undefined,
      });
      subscriptionTouched = true;
    }

    const revoked = await revokeSubscriptionGrant(grant.id, req.currentUser!.id);

    if (beneficiary) {
      await createUserNotification({
        userId: beneficiary.id,
        type: "comp_subscription_revoked",
        payload: { plan: grant.plan },
      });
      void sendEmailBestEffort({ to: beneficiary.email, ...compRevokeEmail(grant.plan) });
      await logLifecycleEvent({
        userId: beneficiary.id,
        userEmail: beneficiary.email,
        eventType: "mover_admin_grant_revoked",
        details: {
          grant_id: grant.id,
          plan: grant.plan,
          revoked_by_admin_id: req.currentUser!.id,
          subscription_downgraded: subscriptionTouched,
        },
      });
    }

    res.json({ ...revoked, subscription_downgraded: subscriptionTouched });
  }),
);

adminRouter.get(
  "/stats",
  requireAdminAccount,
  asyncHandler(async (_req, res) => {
    const stats = await getAdminStats();
    res.json(stats);
  }),
);

/**
 * Leaver via lapse — see subscriptionLifecycle.service.ts's header comment for why
 * this exists as an endpoint rather than something automatic. No scheduler is wired up
 * in this repo yet, so for now this needs to be triggered manually or from an external
 * cron (e.g. a Railway Cron Job hitting this with the admin Bearer token) until one
 * exists. Idempotent — safe to call as often as needed.
 */
adminRouter.post(
  "/jobs/expire-subscriptions",
  requireUser,
  requireAdminUser,
  asyncHandler(async (_req, res) => {
    const result = await expireLapsedSubscriptions();
    res.json(result);
  }),
);

adminRouter.get(
  "/lifecycle-events",
  requireUser,
  requireAdminUser,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const events = await getRecentLifecycleEvents(limit);
    res.json(events);
  }),
);

/**
 * The "let the developer act on reports" half of Guideline 1.2's UGC requirement —
 * report intake lives in forum.routes.ts (any authenticated user), resolution lives
 * here (admin-only). Bearer-auth JSON form for the mobile app / scripts; the dashboard
 * below also has a same-effect HTML form for browser use.
 */
adminRouter.get(
  "/forum-reports",
  requireUser,
  requireAdminUser,
  asyncHandler(async (_req, res) => {
    const reports = await getOpenForumReports();
    res.json(reports);
  }),
);

adminRouter.post(
  "/forum-reports/:id/resolve",
  requireUser,
  requireAdminUser,
  asyncHandler(async (req, res) => {
    const hideContent = (req.body as { hide_content?: unknown })?.hide_content === true;
    const resolved = await resolveForumReport(req.params.id, req.currentUser!.id, hideContent);
    if (!resolved) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    res.json(resolved);
  }),
);

// Same action as above, reachable from the HTML dashboard's own auth (Basic, not
// Bearer) — the dashboard's browser fetch() can't carry a session token, only whatever
// credentials it already authenticated the page load with.
adminRouter.post(
  "/forum-reports/:id/resolve-dashboard",
  requireAdminAccount,
  asyncHandler(async (req, res) => {
    const hideContent = (req.body as { hide_content?: unknown })?.hide_content === true;
    const resolved = await resolveForumReport(req.params.id, req.currentUser!.id, hideContent);
    if (!resolved) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    res.json(resolved);
  }),
);

function validateSupportMessage(body: unknown): string | null {
  const message = (body as { message?: unknown })?.message;
  if (typeof message !== "string" || !message.trim() || message.length > 4000) {
    return null;
  }
  return message.trim();
}

/**
 * Closes the loop on feedback/support requests — previously admin could only view what
 * a user sent (see getRecentFeedbackForAdmin), with no way to respond. Emails the
 * sender directly; if the account since deleted itself (feedback.user_id survives via
 * ON DELETE SET NULL upstream), the reply is still recorded but has nowhere to send.
 */
async function handleFeedbackReply(req: Request, res: Response) {
  const message = validateSupportMessage(req.body);
  if (!message) {
    res.status(400).json({ error: "message is required (max 4000 characters)" });
    return;
  }

  const feedback = await getFeedbackById(req.params.id);
  if (!feedback) {
    res.status(404).json({ error: "Feedback not found" });
    return;
  }

  const reply = await createFeedbackReply({
    feedbackId: feedback.id,
    adminId: req.currentUser!.id,
    message,
  });

  if (feedback.user_id) {
    const user = await findUserById(feedback.user_id);
    if (user) {
      void sendEmailBestEffort({ to: user.email, ...supportReplyEmail(feedback.message, message) });
    }
  }

  res.status(201).json(reply);
}

adminRouter.post(
  "/feedback/:id/reply",
  requireUser,
  requireAdminUser,
  asyncHandler(async (req, res) => handleFeedbackReply(req, res)),
);

// Same dashboard-vs-Bearer split as forum-reports/:id/resolve-dashboard above.
adminRouter.post(
  "/feedback/:id/reply-dashboard",
  requireAdminAccount,
  asyncHandler(async (req, res) => handleFeedbackReply(req, res)),
);

/**
 * Lets admin proactively reach out to any user/business directly from the portal —
 * distinct from replying to an existing feedback thread, for cases where support needs
 * to initiate contact rather than respond to one.
 */
async function handleDirectContact(req: Request, res: Response) {
  const message = validateSupportMessage(req.body);
  if (!message) {
    res.status(400).json({ error: "message is required (max 4000 characters)" });
    return;
  }

  const user = await findUserById(req.params.id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  void sendEmailBestEffort({ to: user.email, ...adminDirectContactEmail(message) });
  res.status(200).json({ message: "Message sent." });
}

adminRouter.post(
  "/users/:id/contact",
  requireUser,
  requireAdminUser,
  asyncHandler(async (req, res) => handleDirectContact(req, res)),
);

adminRouter.post(
  "/users/:id/contact-dashboard",
  requireAdminAccount,
  asyncHandler(async (req, res) => handleDirectContact(req, res)),
);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

adminRouter.get(
  "/",
  requireAdminAccount,
  asyncHandler(async (_req, res) => {
    const stats = await getAdminStats();

    const userRows = stats.recentUsers
      .map(
        (u) =>
          `<tr id="user-${u.id}"><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.role)}</td><td>${new Date(u.created_at).toLocaleString()}</td>` +
          `<td><button onclick="contactUser('${u.id}')">Contact</button></td></tr>`,
      )
      .join("");

    const feedbackRows = stats.recentFeedback
      .map(
        (f) =>
          `<tr id="feedback-${f.id}"><td>${f.is_priority ? "⭐ Priority" : ""}</td>` +
          `<td>${f.user_email ? escapeHtml(f.user_email) : "<em>account deleted</em>"}</td>` +
          `<td>${escapeHtml(f.message)}</td>` +
          `<td>${f.reply_count > 0 ? `✓ replied (${f.reply_count})` : ""}</td>` +
          `<td>${new Date(f.created_at).toLocaleString()}</td>` +
          `<td>${f.user_id ? `<button onclick="replyToFeedback('${f.id}')">Reply</button>` : ""}</td></tr>`,
      )
      .join("");

    const planRows = stats.subscriptionsByPlan
      .map((p) => `<tr><td>${escapeHtml(p.plan)}</td><td>${p.count}</td></tr>`)
      .join("");

    const errorRows = stats.recentErrors
      .map(
        (e) =>
          `<tr class="error-row" title="${escapeHtml(e.stack ?? e.message)}">` +
          `<td>${new Date(e.created_at).toLocaleString()}</td>` +
          `<td><span class="status-pill status-${e.status_code ?? 500}">${e.status_code ?? "—"}</span></td>` +
          `<td>${escapeHtml(e.method)} ${escapeHtml(e.path)}</td>` +
          `<td>${escapeHtml(e.message)}</td></tr>`,
      )
      .join("");

    const usageRows = stats.usageEventTotals
      .map((u) => `<tr><td>${escapeHtml(u.event_type)}</td><td>${u.count}</td></tr>`)
      .join("");

    const grantRows = stats.recentSubscriptionGrants
      .map(
        (g) =>
          `<tr><td>${escapeHtml(g.grantee_email)}</td><td>${escapeHtml(g.plan)}</td>` +
          `<td>${g.granter_email ? escapeHtml(g.granter_email) : "<em>admin deleted</em>"}</td>` +
          `<td>${new Date(g.expires_at).toLocaleDateString()}</td>` +
          `<td>${g.revoked_at ? `<span class="status-pill status-5">revoked ${new Date(g.revoked_at).toLocaleDateString()}</span>` : ""}</td>` +
          `<td>${new Date(g.created_at).toLocaleString()}</td></tr>`,
      )
      .join("");

    const forumReportRows = stats.openForumReports
      .map(
        (r) =>
          `<tr id="report-${r.id}"><td>${new Date(r.created_at).toLocaleString()}</td>` +
          `<td>${escapeHtml(r.target_type)}</td>` +
          `<td>${escapeHtml(r.target_id)}</td>` +
          `<td>${escapeHtml(r.reason)}</td>` +
          `<td>` +
          `<button onclick="resolveReport('${r.id}', false)">Dismiss</button> ` +
          `<button onclick="resolveReport('${r.id}', true)">Hide content</button>` +
          `</td></tr>`,
      )
      .join("");

    const lifecycleEventRows = stats.recentLifecycleEvents
      .map(
        (e) =>
          `<tr><td>${new Date(e.created_at).toLocaleString()}</td>` +
          `<td>${escapeHtml(e.event_type)}</td>` +
          `<td>${escapeHtml(e.user_email)}</td>` +
          `<td>${escapeHtml(JSON.stringify(e.details))}</td></tr>`,
      )
      .join("");

    const errorHealthClass =
      stats.errorCountLast24h === 0 ? "ok" : stats.errorCountLast24h < 10 ? "warn" : "bad";

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>LashlyAI Admin</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", sans-serif; background: #F7E8E3; color: #2B2B2B; padding: 0; margin: 0; }
    header { background: #2B2B2B; color: #fff; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; }
    header h1 { font-size: 18px; margin: 0; font-weight: 700; }
    header .subtitle { font-size: 12px; color: #C9A45C; }
    main { padding: 24px 32px 48px; max-width: 1100px; margin: 0 auto; }
    h2 { font-size: 15px; color: #2B2B2B; border-left: 4px solid #D98FAF; padding-left: 10px; }
    .cards { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 32px; }
    .card { background: #fff; border-radius: 10px; padding: 16px 24px; min-width: 140px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .card .value { font-size: 28px; font-weight: 700; color: #D98FAF; }
    .card .label { font-size: 12px; color: #C9A45C; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
    .card.ok .value { color: #2E7D32; }
    .card.warn .value { color: #C9A45C; }
    .card.bad .value { color: #B3261E; }
    table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 10px; overflow: hidden; margin-bottom: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    th, td { text-align: left; padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
    th { background: #fafafa; color: #C9A45C; text-transform: uppercase; font-size: 11px; letter-spacing: 0.03em; }
    tr:last-child td { border-bottom: none; }
    section { margin-bottom: 40px; }
    .status-pill { padding: 2px 8px; border-radius: 10px; font-weight: 700; font-size: 11px; }
    .status-pill[class*="status-4"] { background: #FFF3CD; color: #7A5B00; }
    .status-pill[class*="status-5"] { background: #FCE4E4; color: #B3261E; }
    .error-row td { font-family: ui-monospace, monospace; font-size: 12px; }
    .empty { color: #999; font-style: italic; padding: 12px; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>LashlyAI Admin</h1>
      <div class="subtitle">Enterprise monitoring dashboard</div>
    </div>
  </header>
  <main>
    <div class="cards">
      <div class="card ${errorHealthClass}"><div class="value">${stats.errorCountLast24h}</div><div class="label">Errors (24h)</div></div>
      <div class="card"><div class="value">${stats.totalUsers}</div><div class="label">Users</div></div>
      <div class="card"><div class="value">${stats.totalClients}</div><div class="label">Client Profiles</div></div>
      <div class="card"><div class="value">${stats.totalLashMaps}</div><div class="label">Lash Maps</div></div>
      <div class="card"><div class="value">${stats.mockEyeAnalysisCount}</div><div class="label">Unverified (Mock) AI Outputs</div></div>
    </div>

    <section>
      <h2>Recent Errors (hover a row for the full stack trace)</h2>
      <table><tr><th>Time</th><th>Status</th><th>Route</th><th>Message</th></tr>${errorRows || '<tr><td colspan="4" class="empty">No errors logged — clean bill of health.</td></tr>'}</table>
    </section>

    <section>
      <h2>Subscriptions by Plan</h2>
      <table><tr><th>Plan</th><th>Count</th></tr>${planRows || '<tr><td colspan="2" class="empty">None yet</td></tr>'}</table>
    </section>

    <section>
      <h2>Complimentary Subscription Grants</h2>
      <table><tr><th>Grantee</th><th>Plan</th><th>Granted By</th><th>Expires</th><th>Status</th><th>Granted On</th></tr>${grantRows || '<tr><td colspan="6" class="empty">None yet</td></tr>'}</table>
    </section>

    <section>
      <h2>Open Forum Reports</h2>
      <table><tr><th>Reported</th><th>Type</th><th>Target ID</th><th>Reason</th><th>Action</th></tr>${forumReportRows || '<tr><td colspan="5" class="empty">No open reports.</td></tr>'}</table>
    </section>

    <section>
      <h2>Joiner / Mover / Leaver Lifecycle Events (most recent 30)</h2>
      <table><tr><th>Time</th><th>Event</th><th>User</th><th>Details</th></tr>${lifecycleEventRows || '<tr><td colspan="4" class="empty">None yet</td></tr>'}</table>
    </section>

    <section>
      <h2>Usage Totals (all-time, by feature)</h2>
      <table><tr><th>Event Type</th><th>Count</th></tr>${usageRows || '<tr><td colspan="2" class="empty">None yet</td></tr>'}</table>
    </section>

    <section>
      <h2>Recent Signups</h2>
      <table><tr><th>Email</th><th>Role</th><th>Signed Up</th><th>Action</th></tr>${userRows || '<tr><td colspan="4" class="empty">None yet</td></tr>'}</table>
    </section>

    <section>
      <h2>Recent Feedback</h2>
      <table><tr><th>Priority</th><th>From</th><th>Message</th><th>Status</th><th>Submitted</th><th>Action</th></tr>${feedbackRows || '<tr><td colspan="6" class="empty">None yet</td></tr>'}</table>
    </section>
  </main>
  <script>
    // Reuses the browser's own cached HTTP Basic Auth credentials for this realm — no
    // separate token needed since the admin already authenticated to load this page.
    async function resolveReport(id, hideContent) {
      const res = await fetch('/admin/forum-reports/' + id + '/resolve-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hide_content: hideContent }),
      });
      if (res.ok) {
        document.getElementById('report-' + id).remove();
      } else {
        alert('Failed to resolve report (' + res.status + ')');
      }
    }

    async function replyToFeedback(id) {
      const message = prompt('Reply to this feedback (emails the sender):');
      if (!message || !message.trim()) return;
      const res = await fetch('/admin/feedback/' + id + '/reply-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });
      if (res.ok) {
        alert('Reply sent.');
        location.reload();
      } else {
        const body = await res.json().catch(() => ({}));
        alert('Failed to send reply: ' + (body.error || res.status));
      }
    }

    async function contactUser(id) {
      const message = prompt('Message to send this user by email:');
      if (!message || !message.trim()) return;
      const res = await fetch('/admin/users/' + id + '/contact-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });
      if (res.ok) {
        alert('Message sent.');
      } else {
        const body = await res.json().catch(() => ({}));
        alert('Failed to send message: ' + (body.error || res.status));
      }
    }
  </script>
</body>
</html>`);
  }),
);
