import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import { getSubscriptionByUserId, upsertSubscription } from "../models/Subscription";
import { verifyAppleReceipt } from "../services/appleReceipt.service";
import { asyncHandler } from "../utils/asyncHandler";
import { logLifecycleEvent } from "../models/UserLifecycleEvent";

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

    // Mover: captured before the overwrite, since upsertSubscription (single row per
    // user, no history table) would otherwise erase the "what it changed from" half of
    // this transition the instant it happens.
    const previous = await getSubscriptionByUserId(req.currentUser!.id);

    const verified = await verifyAppleReceipt(receiptData);
    const subscription = await upsertSubscription({
      userId: req.currentUser!.id,
      plan: verified.plan,
      status: verified.status,
      appleTransactionId: verified.appleTransactionId,
      renewsAt: verified.renewsAt ?? undefined,
    });

    if (previous?.plan !== subscription.plan || previous?.status !== subscription.status) {
      await logLifecycleEvent({
        userId: req.currentUser!.id,
        userEmail: req.currentUser!.email,
        eventType: "mover_plan_change",
        details: {
          source: "apple_receipt_verify",
          from_plan: previous?.plan ?? null,
          from_status: previous?.status ?? null,
          to_plan: subscription.plan,
          to_status: subscription.status,
        },
      });
    }

    res.json({ ...subscription, verified: true });
  }),
);
