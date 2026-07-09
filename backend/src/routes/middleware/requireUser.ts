import { NextFunction, Request, Response } from "express";
import { verifyIdToken } from "../../services/auth.service";
import { findUserByFirebaseUid, User } from "../../models/User";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      currentUser?: User;
    }
  }
}

/**
 * Verifies the Firebase token AND resolves the matching Postgres user row.
 * Use for any route that needs to know "which of our users is this."
 */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const header = req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    res.status(401).json({ error: "Missing Authorization: Bearer <token> header" });
    return;
  }

  try {
    const identity = await verifyIdToken(token);
    const user = await findUserByFirebaseUid(identity.firebaseUid);
    if (!user) {
      res.status(404).json({ error: "No user record yet. Call POST /auth/register first." });
      return;
    }
    req.currentUser = user;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
