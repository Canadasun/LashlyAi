import { Router } from "express";
import { requireUser } from "./middleware/requireUser";
import { askCoach } from "../services/ai.service";
import { asyncHandler } from "../utils/asyncHandler";
import { checkClientAwareCoachAccess, checkCoachQuota, getUserPlan } from "../services/planLimits.service";
import { logUsageEvent } from "../models/UsageEvent";
import { getRecentCoachMessages, saveCoachMessage } from "../models/CoachMessage";
import { getClientProfileById } from "../models/ClientProfile";
import { getLashMapsByClientProfileId } from "../models/LashMap";
import { getRetentionChecksByClientProfileId, RetentionCheck } from "../models/RetentionCheck";
import { LashMap } from "../models/LashMap";
import { ClientProfile } from "../models/ClientProfile";

export const coachRouter = Router();

// Folds one client's own data into the Coach prompt (Pro tier) instead of pure generic
// troubleshooting — see ai.service.ts's askCoach() clientContext param.
function buildClientContext(
  clientProfile: ClientProfile,
  lashMaps: LashMap[],
  retentionChecks: (RetentionCheck & { lash_set: string | null; style: string })[],
): string {
  const lines: string[] = [`Client: ${clientProfile.name}.`];
  if (clientProfile.eye_analysis) {
    lines.push(
      `Eye shape: ${clientProfile.eye_analysis.eye_shape}, natural lash density: ${clientProfile.eye_analysis.lash_density}.`,
    );
  }

  // getLashMapsByClientProfileId orders newest first, so [0] is the current map.
  const latestMap = lashMaps[0];
  if (latestMap) {
    const setNote = latestMap.lash_set_label ? `, ${latestMap.lash_set_label} lash set` : "";
    const difficultyNote = latestMap.difficulty_label ? ` Difficulty: ${latestMap.difficulty_label}.` : "";
    lines.push(`Most recent lash map: ${latestMap.style_label} style, ${latestMap.curl_label} curl${setNote}.${difficultyNote}`);
  }

  if (retentionChecks.length > 0) {
    lines.push("Recent retention checks:");
    for (const check of retentionChecks.slice(-3)) {
      const glueNote = check.glue_used ? `, glue: ${check.glue_used}` : "";
      const humidityNote = check.humidity_pct != null ? `, humidity: ${Number(check.humidity_pct)}%` : "";
      lines.push(`- Day ${check.days_since_application}: ${Number(check.retention_pct)}% retained${glueNote}${humidityNote}.`);
    }
  }

  return lines.join("\n");
}

coachRouter.post(
  "/ask",
  requireUser,
  asyncHandler(async (req, res) => {
    const { question, client_id: clientId } = req.body ?? {};
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

    let clientContext: string | undefined;
    if (clientId) {
      const access = await checkClientAwareCoachAccess(req.currentUser!.id);
      if (!access.allowed) {
        res.status(403).json({
          error: "Asking about a specific client is a Pro feature. Upgrade to Pro to use client-aware coaching.",
        });
        return;
      }
      const clientProfile = await getClientProfileById(clientId);
      if (!clientProfile || clientProfile.owner_user_id !== req.currentUser!.id) {
        res.status(404).json({ error: "Client not found" });
        return;
      }
      const [lashMaps, retentionChecks] = await Promise.all([
        getLashMapsByClientProfileId(clientId),
        getRetentionChecksByClientProfileId(clientId),
      ]);
      clientContext = buildClientContext(clientProfile, lashMaps, retentionChecks);
    }

    const { answer, mock } = await askCoach(question, clientContext);
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
