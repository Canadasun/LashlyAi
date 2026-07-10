import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import { upsertSubscription, SubscriptionPlan } from "../models/Subscription";
import { verifyAppleReceipt } from "../services/appleReceipt.service";
import { asyncHandler } from "../utils/asyncHandler";

export const subscriptionsRouter = Router();

const VALID_PLANS: SubscriptionPlan[] = ["free", "pro", "educator", "salon", "enterprise"];

subscriptionsRouter.post(
  "/verify",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!process.env.APPLE_SHARED_SECRET) {
      // No real App Store Connect subscription exists yet — let the mobile paywall UI
      // be testable by accepting a plan directly instead of a real Apple receipt. Never
      // allow this in production/staging: it would let anyone grant themselves a paid
      // plan for free.
      if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging") {
        res.status(503).json({
          error: "APPLE_SHARED_SECRET is not configured. Real receipt verification is required in this environment.",
        });
        return;
      }

      const requestedPlan = req.body?.plan;
      if (!VALID_PLANS.includes(requestedPlan)) {
        res.status(400).json({
          error:
            "APPLE_SHARED_SECRET is not configured (dev mode) — pass a valid `plan` " +
            `field directly instead of a receipt. One of: ${VALID_PLANS.join(", ")}`,
        });
        return;
      }
      const subscription = await upsertSubscription({
        userId: req.currentUser!.id,
        plan: requestedPlan,
        status: "active",
      });
      res.json({ ...subscription, mock: true });
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
    res.json({ ...subscription, mock: false });
  }),
);
