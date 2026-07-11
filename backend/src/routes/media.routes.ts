import { Router } from "express";
import { getOwnedMediaAsset } from "../models/MediaAsset";
import { readStoredObject } from "../services/storage.service";
import { asyncHandler } from "../utils/asyncHandler";
import { requireUser } from "./middleware/requireUser";

export const mediaRouter = Router();

mediaRouter.get(
  "/:id",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }
    const asset = await getOwnedMediaAsset(req.params.id, req.currentUser!.id);
    if (!asset) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }

    const body = await readStoredObject(asset.object_key);
    res.setHeader("Content-Type", asset.content_type);
    res.setHeader("Content-Length", String(asset.byte_size));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", "inline");
    res.send(Buffer.from(body));
  }),
);
