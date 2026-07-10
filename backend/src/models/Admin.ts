import { pool } from "../db";

export interface AdminStats {
  totalUsers: number;
  recentUsers: { id: string; email: string; role: string; created_at: string }[];
  totalClients: number;
  totalLashMaps: number;
  mockEyeAnalysisCount: number;
  recentFeedback: { id: string; message: string; is_priority: boolean; created_at: string }[];
  subscriptionsByPlan: { plan: string; count: number }[];
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
  ]);

  return {
    totalUsers: totalUsersResult.rows[0].count,
    recentUsers: recentUsersResult.rows,
    totalClients: totalClientsResult.rows[0].count,
    totalLashMaps: totalLashMapsResult.rows[0].count,
    mockEyeAnalysisCount: mockEyeAnalysisResult.rows[0].count,
    recentFeedback: recentFeedbackResult.rows,
    subscriptionsByPlan: subscriptionsByPlanResult.rows,
  };
}
