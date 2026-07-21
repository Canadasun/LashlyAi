import { NextFunction, Request, Response, Router } from "express";
import { requireUser } from "./middleware/requireUser";
import {
  createLashMapTemplate,
  deleteLashMapTemplate,
  getLashMapTemplateById,
  getLashMapTemplatesByOwner,
} from "../models/LashMapTemplate";
import {
  CustomLashMapValidationError,
  validateCustomLashMapInput,
} from "../services/lashmap.service";
import { checkCustomLashMapAccess } from "../services/planLimits.service";
import { asyncHandler } from "../utils/asyncHandler";

export const lashMapTemplatesRouter = Router();

// Same gate as an inline custom lash map (POST /clients/:id/lash-map's custom_lash_map
// field) — a saved template is just a reusable version of the same higher-skill,
// higher-liability surface, so it shouldn't be reachable at a lower tier.
async function requireProForTemplates(req: Request, res: Response, next: NextFunction) {
  const access = await checkCustomLashMapAccess(req.currentUser!.id);
  if (!access.allowed) {
    res.status(403).json({
      error: "Saved lash-map templates are a Pro feature. Upgrade to Pro to save your own signature sets.",
    });
    return;
  }
  next();
}
lashMapTemplatesRouter.use(requireUser, asyncHandler(requireProForTemplates));

async function loadOwnedTemplate(req: Request, res: Response) {
  const template = await getLashMapTemplateById(req.params.id);
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return null;
  }
  if (template.owner_user_id !== req.currentUser!.id) {
    res.status(403).json({ error: "You do not own this template" });
    return null;
  }
  return template;
}

lashMapTemplatesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    let input;
    try {
      input = validateCustomLashMapInput(req.body);
    } catch (error) {
      if (error instanceof CustomLashMapValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }

    const template = await createLashMapTemplate({
      ownerUserId: req.currentUser!.id,
      label: input.label,
      curl: input.curl,
      diameter: input.diameter,
      lengths: input.lengths,
    });
    res.status(201).json(template);
  }),
);

lashMapTemplatesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const templates = await getLashMapTemplatesByOwner(req.currentUser!.id);
    res.json(templates);
  }),
);

lashMapTemplatesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const template = await loadOwnedTemplate(req, res);
    if (!template) return;

    await deleteLashMapTemplate(template.id);
    res.status(204).send();
  }),
);
