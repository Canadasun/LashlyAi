import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import { askCoach } from "../services/ai.service";

export const coachRouter = Router();

coachRouter.post("/ask", requireUser, async (req, res) => {
  const { question } = req.body ?? {};
  if (!question || typeof question !== "string") {
    res.status(400).json({ error: "question is required" });
    return;
  }

  const { answer, mock } = await askCoach(question);
  res.json({ answer, mock });
});
