import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import { recommendGlue } from "../services/glueRecommendation.service";
import { asyncHandler } from "../utils/asyncHandler";

export const toolsRouter = Router();

toolsRouter.post(
  "/glue-recommendation",
  requireUser,
  asyncHandler(async (req, res) => {
    const humidityPct = req.body?.humidity_pct;
    if (typeof humidityPct !== "number" || humidityPct < 0 || humidityPct > 100) {
      res.status(400).json({ error: "humidity_pct (0-100 number) is required" });
      return;
    }

    res.json(recommendGlue(humidityPct));
  }),
);
