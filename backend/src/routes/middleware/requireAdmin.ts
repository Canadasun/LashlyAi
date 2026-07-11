import { NextFunction, Request, Response } from "express";

const REALM = 'Basic realm="LashlyAI Admin"';

/**
 * Separate from the session-based user auth (auth.service.ts) — this is a single
 * shared secret for the internal admin dashboard, not tied to any user account.
 * HTTP Basic Auth so it
 * works both from a browser (native login prompt) and curl/scripts. Unlike other
 * dev-mode bypasses in this codebase, there is NO fallback when unconfigured: admin
 * data (user list, feedback) must never be reachable without a key set.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    res.status(503).json({ error: "Admin dashboard is not configured (ADMIN_API_KEY unset)" });
    return;
  }

  const header = req.header("Authorization");
  const encoded = header?.startsWith("Basic ") ? header.slice("Basic ".length) : undefined;
  const password = encoded ? Buffer.from(encoded, "base64").toString("utf8").split(":")[1] : undefined;

  if (password !== adminKey) {
    res.setHeader("WWW-Authenticate", REALM);
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }

  next();
}
