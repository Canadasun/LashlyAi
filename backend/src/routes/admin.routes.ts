import { Router } from "express";
import { requireAdminAccount } from "./middleware/requireAdminAccount";
import { requireUser } from "./middleware/requireUser";
import { requireAdminUser } from "./middleware/requireAdminUser";
import { getAdminStats } from "../models/Admin";
import { asyncHandler } from "../utils/asyncHandler";
import { findUserByEmail } from "../models/User";
import { getSubscriptionByUserId, SubscriptionPlan, upsertSubscription } from "../models/Subscription";
import { createSubscriptionGrant } from "../models/SubscriptionGrant";
import { createUserNotification } from "../models/UserNotification";

export const adminRouter = Router();

const GRANTABLE_PLANS: SubscriptionPlan[] = ["pro", "educator", "salon", "enterprise"];

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
    await createSubscriptionGrant({
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

    res.status(201).json({ user_id: targetUser.id, plan: grantedPlan, expires_at: expiresAtIso });
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
          `<tr><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.role)}</td><td>${new Date(u.created_at).toLocaleString()}</td></tr>`,
      )
      .join("");

    const feedbackRows = stats.recentFeedback
      .map(
        (f) =>
          `<tr><td>${f.is_priority ? "⭐ Priority" : ""}</td><td>${escapeHtml(f.message)}</td><td>${new Date(f.created_at).toLocaleString()}</td></tr>`,
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
          `<td>${escapeHtml(g.granter_email)}</td>` +
          `<td>${new Date(g.expires_at).toLocaleDateString()}</td>` +
          `<td>${new Date(g.created_at).toLocaleString()}</td></tr>`,
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
      <table><tr><th>Grantee</th><th>Plan</th><th>Granted By</th><th>Expires</th><th>Granted On</th></tr>${grantRows || '<tr><td colspan="5" class="empty">None yet</td></tr>'}</table>
    </section>

    <section>
      <h2>Usage Totals (all-time, by feature)</h2>
      <table><tr><th>Event Type</th><th>Count</th></tr>${usageRows || '<tr><td colspan="2" class="empty">None yet</td></tr>'}</table>
    </section>

    <section>
      <h2>Recent Signups</h2>
      <table><tr><th>Email</th><th>Role</th><th>Signed Up</th></tr>${userRows || '<tr><td colspan="3" class="empty">None yet</td></tr>'}</table>
    </section>

    <section>
      <h2>Recent Feedback</h2>
      <table><tr><th>Priority</th><th>Message</th><th>Submitted</th></tr>${feedbackRows || '<tr><td colspan="3" class="empty">None yet</td></tr>'}</table>
    </section>
  </main>
</body>
</html>`);
  }),
);
