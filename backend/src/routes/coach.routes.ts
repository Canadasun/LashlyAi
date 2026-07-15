import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import { askCoach } from "../services/ai.service";
import { asyncHandler } from "../utils/asyncHandler";
import { checkCoachQuota, getUserPlan } from "../services/planLimits.service";
import { logUsageEvent } from "../models/UsageEvent";
import { getRecentCoachMessages, saveCoachMessage } from "../models/CoachMessage";

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

    // Conversation history is a Pro perk ("to some extent" — see CoachMessage.ts's
    // HISTORY_LIMIT) — free tier stays exactly as ephemeral/session-only as before
    // this feature existed.
    const plan = await getUserPlan(req.currentUser!.id);
    if (plan !== "free") {
      await saveCoachMessage({ ownerUserId: req.currentUser!.id, role: "user", text: question });
      await saveCoachMessage({ ownerUserId: req.currentUser!.id, role: "coach", text: answer, mock });
    }

    res.json({ answer, mock });
  }),
);

coachRouter.get(
  "/history",
  requireUser,
  asyncHandler(async (req, res) => {
    const plan = await getUserPlan(req.currentUser!.id);
    if (plan === "free") {
      res.json({ messages: [] });
      return;
    }
    const messages = await getRecentCoachMessages(req.currentUser!.id);
    res.json({ messages });
  }),
);
