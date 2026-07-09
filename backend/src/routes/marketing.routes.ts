import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import { generateCaption, generateClientReply } from "../services/ai.service";
import { asyncHandler } from "../utils/asyncHandler";

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

    const result = await generateCaption(postDescription);
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

    const result = await generateClientReply(clientMessage);
    res.json(result);
  }),
);
