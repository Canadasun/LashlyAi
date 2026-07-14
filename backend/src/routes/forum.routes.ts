import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import {
  createForumComment,
  createForumPost,
  getForumCommentsByPostId,
  getForumPostById,
  getForumPosts,
} from "../models/Forum";
import { asyncHandler } from "../utils/asyncHandler";
import { checkForumPostQuota } from "../services/planLimits.service";
import { logUsageEvent } from "../models/UsageEvent";

export const forumRouter = Router();

forumRouter.post(
  "/posts",
  requireUser,
  asyncHandler(async (req, res) => {
    const { title, body } = req.body ?? {};
    if (!title || typeof title !== "string" || !body || typeof body !== "string") {
      res.status(400).json({ error: "title and body are required" });
      return;
    }

    const quota = await checkForumPostQuota(req.currentUser!.id);
    if (!quota.allowed) {
      res.status(403).json({
        error: `Free plan is limited to ${quota.limit} forum posts per month. Upgrade to Pro for unlimited access.`,
      });
      return;
    }

    const post = await createForumPost({ userId: req.currentUser!.id, title, body });
    await logUsageEvent(req.currentUser!.id, "forum_post");
    res.status(201).json(post);
  }),
);

forumRouter.get(
  "/posts",
  requireUser,
  asyncHandler(async (_req, res) => {
    const posts = await getForumPosts();
    res.json(posts);
  }),
);

forumRouter.get(
  "/posts/:id",
  requireUser,
  asyncHandler(async (req, res) => {
    const post = await getForumPostById(req.params.id);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const comments = await getForumCommentsByPostId(post.id);
    res.json({ ...post, comments });
  }),
);

forumRouter.post(
  "/posts/:id/comments",
  requireUser,
  asyncHandler(async (req, res) => {
    const post = await getForumPostById(req.params.id);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const { body } = req.body ?? {};
    if (!body || typeof body !== "string") {
      res.status(400).json({ error: "body is required" });
      return;
    }
    const comment = await createForumComment({
      postId: post.id,
      userId: req.currentUser!.id,
      body,
    });
    res.status(201).json(comment);
  }),
);
