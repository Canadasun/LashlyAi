import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import { asyncHandler } from "../utils/asyncHandler";
import {
  checkClientProfileQuota,
  checkCoachQuota,
  checkEyeScanQuota,
  checkForumPostQuota,
  checkLashMapQuota,
  checkLashPreviewQuota,
  checkMarketingQuota,
  checkPhotoEditQuota,
  checkPhotoFeedbackQuota,
  checkPhotoRetouchQuota,
  checkRetentionCheckQuota,
  ENFORCEMENT_ENABLED,
  getUserPlan,
} from "../services/planLimits.service";
import { deleteUserById } from "../models/User";
import { getMediaAssetsByOwnerUserId } from "../models/MediaAsset";
import { deleteStoredMediaAsset } from "../services/storage.service";
import { getUnseenNotifications, markNotificationSeen } from "../models/UserNotification";

export const usersRouter = Router();

usersRouter.get(
  "/me",
  requireUser,
  asyncHandler(async (req, res) => {
    res.json(req.currentUser);
  }),
);

usersRouter.delete(
  "/me",
  requireUser,
  asyncHandler(async (req, res) => {
    const userId = req.currentUser!.id;
    const assets = await getMediaAssetsByOwnerUserId(userId);
    for (const asset of assets) {
      await deleteStoredMediaAsset(asset);
    }
    await deleteUserById(userId);
    res.status(204).send();
  }),
);

usersRouter.get(
  "/me/usage",
  requireUser,
  asyncHandler(async (req, res) => {
    const userId = req.currentUser!.id;
    const [
      plan,
      clientProfiles,
      coachQuestionsToday,
      eyeScansThisMonth,
      photoFeedbackThisMonth,
      lashMapGenerationsThisMonth,
      retentionChecksThisMonth,
      forumPostsThisMonth,
      marketingGenerationsToday,
      lashPreviewsThisMonth,
      photoEditsToday,
      photoRetouchesThisMonth,
    ] = await Promise.all([
      getUserPlan(userId),
      checkClientProfileQuota(userId),
      checkCoachQuota(userId),
      checkEyeScanQuota(userId),
      checkPhotoFeedbackQuota(userId),
      checkLashMapQuota(userId),
      checkRetentionCheckQuota(userId),
      checkForumPostQuota(userId),
      checkMarketingQuota(userId),
      checkLashPreviewQuota(userId),
      checkPhotoEditQuota(userId),
      checkPhotoRetouchQuota(userId),
    ]);

    res.json({
      plan,
      enforced: ENFORCEMENT_ENABLED,
      client_profiles: clientProfiles,
      coach_questions_today: coachQuestionsToday,
      eye_scans_this_month: eyeScansThisMonth,
      photo_feedback_this_month: photoFeedbackThisMonth,
      lash_map_generations_this_month: lashMapGenerationsThisMonth,
      retention_checks_this_month: retentionChecksThisMonth,
      forum_posts_this_month: forumPostsThisMonth,
      marketing_generations_today: marketingGenerationsToday,
      lash_previews_this_month: lashPreviewsThisMonth,
      photo_edits_today: photoEditsToday,
      photo_retouches_this_month: photoRetouchesThisMonth,
    });
  }),
);

// Polled on app foreground to show the comp-subscription banner (see
// CompSubscriptionBanner.tsx on mobile). Only unseen notifications are ever returned;
// once dismissed client-side, POST .../seen marks it so it never resurfaces.
usersRouter.get(
  "/me/notifications",
  requireUser,
  asyncHandler(async (req, res) => {
    const notifications = await getUnseenNotifications(req.currentUser!.id);
    res.json(notifications);
  }),
);

usersRouter.post(
  "/me/notifications/:id/seen",
  requireUser,
  asyncHandler(async (req, res) => {
    const notification = await markNotificationSeen(req.currentUser!.id, req.params.id);
    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    res.json(notification);
  }),
);
