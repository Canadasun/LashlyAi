import { NextFunction, Request, Response } from "express";

/**
 * Distinct from requireAdmin (the shared-secret HTTP Basic Auth guard for the
 * read-only stats dashboard) — this checks is_admin on the real authenticated user
 * (see requireUser + syncAdminFlagFromAllowlist). Always mount requireUser first so
 * req.currentUser is populated.
 */
export function requireAdminUser(req: Request, res: Response, next: NextFunction) {
  if (!req.currentUser?.is_admin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
