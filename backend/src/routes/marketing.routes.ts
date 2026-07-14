import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import { generateCaption, generateClientReply } from "../services/ai.service";
import { asyncHandler } from "../utils/asyncHandler";
import { checkMarketingQuota } from "../services/planLimits.service";
import { logUsageEvent } from "../models/UsageEvent";

export const marketingRouter = Router();

marketingRouter.post(
  "/caption",
  requireUser,
  asyncHandler(async (req, res) => {
    const { post_description: postDescription } = req.body ?? {};
    if (!postDescription || typeof postDescription !== "string") {
      res.status(400).json({ error: "post_description is required" });
      return;
    }

    const quota = await checkMarketingQuota(req.currentUser!.id);
    if (!quota.allowed) {
      res.status(403).json({
        error: `Free plan is limited to ${quota.limit} marketing AI generations per day. Upgrade to Pro for unlimited access.`,
      });
      return;
    }

    const result = await generateCaption(postDescription);
    await logUsageEvent(req.currentUser!.id, "marketing_generation");
    res.json(result);
  }),
);

marketingRouter.post(
  "/reply",
  requireUser,
  asyncHandler(async (req, res) => {
    const { client_message: clientMessage } = req.body ?? {};
    if (!clientMessage || typeof clientMessage !== "string") {
      res.status(400).json({ error: "client_message is required" });
      return;
    }

    const quota = await checkMarketingQuota(req.currentUser!.id);
    if (!quota.allowed) {
      res.status(403).json({
        error: `Free plan is limited to ${quota.limit} marketing AI generations per day. Upgrade to Pro for unlimited access.`,
      });
      return;
    }

    const result = await generateClientReply(clientMessage);
    await logUsageEvent(req.currentUser!.id, "marketing_generation");
    res.json(result);
  }),
);
