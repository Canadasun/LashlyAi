import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireUser } from "./middleware/requireUser";
import {
  blockForumUser,
  createForumComment,
  createForumPost,
  getForumCommentsByPostId,
  getForumPostById,
  getForumPosts,
  reportForumContent,
  unblockForumUser,
} from "../models/Forum";
import { asyncHandler } from "../utils/asyncHandler";
import { checkForumPostQuota } from "../services/planLimits.service";
import { logUsageEvent } from "../models/UsageEvent";
import { sendEmailBestEffort } from "../services/email.service";
import { sendSmsBestEffort } from "../services/sms.service";
import {
  ADMIN_ALERT_EMAIL,
  ADMIN_ALERT_PHONE_NUMBER,
  adminNewForumReportEmail,
  adminNewForumReportSms,
} from "../services/notificationTemplates";
import { ForumReport } from "../models/Forum";

export const forumRouter = Router();

// Reporting is the one forum action with no plan/quota gate anywhere else in this file
// to lean on for abuse resistance — a flat per-IP cap keeps report-flooding from being
// usable as its own harassment vector against a target's content.
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reports submitted. Try again later." },
});

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
  asyncHandler(async (req, res) => {
    const posts = await getForumPosts(req.currentUser!.id);
    res.json(posts);
  }),
);

forumRouter.get(
  "/posts/:id",
  requireUser,
  asyncHandler(async (req, res) => {
    const post = await getForumPostById(req.params.id, req.currentUser!.id);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const comments = await getForumCommentsByPostId(post.id, req.currentUser!.id);
    res.json({ ...post, comments });
  }),
);

forumRouter.post(
  "/posts/:id/comments",
  requireUser,
  asyncHandler(async (req, res) => {
    const post = await getForumPostById(req.params.id, req.currentUser!.id);
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

// Real-time ops alert on both channels — reports are the one thing in this router that
// genuinely needs a human to look soon, so email alone (easy to leave unread) isn't
// enough; SMS is simply skipped (see sms.service.ts's stub) if no admin phone is set.
function alertAdminOfNewReport(report: ForumReport) {
  void sendEmailBestEffort({
    to: ADMIN_ALERT_EMAIL,
    ...adminNewForumReportEmail({
      targetType: report.target_type,
      reason: report.reason,
      reportId: report.id,
    }),
  });
  if (ADMIN_ALERT_PHONE_NUMBER) {
    void sendSmsBestEffort({
      to: ADMIN_ALERT_PHONE_NUMBER,
      body: adminNewForumReportSms(report.target_type),
    });
  }
}

function validateReason(body: unknown): string | null {
  const reason = (body as { reason?: unknown })?.reason;
  if (typeof reason !== "string" || !reason.trim() || reason.length > 500) {
    return null;
  }
  return reason.trim();
}

forumRouter.post(
  "/posts/:id/report",
  requireUser,
  reportLimiter,
  asyncHandler(async (req, res) => {
    // Reportable regardless of block/hidden state — a user must be able to flag content
    // even if it's already hidden from their own feed for another reason.
    const reason = validateReason(req.body);
    if (!reason) {
      res.status(400).json({ error: "reason is required (max 500 characters)" });
      return;
    }
    const report = await reportForumContent({
      reporterUserId: req.currentUser!.id,
      targetType: "post",
      targetId: req.params.id,
      reason,
    });
    alertAdminOfNewReport(report);
    res.status(201).json(report);
  }),
);

forumRouter.post(
  "/comments/:id/report",
  requireUser,
  reportLimiter,
  asyncHandler(async (req, res) => {
    const reason = validateReason(req.body);
    if (!reason) {
      res.status(400).json({ error: "reason is required (max 500 characters)" });
      return;
    }
    const report = await reportForumContent({
      reporterUserId: req.currentUser!.id,
      targetType: "comment",
      targetId: req.params.id,
      reason,
    });
    alertAdminOfNewReport(report);
    res.status(201).json(report);
  }),
);

forumRouter.post(
  "/block/:userId",
  requireUser,
  asyncHandler(async (req, res) => {
    if (req.params.userId === req.currentUser!.id) {
      res.status(400).json({ error: "You can't block yourself" });
      return;
    }
    await blockForumUser(req.currentUser!.id, req.params.userId);
    res.status(204).send();
  }),
);

forumRouter.delete(
  "/block/:userId",
  requireUser,
  asyncHandler(async (req, res) => {
    await unblockForumUser(req.currentUser!.id, req.params.userId);
    res.status(204).send();
  }),
);
