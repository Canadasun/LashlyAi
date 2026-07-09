import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import { askCoach } from "../services/ai.service";
import { asyncHandler } from "../utils/asyncHandler";
import { checkCoachQuota } from "../services/planLimits.service";
import { logUsageEvent } from "../models/UsageEvent";

export const coachRouter = Router();

coachRouter.post(
  "/ask",
  requireUser,
  asyncHandler(async (req, res) => {
    const { question } = req.body ?? {};
    if (!question || typeof question !== "string") {
      res.status(400).json({ error: "question is required" });
      return;
    }

    const quota = await checkCoachQuota(req.currentUser!.id);
    if (!quota.allowed) {
      res.status(403).json({
        error: `Free plan is limited to ${quota.limit} AI Lash Coach questions per day. Upgrade to Pro for unlimited access.`,
      });
      return;
    }

    const { answer, mock } = await askCoach(question);
    await logUsageEvent(req.currentUser!.id, "coach_question");
    res.json({ answer, mock });
  }),
);
