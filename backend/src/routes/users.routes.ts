import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import { asyncHandler } from "../utils/asyncHandler";
import {
  checkClientProfileQuota,
  checkCoachQuota,
  checkEyeScanQuota,
  ENFORCEMENT_ENABLED,
  getUserPlan,
} from "../services/planLimits.service";

export const usersRouter = Router();

usersRouter.get(
  "/me",
  requireUser,
  asyncHandler(async (req, res) => {
    res.json(req.currentUser);
  }),
);

usersRouter.get(
  "/me/usage",
  requireUser,
  asyncHandler(async (req, res) => {
    const userId = req.currentUser!.id;
    const [plan, clientProfiles, coachQuestionsToday, eyeScansThisMonth] = await Promise.all([
      getUserPlan(userId),
      checkClientProfileQuota(userId),
      checkCoachQuota(userId),
      checkEyeScanQuota(userId),
    ]);

    res.json({
      plan,
      enforced: ENFORCEMENT_ENABLED,
      client_profiles: clientProfiles,
      coach_questions_today: coachQuestionsToday,
      eye_scans_this_month: eyeScansThisMonth,
    });
  }),
);
