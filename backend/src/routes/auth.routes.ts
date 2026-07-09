import { Router } from "express";
import { requireAuth } from "./middleware/requireAuth";
import { createUser, findUserByFirebaseUid, UserRole } from "../models/User";
import { asyncHandler } from "../utils/asyncHandler";

const VALID_ROLES: UserRole[] = ["beginner", "certified", "educator", "salon_owner", "academy"];

export const authRouter = Router();

/**
 * Called by the mobile app right after Firebase sign-up to create the matching
 * Postgres user row. Firebase itself owns the email/password credential; this
 * endpoint just links that identity to our data model.
 */
authRouter.post("/register", requireAuth, asyncHandler(async (req, res) => {
  const identity = req.identity!;

  const existing = await findUserByFirebaseUid(identity.firebaseUid);
  if (existing) {
    res.status(200).json(existing);
    return;
  }

  const requestedRole = req.body?.role;
  const role: UserRole = VALID_ROLES.includes(requestedRole) ? requestedRole : "beginner";

  const user = await createUser({
    firebaseUid: identity.firebaseUid,
    email: identity.email,
    role,
  });
  res.status(201).json(user);
}));
