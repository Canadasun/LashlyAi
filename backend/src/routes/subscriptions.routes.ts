import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import { upsertSubscription } from "../models/Subscription";
import { verifyAppleReceipt } from "../services/appleReceipt.service";
import { asyncHandler } from "../utils/asyncHandler";

export const subscriptionsRouter = Router();

subscriptionsRouter.post(
  "/verify",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!process.env.APPLE_SHARED_SECRET) {
      res.status(503).json({
        error: "APPLE_SHARED_SECRET is not configured. Real receipt verification is required in this environment.",
      });
      return;
    }

    const { receipt_data: receiptData } = req.body ?? {};
    if (!receiptData || typeof receiptData !== "string") {
      res.status(400).json({ error: "receipt_data is required" });
      return;
    }

    const verified = await verifyAppleReceipt(receiptData);
    const subscription = await upsertSubscription({
      userId: req.currentUser!.id,
      plan: verified.plan,
      status: verified.status,
      appleTransactionId: verified.appleTransactionId,
      renewsAt: verified.renewsAt ?? undefined,
    });
    res.json({ ...subscription, verified: true });
  }),
);
