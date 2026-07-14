import { NextFunction, Request, Response } from "express";
import { verifyPassword } from "../../services/auth.service";
import { findUserByEmail, syncAdminFlagFromAllowlist } from "../../models/User";

const REALM = 'Basic realm="LashlyAI Admin"';

/**
 * Gates the server-rendered admin dashboard behind a real admin account's own login
 * credentials — HTTP Basic Auth (so browsers still show a native prompt, and curl/
 * scripts keep working) but checked against that user's actual password_hash and
 * is_admin flag, instead of the old shared ADMIN_API_KEY secret. Access now traces to
 * a specific person and is revoked by changing/removing that account, not by rotating
 * a secret everyone with dashboard access shared.
 */
export async function requireAdminAccount(req: Request, res: Response, next: NextFunction) {
  const fail = () => {
    res.setHeader("WWW-Authenticate", REALM);
    res.status(401).json({ error: "Admin authentication required" });
  };

  const header = req.header("Authorization");
  const encoded = header?.startsWith("Basic ") ? header.slice("Basic ".length) : undefined;
  const decoded = encoded ? Buffer.from(encoded, "base64").toString("utf8") : undefined;
  const separatorIndex = decoded?.indexOf(":") ?? -1;

  if (!decoded || separatorIndex < 0) {
    fail();
    return;
  }

  const email = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);
  if (!email || !password) {
    fail();
    return;
  }

  try {
    const user = await findUserByEmail(email);
    if (!user?.password_hash || !verifyPassword(password, user.password_hash)) {
      fail();
      return;
    }

    const synced = await syncAdminFlagFromAllowlist(user);
    if (!synced.is_admin) {
      fail();
      return;
    }

    req.currentUser = synced;
    next();
  } catch (err) {
    next(err);
  }
}
