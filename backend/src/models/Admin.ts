import { pool } from "../db";
import { getRecentErrorLogs, getErrorLogCountSince, ErrorLog } from "./ErrorLog";
import { getRecentLifecycleEvents, UserLifecycleEvent } from "./UserLifecycleEvent";

export interface AdminStats {
  totalUsers: number;
  recentUsers: { id: string; email: string; role: string; created_at: string }[];
  totalClients: number;
  totalLashMaps: number;
  mockEyeAnalysisCount: number;
  recentFeedback: { id: string; message: string; is_priority: boolean; created_at: string }[];
  subscriptionsByPlan: { plan: string; count: number }[];
  errorCountLast24h: number;
  recentErrors: ErrorLog[];
  usageEventTotals: { event_type: string; count: number }[];
  recentSubscriptionGrants: {
    id: string;
    user_id: string;
    granted_by_admin_id: string | null;
    plan: string;
    expires_at: string;
    revoked_at: string | null;
    created_at: string;
    grantee_email: string;
    granter_email: string | null;
  }[];
  recentLifecycleEvents: UserLifecycleEvent[];
}

export async function getAdminStats(): Promise<AdminStats> {
  const [
    totalUsersResult,
    recentUsersResult,
    totalClientsResult,
    totalLashMapsResult,
    mockEyeAnalysisResult,
    recentFeedbackResult,
    subscriptionsByPlanResult,
    errorCountLast24hResult,
    recentErrorsResult,
    usageEventTotalsResult,
    recentSubscriptionGrantsResult,
    recentLifecycleEventsResult,
  ] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS count FROM users"),
    pool.query(
      "SELECT id, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 20",
    ),
    pool.query("SELECT COUNT(*)::int AS count FROM client_profiles"),
    pool.query("SELECT COUNT(*)::int AS count FROM lash_maps"),
    pool.query(
      "SELECT COUNT(*)::int AS count FROM client_profiles WHERE eye_analysis ->> 'mock' = 'true'",
    ),
    pool.query(
      "SELECT id, message, is_priority, created_at FROM feedback ORDER BY is_priority DESC, created_at DESC LIMIT 20",
    ),
    pool.query("SELECT plan, COUNT(*)::int AS count FROM subscriptions GROUP BY plan"),
    getErrorLogCountSince(24),
    getRecentErrorLogs(30),
    pool.query(
      "SELECT event_type, COUNT(*)::int AS count FROM usage_events GROUP BY event_type ORDER BY count DESC",
    ),
    pool.query(
      `SELECT g.id, g.user_id, g.granted_by_admin_id, g.plan, g.expires_at, g.revoked_at, g.created_at,
              grantee.email AS grantee_email, granter.email AS granter_email
       FROM subscription_grants g
       JOIN users grantee ON grantee.id = g.user_id
       LEFT JOIN users granter ON granter.id = g.granted_by_admin_id
       ORDER BY g.created_at DESC
       LIMIT 20`,
    ),
    getRecentLifecycleEvents(30),
  ]);

  return {
    totalUsers: totalUsersResult.rows[0].count,
    recentUsers: recentUsersResult.rows,
    totalClients: totalClientsResult.rows[0].count,
    totalLashMaps: totalLashMapsResult.rows[0].count,
    mockEyeAnalysisCount: mockEyeAnalysisResult.rows[0].count,
    recentFeedback: recentFeedbackResult.rows,
    subscriptionsByPlan: subscriptionsByPlanResult.rows,
    errorCountLast24h: errorCountLast24hResult,
    recentErrors: recentErrorsResult,
    usageEventTotals: usageEventTotalsResult.rows,
    recentSubscriptionGrants: recentSubscriptionGrantsResult.rows,
    recentLifecycleEvents: recentLifecycleEventsResult,
  };
}
