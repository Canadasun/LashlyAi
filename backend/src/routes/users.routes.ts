import { Router } from "express";
import { requireAuth } from "./middleware/requireAuth";
import { findUserByFirebaseUid } from "../models/User";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, async (req, res) => {
  const user = await findUserByFirebaseUid(req.identity!.firebaseUid);
  if (!user) {
    res.status(404).json({ error: "No user record yet. Call POST /auth/register first." });
    return;
  }
  res.json(user);
});
