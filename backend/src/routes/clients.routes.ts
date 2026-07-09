import { Router } from "express";
import multer from "multer";
import { requireUser } from "./middleware/requireUser";
import {
  addPhotoAndEyeAnalysis,
  appendLashHistoryEntry,
  createClientProfile,
  getClientProfileById,
} from "../models/ClientProfile";
import { createLashMap, getLashMapsByClientProfileId } from "../models/LashMap";
import { analyzeEye } from "../services/ai.service";
import { generateLashMap } from "../services/lashmap.service";
import { uploadImage } from "../services/storage.service";

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

clientsRouter.post("/", requireUser, async (req, res) => {
  const { name, notes } = req.body ?? {};
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const client = await createClientProfile({ ownerUserId: req.currentUser!.id, name, notes });
  res.status(201).json(client);
});

clientsRouter.get("/:id", requireUser, async (req, res) => {
  const client = await loadOwnedClient(req, res);
  if (!client) return;
  res.json(client);
});

clientsRouter.post("/:id/eye-analysis", requireUser, upload.single("photo"), async (req, res) => {
  const client = await loadOwnedClient(req, res);
  if (!client) return;

  if (!req.file) {
    res.status(400).json({ error: 'Missing "photo" file in multipart body' });
    return;
  }

  const { url } = await uploadImage(req.file.buffer, req.file.originalname);
  const eyeAnalysis = await analyzeEye(req.file.buffer);
  const updated = await addPhotoAndEyeAnalysis(client.id, url, eyeAnalysis);

  res.status(201).json({ photo_url: url, eye_analysis: updated.eye_analysis });
});

clientsRouter.post("/:id/lash-map", requireUser, async (req, res) => {
  const client = await loadOwnedClient(req, res);
  if (!client) return;

  const eyeAnalysis = req.body?.eye_analysis ?? client.eye_analysis;
  if (!eyeAnalysis) {
    res.status(400).json({
      error: "No eye analysis available. Call POST /clients/:id/eye-analysis first, " +
        "or pass eye_analysis in the request body.",
    });
    return;
  }

  const generated = generateLashMap(eyeAnalysis);
  const saved = await createLashMap(client.id, generated);
  await appendLashHistoryEntry(client.id, {
    lash_map_id: saved.id,
    style: saved.style,
    created_at: saved.created_at,
  });

  res.status(201).json(saved);
});

clientsRouter.get("/:id/lash-maps", requireUser, async (req, res) => {
  const client = await loadOwnedClient(req, res);
  if (!client) return;

  const maps = await getLashMapsByClientProfileId(client.id);
  res.json(maps);
});
