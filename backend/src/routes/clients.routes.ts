import { Router } from "express";
import multer from "multer";
import { requireUser } from "./middleware/requireUser";
import {
  addPhotoAndEyeAnalysis,
  appendLashHistoryEntry,
  createClientProfile,
  deleteClientProfile,
  getClientProfileById,
  getClientProfilesByOwner,
} from "../models/ClientProfile";
import {
  createLashMap,
  getLashMapById,
  getLashMapsByClientProfileId,
  updateLashMapRetention,
} from "../models/LashMap";
import {
  createPhotoFeedback,
  getPhotoFeedbackByClientProfileId,
} from "../models/PhotoFeedback";
import {
  analyzeEye,
  generateLashPreview,
  isValidEyeShape,
  isValidLashDensity,
  scoreLashPhoto,
  troubleshootRetention,
} from "../services/ai.service";
import { generateLashMap } from "../services/lashmap.service";
import {
  deleteStoredMediaAsset,
  prepareImage,
  readStoredObject,
  uploadImage,
} from "../services/storage.service";
import { asyncHandler } from "../utils/asyncHandler";
import {
  checkClientProfileQuota,
  checkEyeScanQuota,
  checkLashMapQuota,
  checkLashPreviewQuota,
  checkPhotoEditQuota,
  checkPhotoFeedbackQuota,
  checkRetentionCheckQuota,
} from "../services/planLimits.service";
import { logUsageEvent } from "../models/UsageEvent";
import { getMediaAssetsByClientProfileId } from "../models/MediaAsset";

export const clientsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function loadOwnedClient(req: import("express").Request, res: import("express").Response) {
  const client = await getClientProfileById(req.params.id);
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return null;
  }
  if (client.owner_user_id !== req.currentUser!.id) {
    res.status(403).json({ error: "You do not own this client profile" });
    return null;
  }
  return client;
}

clientsRouter.post(
  "/",
  requireUser,
  asyncHandler(async (req, res) => {
    const { name, notes } = req.body ?? {};
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const quota = await checkClientProfileQuota(req.currentUser!.id);
    if (!quota.allowed) {
      res.status(403).json({
        error: `Free plan is limited to ${quota.limit} client profiles. Upgrade to Pro for unlimited clients.`,
      });
      return;
    }

    const client = await createClientProfile({ ownerUserId: req.currentUser!.id, name, notes });
    res.status(201).json(client);
  }),
);

clientsRouter.get(
  "/",
  requireUser,
  asyncHandler(async (req, res) => {
    const clients = await getClientProfilesByOwner(req.currentUser!.id);
    res.json(clients);
  }),
);

clientsRouter.get(
  "/:id",
  requireUser,
  asyncHandler(async (req, res) => {
    const client = await loadOwnedClient(req, res);
    if (!client) return;
    res.json(client);
  }),
);

clientsRouter.post(
  "/:id/eye-analysis",
  requireUser,
  upload.single("photo"),
  asyncHandler(async (req, res) => {
    const client = await loadOwnedClient(req, res);
    if (!client) return;

    if (!req.file) {
      res.status(400).json({ error: 'Missing "photo" file in multipart body' });
      return;
    }

    const quota = await checkEyeScanQuota(req.currentUser!.id);
    if (!quota.allowed) {
      res.status(403).json({
        error: `Free plan is limited to ${quota.limit} eye scans per month. Upgrade to Pro for unlimited scans.`,
      });
      return;
    }

    const preparedImage = await prepareImage(req.file.buffer);
    const eyeAnalysis = await analyzeEye(preparedImage);
    const uploaded = await uploadImage({
      buffer: preparedImage,
      ownerUserId: req.currentUser!.id,
      clientProfileId: client.id,
      purpose: "eye_analysis",
    });
    let updated;
    try {
      updated = await addPhotoAndEyeAnalysis(client.id, uploaded.url, eyeAnalysis);
    } catch (error) {
      await deleteStoredMediaAsset(uploaded.asset).catch(() => undefined);
      throw error;
    }
    await logUsageEvent(req.currentUser!.id, "eye_scan");

    res.status(201).json({ photo_url: uploaded.url, eye_analysis: updated.eye_analysis });
  }),
);

