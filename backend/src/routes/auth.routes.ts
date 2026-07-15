import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../utils/asyncHandler";
import { requireUser } from "./middleware/requireUser";
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
} from "../services/auth.service";
import {
  createUser,
  findUserByAppleId,
  findUserByEmail,
  linkAppleIdToUser,
  updateUserPasswordHash,
  User,
  UserRole,
} from "../models/User";
import { logLifecycleEvent } from "../models/UserLifecycleEvent";
import { AppleIdentityTokenError, verifyAppleIdentityToken } from "../services/appleSignIn.service";

const VALID_ROLES: UserRole[] = ["beginner", "certified", "educator", "salon_owner", "academy"];

export const authRouter = Router();

// Per-IP limits — these endpoints have no CAPTCHA, so they're the main brute-force /
// signup-spam surface. Registration is looser (legitimate onboarding bursts); login is
// tight since it's the credential-stuffing target.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many accounts created from this address. Try again later." },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." },
});

// Same shape as loginLimiter — a stolen/replayed identity token is the equivalent
// brute-force surface, even though there's no password to guess here.
const appleSignInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again later." },
});

// Tighter than login — a valid session token plus this endpoint is the shortest path
// to hijacking an account's credentials if a token leaks, so brute-forcing the current
// password shouldn't get many tries.
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password change attempts. Try again later." },
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateCredentials(reqBody: unknown): { email: string; password: string; role?: UserRole } {
  const body = (reqBody ?? {}) as { email?: unknown; password?: unknown; role?: unknown };
  if (typeof body.email !== "string" || typeof body.password !== "string") {
    throw new Error("email and password are required");
  }

  const email = normalizeEmail(body.email);
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Enter a valid email address");
  }

  if (body.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const role = VALID_ROLES.includes(body.role as UserRole) ? (body.role as UserRole) : undefined;
  return { email, password: body.password, role };
}

function issueSession(user: User) {
  const token = createSessionToken({ userId: user.id, email: user.email });
  // Defensive strip: callers may pass a UserRow (which carries password_hash) here —
  // TS structural typing lets that through silently since UserRow extends User, and
  // JSON.stringify would otherwise serialize the hash straight into the response body.
  const { password_hash: _passwordHash, ...safeUser } = user as User & { password_hash?: unknown };
  return { user: safeUser, token };
}

/**
 * Registers a new email/password account, or upgrades a legacy dev-created user by
 * adding a real password hash if the email already exists without one.
 */
authRouter.post(
  "/register",
  registerLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, role } = validateCredentials(req.body);
    const existing = await findUserByEmail(email);

    if (existing?.password_hash) {
      res.status(409).json({ error: "Email already registered. Sign in instead." });
      return;
    }

    if (existing) {
      const passwordHash = hashPassword(password);
      const upgraded = await updateUserPasswordHash(existing.id, passwordHash);
      res.status(200).json(issueSession(upgraded));
      return;
    }

    const user = await createUser({
      email,
      passwordHash: hashPassword(password),
      role: role ?? "beginner",
    });
    // Joiner: the one true "new account" event — deliberately not logged for the
    // legacy-user-upgrade branch above, which is an existing account gaining a
    // password, not a new join.
    await logLifecycleEvent({
      userId: user.id,
      userEmail: user.email,
      eventType: "joiner_signup",
      details: { role: user.role },
    });

    res.status(201).json(issueSession(user));
  }),
);

authRouter.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = validateCredentials(req.body);
    const user = await findUserByEmail(email);

    if (!user?.password_hash || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    res.status(200).json(issueSession(user));
  }),
);

/**
 * Sign in with Apple. Trusts nothing the client sends except the identity_token itself
 * (verified server-side against Apple's own signing keys, see appleSignIn.service.ts) —
 * full_name is Apple's one-time-only "user" object data (only present on the very first
 * authorization), used purely as display copy for a brand-new account, never trusted for
 * identity. Joins on the token's immutable `sub` claim, not email, since Hide My Email
 * relay addresses and the "email only sent once" behavior make email an unreliable key.
 */
authRouter.post(
  "/apple",
  appleSignInLimiter,
  asyncHandler(async (req, res) => {
    const { identity_token: identityToken, full_name: fullName } = (req.body ?? {}) as {
      identity_token?: unknown;
      full_name?: unknown;
    };

    if (typeof identityToken !== "string" || !identityToken) {
      res.status(400).json({ error: "identity_token is required" });
      return;
    }

    let identity;
    try {
      identity = await verifyAppleIdentityToken(identityToken);
    } catch (err) {
      if (err instanceof AppleIdentityTokenError) {
        res.status(401).json({ error: "Apple sign-in could not be verified. Please try again." });
        return;
      }
      throw err;
    }

    const existingByAppleId = await findUserByAppleId(identity.appleUserId);
    if (existingByAppleId) {
      res.status(200).json(issueSession(existingByAppleId));
      return;
    }

    if (!identity.email) {
      res.status(400).json({
        error: "Apple did not share an email for this account. Try signing in with email/password instead.",
      });
      return;
    }

    const existingByEmail = await findUserByEmail(identity.email);
    if (existingByEmail) {
      // Links rather than creating a second account — only when Apple itself has
      // verified the email actually belongs to this Apple ID, so a claimed-but-unverified
      // relay address can't be used to hijack an existing email/password account.
      if (!identity.emailVerified) {
        res.status(409).json({
          error: "An account with this email already exists. Sign in with email/password instead.",
        });
        return;
      }
      const linked = await linkAppleIdToUser(existingByEmail.id, identity.appleUserId);
      res.status(200).json(issueSession(linked));
      return;
    }

    const user = await createUser({
      email: identity.email,
      role: "beginner",
      appleUserId: identity.appleUserId,
    });
    await logLifecycleEvent({
      userId: user.id,
      userEmail: user.email,
      eventType: "joiner_signup",
      details: { role: user.role, provisioned_via: "apple_sign_in", full_name: fullName ?? null },
    });

    res.status(201).json(issueSession(user));
  }),
);

/**
 * Used both for the forced first-login change (accounts provisioned with a generated
 * default password via scripts/seedAdmin.ts have must_change_password: true) and as a
 * general-purpose "change my password" action — either way, a successful change always
 * clears the flag.
 */
authRouter.post(
  "/change-password",
  requireUser,
  changePasswordLimiter,
  asyncHandler(async (req, res) => {
    const { current_password: currentPassword, new_password: newPassword } = (req.body ?? {}) as {
      current_password?: unknown;
      new_password?: unknown;
    };

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      res.status(400).json({ error: "current_password and new_password are required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const user = await findUserByEmail(req.currentUser!.email);
    if (!user?.password_hash || !verifyPassword(currentPassword, user.password_hash)) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const updated = await updateUserPasswordHash(user.id, hashPassword(newPassword), false);
    res.status(200).json(issueSession(updated));
  }),
);
