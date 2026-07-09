import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import { createFeedback } from "../models/Feedback";
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

    const feedback = await createFeedback({ userId: req.currentUser!.id, message, context });
    res.status(201).json(feedback);
  }),
);