clientsRouter.post(
  "/:id/lash-map",
  requireUser,
  asyncHandler(async (req, res) => {
    const client = await loadOwnedClient(req, res);
    if (!client) return;

    const eyeAnalysis = req.body?.eye_analysis ?? client.eye_analysis;
    if (!eyeAnalysis) {
      res.status(400).json({
        error:
          "No eye analysis available. Call POST /clients/:id/eye-analysis first, " +
          "or pass eye_analysis in the request body.",
      });
      return;
    }
    if (!isValidEyeShape(eyeAnalysis.eye_shape) || !isValidLashDensity(eyeAnalysis.lash_density)) {
      res.status(400).json({
        error: "eye_analysis.eye_shape and eye_analysis.lash_density must be valid values",
      });
      return;
    }

    const quota = await checkLashMapQuota(req.currentUser!.id);
    if (!quota.allowed) {
      res.status(403).json({
        error: `Free plan is limited to ${quota.limit} lash map generations per month. Upgrade to Pro for unlimited access.`,
      });
      return;
    }

    const generated = generateLashMap(
      eyeAnalysis,
      req.body?.requested_style,
      req.body?.requested_technique,
      req.body?.requested_lash_set,
      req.body?.requested_lash_style,
    );
    const saved = await createLashMap(client.id, generated);
    await appendLashHistoryEntry(client.id, {
      lash_map_id: saved.id,
      style: saved.style,
      created_at: saved.created_at,
    });
    await logUsageEvent(req.currentUser!.id, "lash_map_generation");

    res.status(201).json(saved);
  }),
);

clientsRouter.post(
  "/:id/lash-preview",
  requireUser,
  asyncHandler(async (req, res) => {
    const client = await loadOwnedClient(req, res);
    if (!client) return;

    const {
      lash_set_label: lashSetLabel,
      lash_style_label: lashStyleLabel,
      consented,
    } = req.body ?? {};

    if (!consented) {
      res.status(400).json({
        error: "consented must be true — confirm the client consented before generating a preview.",
      });
      return;
    }
    if (!lashSetLabel || typeof lashSetLabel !== "string") {
      res.status(400).json({ error: "lash_set_label is required" });
      return;
    }

    const quota = await checkLashPreviewQuota(req.currentUser!.id);
    if (!quota.allowed) {
      res.status(403).json({
        error:
          quota.limit === 0
            ? "AI after-look previews are a Pro feature. Upgrade to Pro to generate one."
            : `Free plan is limited to ${quota.limit} AI previews per month. Upgrade to Pro for unlimited access.`,
      });
      return;
    }

    const assets = await getMediaAssetsByClientProfileId(client.id);
    const eyePhotoAsset = [...assets].reverse().find((asset) => asset.purpose === "eye_analysis");
    if (!eyePhotoAsset) {
      res.status(400).json({ error: "No eye scan photo available for this client yet." });
      return;
    }

    const baseImage = Buffer.from(await readStoredObject(eyePhotoAsset.object_key));
    const { imageBuffer, mock } = await generateLashPreview(
      baseImage,
      lashSetLabel,
      typeof lashStyleLabel === "string" ? lashStyleLabel : "natural finish",
    );

    const uploaded = await uploadImage({
      buffer: imageBuffer,
      ownerUserId: req.currentUser!.id,
      clientProfileId: client.id,
      purpose: "lash_preview",
      consentedByUserId: req.currentUser!.id,
    });
    await logUsageEvent(req.currentUser!.id, "lash_preview_generation");

    res.status(201).json({ preview_url: uploaded.url, mock });
  }),
);

clientsRouter.get(
  "/:id/lash-maps",
  requireUser,
  asyncHandler(async (req, res) => {
    const client = await loadOwnedClient(req, res);
    if (!client) return;

    const maps = await getLashMapsByClientProfileId(client.id);
    res.json(maps);
  }),
);

clientsRouter.post(
  "/:id/photo-feedback",
  requireUser,
  upload.single("photo"),
  asyncHandler(async (req, res) => {
    const client = await loadOwnedClient(req, res);
    if (!client) return;

    if (!req.file) {
      res.status(400).json({ error: 'Missing "photo" file in multipart body' });
      return;
    }

    const quota = await checkPhotoFeedbackQuota(req.currentUser!.id);
    if (!quota.allowed) {
      res.status(403).json({
        error: `Free plan is limited to ${quota.limit} photo feedback scores per month. Upgrade to Pro for unlimited access.`,
      });
      return;
    }

    const preparedImage = await prepareImage(req.file.buffer);
    const feedback = await scoreLashPhoto(preparedImage);
    const uploaded = await uploadImage({
      buffer: preparedImage,
      ownerUserId: req.currentUser!.id,
      clientProfileId: client.id,
      purpose: "photo_feedback",
    });
    let saved;
    try {
      saved = await createPhotoFeedback(client.id, uploaded.url, feedback);
    } catch (error) {
      await deleteStoredMediaAsset(uploaded.asset).catch(() => undefined);
      throw error;
    }
    await logUsageEvent(req.currentUser!.id, "photo_feedback");

    res.status(201).json(saved);
  }),
);

