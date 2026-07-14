import "dotenv/config";
import crypto from "node:crypto";
import { pool } from "../db";
import { hashPassword } from "../services/auth.service";
import { createUser, findUserByEmail, updateUserPasswordHash } from "../models/User";

/**
 * Provisions (or resets) the login credential for an admin account with a generated
 * default password, flagged must_change_password so the founder is forced to pick
 * their own on first login. This is distinct from ADMIN_EMAILS (which only controls
 * is_admin self-healing on login, see models/User.ts's syncAdminFlagFromAllowlist) —
 * that account still needs an actual password to log into the app with at all.
 *
 * Usage: npm run seed:admin -- <email>
 * Prints the plaintext default password once, to stdout only — never persisted
 * anywhere else. Safe to re-run: an existing account just gets its password reset.
 */
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run seed:admin -- <email>");
    process.exitCode = 1;
    return;
  }

  // base64url of 16 random bytes: ~22 chars, mixed-case + digits, no ambiguous
  // punctuation — easy enough to read aloud/type once during a forced first login.
  const password = crypto.randomBytes(16).toString("base64url");
  const passwordHash = hashPassword(password);

  const existing = await findUserByEmail(email);
  if (existing) {
    await updateUserPasswordHash(existing.id, passwordHash, true);
    console.log(`Reset password for existing account: ${email}`);
  } else {
    await createUser({
      email,
      passwordHash,
      role: "academy",
      mustChangePassword: true,
    });
    console.log(`Created new admin account: ${email}`);
  }

  console.log(`Default password: ${password}`);
  console.log("This account must change its password on next login.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
