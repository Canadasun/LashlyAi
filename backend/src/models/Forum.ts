import { pool } from "../db";

export interface ForumPost {
  id: string;
  user_id: string;
  author_display_name: string;
  title: string;
  body: string;
  comment_count: number;
  created_at: string;
}

export interface ForumComment {
  id: string;
  post_id: string;
  user_id: string;
  author_display_name: string;
  body: string;
  created_at: string;
}

export type ForumReportTargetType = "post" | "comment";

export interface ForumReport {
  id: string;
  reporter_user_id: string | null;
  target_type: ForumReportTargetType;
  target_id: string;
  reason: string;
  status: "open" | "resolved";
  resolved_at: string | null;
  resolved_by_admin_id: string | null;
  created_at: string;
}

// Community posts show a first-name-style handle, never the underlying email — this is
// the same local-part-derivation the mobile Dashboard already uses for greetings, reused
// here for consistency rather than inventing a second convention.
function deriveDisplayName(email: string): string {
  const local = email.split("@")[0] || email;
  const first = local.split(/[._-]/)[0] || local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export async function createForumPost(input: {
  userId: string;
  title: string;
  body: string;
}): Promise<ForumPost> {
  const result = await pool.query(
    `INSERT INTO forum_posts (user_id, title, body)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.userId, input.title, input.body],
  );
  const post = result.rows[0];
  const userResult = await pool.query("SELECT email FROM users WHERE id = $1", [input.userId]);
  return {
    ...post,
    author_display_name: deriveDisplayName(userResult.rows[0]?.email ?? ""),
    comment_count: 0,
  };
}

// viewerUserId scopes out hidden (moderated-away) posts and posts from anyone the
// viewer has blocked — filtering happens here, not client-side, so a blocked author's
// content never reaches the device at all.
export async function getForumPosts(viewerUserId: string): Promise<ForumPost[]> {
  const result = await pool.query(
    `SELECT p.*, u.email AS author_email,
            (SELECT COUNT(*)::int FROM forum_comments c WHERE c.post_id = p.id AND c.hidden = false) AS comment_count
     FROM forum_posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.hidden = false
       AND NOT EXISTS (
         SELECT 1 FROM forum_blocks b
         WHERE b.blocker_user_id = $1 AND b.blocked_user_id = p.user_id
       )
     ORDER BY p.created_at DESC`,
    [viewerUserId],
  );
  return result.rows.map((row) => ({
    ...row,
    author_display_name: deriveDisplayName(row.author_email),
  }));
}

export async function getForumPostById(id: string, viewerUserId: string): Promise<ForumPost | null> {
  const result = await pool.query(
    `SELECT p.*, u.email AS author_email,
            (SELECT COUNT(*)::int FROM forum_comments c WHERE c.post_id = p.id AND c.hidden = false) AS comment_count
     FROM forum_posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = $1
       AND p.hidden = false
       AND NOT EXISTS (
         SELECT 1 FROM forum_blocks b
         WHERE b.blocker_user_id = $2 AND b.blocked_user_id = p.user_id
       )`,
    [id, viewerUserId],
  );
  const row = result.rows[0];
  return row ? { ...row, author_display_name: deriveDisplayName(row.author_email) } : null;
}

export async function createForumComment(input: {
  postId: string;
  userId: string;
  body: string;
}): Promise<ForumComment> {
  const result = await pool.query(
    `INSERT INTO forum_comments (post_id, user_id, body)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.postId, input.userId, input.body],
  );
  const comment = result.rows[0];
  const userResult = await pool.query("SELECT email FROM users WHERE id = $1", [input.userId]);
  return { ...comment, author_display_name: deriveDisplayName(userResult.rows[0]?.email ?? "") };
}

export async function getForumCommentsByPostId(
  postId: string,
  viewerUserId: string,
): Promise<ForumComment[]> {
  const result = await pool.query(
    `SELECT c.*, u.email AS author_email
     FROM forum_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = $1
       AND c.hidden = false
       AND NOT EXISTS (
         SELECT 1 FROM forum_blocks b
         WHERE b.blocker_user_id = $2 AND b.blocked_user_id = c.user_id
       )
     ORDER BY c.created_at ASC`,
    [postId, viewerUserId],
  );
  return result.rows.map((row) => ({
    ...row,
    author_display_name: deriveDisplayName(row.author_email),
  }));
}

export async function reportForumContent(input: {
  reporterUserId: string;
  targetType: ForumReportTargetType;
  targetId: string;
  reason: string;
}): Promise<ForumReport> {
  const result = await pool.query<ForumReport>(
    `INSERT INTO forum_reports (reporter_user_id, target_type, target_id, reason)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.reporterUserId, input.targetType, input.targetId, input.reason],
  );
  return result.rows[0];
}

export async function getOpenForumReports(): Promise<ForumReport[]> {
  const result = await pool.query<ForumReport>(
    `SELECT * FROM forum_reports WHERE status = 'open' ORDER BY created_at ASC`,
  );
  return result.rows;
}

export async function getForumReportById(id: string): Promise<ForumReport | null> {
  const result = await pool.query<ForumReport>(`SELECT * FROM forum_reports WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

// hideContent lets the admin act on a report by removing the offending post/comment in
// the same step, rather than requiring a second manual lookup-and-hide action.
export async function resolveForumReport(
  id: string,
  adminId: string,
  hideContent: boolean,
): Promise<ForumReport | null> {
  const report = await getForumReportById(id);
  if (!report) return null;

  if (hideContent) {
    const table = report.target_type === "post" ? "forum_posts" : "forum_comments";
    await pool.query(`UPDATE ${table} SET hidden = true WHERE id = $1`, [report.target_id]);
  }

  const result = await pool.query<ForumReport>(
    `UPDATE forum_reports
     SET status = 'resolved', resolved_at = now(), resolved_by_admin_id = $2
     WHERE id = $1
     RETURNING *`,
    [id, adminId],
  );
  return result.rows[0];
}

export async function blockForumUser(blockerUserId: string, blockedUserId: string): Promise<void> {
  await pool.query(
    `INSERT INTO forum_blocks (blocker_user_id, blocked_user_id)
     VALUES ($1, $2)
     ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING`,
    [blockerUserId, blockedUserId],
  );
}

export async function unblockForumUser(blockerUserId: string, blockedUserId: string): Promise<void> {
  await pool.query(
    `DELETE FROM forum_blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2`,
    [blockerUserId, blockedUserId],
  );
}

export async function getBlockedUserIds(blockerUserId: string): Promise<string[]> {
  const result = await pool.query<{ blocked_user_id: string }>(
    `SELECT blocked_user_id FROM forum_blocks WHERE blocker_user_id = $1`,
    [blockerUserId],
  );
  return result.rows.map((row) => row.blocked_user_id);
}