clientsRouter.get(
  "/:id/photo-feedback",
  requireUser,
  asyncHandler(async (req, res) => {
    const client = await loadOwnedClient(req, res);
    if (!client) return;

    const feedback = await getPhotoFeedbackByClientProfileId(client.id);
    res.json(feedback);
  }),
);

// Persists the final high-res export from the mobile photo editor (filters/presets
// applied client-side via Skia) — a distinct paid feature from photo_feedback (AI
// scoring), so it gets its own media purpose and quota.
clientsRouter.post(
  "/:id/photo-edit",
  requireUser,
  upload.single("photo"),
  asyncHandler(async (req, res) => {
    const client = await loadOwnedClient(req, res);
    if (!client) return;

    if (!req.file) {
      res.status(400).json({ error: 'Missing "photo" file in multipart body' });
      return;
    }

    const quota = await checkPhotoEditQuota(req.currentUser!.id);
    if (!quota.allowed) {
      res.status(403).json({
        error:
          quota.limit === 0
            ? "Photo editing is a Pro feature. Upgrade to Pro to use it."
            : `Photo editing is limited to ${quota.limit} exports per day. Try again tomorrow.`,
      });
      return;
    }

    const preparedImage = await prepareImage(req.file.buffer);
    const uploaded = await uploadImage({
      buffer: preparedImage,
      ownerUserId: req.currentUser!.id,
      clientProfileId: client.id,
      purpose: "photo_edit",
    });
    await logUsageEvent(req.currentUser!.id, "photo_edit");

    res.status(201).json({ photo_url: uploaded.url });
  }),
);

clientsRouter.delete(
  "/:id",
  requireUser,
  asyncHandler(async (req, res) => {
    const client = await loadOwnedClient(req, res);
    if (!client) return;

    const assets = await getMediaAssetsByClientProfileId(client.id);
    for (const asset of assets) {
      await deleteStoredMediaAsset(asset);
    }
    await deleteClientProfile(client.id);
    res.status(204).send();
  }),
);

clientsRouter.post(
  "/:id/lash-maps/:mapId/retention-check",
  requireUser,
  asyncHandler(async (req, res) => {
    const client = await loadOwnedClient(req, res);
    if (!client) return;

    const lashMap = await getLashMapById(req.params.mapId);
    if (!lashMap || lashMap.client_profile_id !== client.id) {
      res.status(404).json({ error: "Lash map not found for this client" });
      return;
    }

    const {
      days_since_application: daysSinceApplication,
      retention_pct: retentionPct,
      symptoms,
      humidity_pct: humidityPct,
      glue_used: glueUsed,
    } = req.body ?? {};
    if (typeof daysSinceApplication !== "number" || typeof retentionPct !== "number") {
      res.status(400).json({
        error: "days_since_application and retention_pct (numbers) are required",
      });
      return;
    }
    if (daysSinceApplication < 0) {
      res.status(400).json({ error: "days_since_application cannot be negative" });
      return;
    }
    if (retentionPct < 0 || retentionPct > 100) {
      res.status(400).json({ error: "retention_pct must be between 0 and 100" });
      return;
    }

    const quota = await checkRetentionCheckQuota(req.currentUser!.id);
    if (!quota.allowed) {
      res.status(403).json({
        error: `Free plan is limited to ${quota.limit} retention checks per month. Upgrade to Pro for unlimited access.`,
      });
      return;
    }

    const { advice, mock } = await troubleshootRetention({
      daysSinceApplication,
      retentionPct,
      symptoms: Array.isArray(symptoms) ? symptoms : [],
      humidityPct: typeof humidityPct === "number" ? humidityPct : undefined,
      glueUsed: typeof glueUsed === "string" ? glueUsed : undefined,
    });
    const updated = await updateLashMapRetention(lashMap.id, retentionPct);
    await logUsageEvent(req.currentUser!.id, "retention_check");

    res.json({ advice, mock, lash_map: updated });
  }),
);
