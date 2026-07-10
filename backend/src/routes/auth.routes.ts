import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
} from "../services/auth.service";
import {
  createUser,
  findUserByEmail,
  updateUserPasswordHash,
  User,
  UserRole,
} from "../models/User";

const VALID_ROLES: UserRole[] = ["beginner", "certified", "educator", "salon_owner", "academy"];

export const authRouter = Router();

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
  return { user, token };
}

/**
 * Registers a new email/password account, or upgrades a legacy dev-created user by
 * adding a real password hash if the email already exists without one.
 */
authRouter.post(
  "/register",
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

    res.status(201).json(issueSession(user));
  }),
);

authRouter.post(
  "/login",
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
