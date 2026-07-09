import { pool } from "../db";

export interface ForumPost {
  id: string;
  user_id: string;
  author_email: string;
  title: string;
  body: string;
  comment_count: number;
  created_at: string;
}

export interface ForumComment {
  id: string;
  post_id: string;
  user_id: string;
  author_email: string;
  body: string;
  created_at: string;
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
  return { ...post, author_email: userResult.rows[0]?.email ?? "", comment_count: 0 };
}

export async function getForumPosts(): Promise<ForumPost[]> {
  const result = await pool.query<ForumPost>(
    `SELECT p.*, u.email AS author_email,
            (SELECT COUNT(*)::int FROM forum_comments c WHERE c.post_id = p.id) AS comment_count
     FROM forum_posts p
     JOIN users u ON u.id = p.user_id
     ORDER BY p.created_at DESC`,
  );
  return result.rows;
}

export async function getForumPostById(id: string): Promise<ForumPost | null> {
  const result = await pool.query<ForumPost>(
    `SELECT p.*, u.email AS author_email,
            (SELECT COUNT(*)::int FROM forum_comments c WHERE c.post_id = p.id) AS comment_count
     FROM forum_posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
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
  return { ...comment, author_email: userResult.rows[0]?.email ?? "" };
}

export async function getForumCommentsByPostId(postId: string): Promise<ForumComment[]> {
  const result = await pool.query<ForumComment>(
    `SELECT c.*, u.email AS author_email
     FROM forum_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = $1
     ORDER BY c.created_at ASC`,
    [postId],
  );
  return result.rows;
}
