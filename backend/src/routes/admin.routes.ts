import { Router } from "express";
import { requireAdmin } from "./middleware/requireAdmin";
import { getAdminStats } from "../models/Admin";
import { asyncHandler } from "../utils/asyncHandler";

export const adminRouter = Router();

adminRouter.get(
  "/stats",
  requireAdmin,
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
  requireAdmin,
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
          `<tr><td>${escapeHtml(f.message)}</td><td>${new Date(f.created_at).toLocaleString()}</td></tr>`,
      )
      .join("");

    const planRows = stats.subscriptionsByPlan
      .map((p) => `<tr><td>${escapeHtml(p.plan)}</td><td>${p.count}</td></tr>`)
      .join("");

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>LashlyAI Admin</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #F7E8E3; color: #2B2B2B; padding: 24px; }
    h1 { color: #2B2B2B; }
    .cards { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 32px; }
    .card { background: #fff; border-radius: 10px; padding: 16px 24px; min-width: 140px; }
    .card .value { font-size: 28px; font-weight: 700; color: #D98FAF; }
    .card .label { font-size: 12px; color: #C9A45C; margin-top: 4px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 10px; overflow: hidden; margin-bottom: 32px; }
    th, td { text-align: left; padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
    th { background: #fafafa; color: #C9A45C; }
    section { margin-bottom: 32px; }
  </style>
</head>
<body>
  <h1>LashlyAI Admin</h1>
  <div class="cards">
    <div class="card"><div class="value">${stats.totalUsers}</div><div class="label">Users</div></div>
    <div class="card"><div class="value">${stats.totalClients}</div><div class="label">Client Profiles</div></div>
    <div class="card"><div class="value">${stats.totalLashMaps}</div><div class="label">Lash Maps</div></div>
    <div class="card"><div class="value">${stats.mockEyeAnalysisCount}</div><div class="label">Unverified (Mock) AI Outputs</div></div>
  </div>

  <section>
    <h2>Subscriptions by Plan</h2>
    <table><tr><th>Plan</th><th>Count</th></tr>${planRows || '<tr><td colspan="2">None yet</td></tr>'}</table>
  </section>

  <section>
    <h2>Recent Signups</h2>
    <table><tr><th>Email</th><th>Role</th><th>Signed Up</th></tr>${userRows || '<tr><td colspan="3">None yet</td></tr>'}</table>
  </section>

  <section>
    <h2>Recent Feedback</h2>
    <table><tr><th>Message</th><th>Submitted</th></tr>${feedbackRows || '<tr><td colspan="2">None yet</td></tr>'}</table>
  </section>
</body>
</html>`);
  }),
);
