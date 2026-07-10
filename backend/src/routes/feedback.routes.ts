import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import { createFeedback, getFeedbackByUserId } from "../models/Feedback";
import { getUserPlan } from "../services/planLimits.service";
import { asyncHandler } from "../utils/asyncHandler";

export const feedbackRouter = Router();

feedbackRouter.post(
  "/",
  requireUser,
  asyncHandler(async (req, res) => {
    const { message, context } = req.body ?? {};
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "message is required" });
      return;
    }

    // Priority support (Pro-tier perk): any plan above free gets flagged so it can be
    // triaged first — see getAdminStats/the admin dashboard for where this surfaces.
    const plan = await getUserPlan(req.currentUser!.id);
    const isPriority = plan !== "free";

    const feedback = await createFeedback({
      userId: req.currentUser!.id,
      message,
      context,
      isPriority,
    });
    res.status(201).json(feedback);
  }),
);

feedbackRouter.get(
  "/",
  requireUser,
  asyncHandler(async (req, res) => {
    const feedback = await getFeedbackByUserId(req.currentUser!.id);
    res.json(feedback);
  }),
);
