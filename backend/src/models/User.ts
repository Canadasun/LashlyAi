import { pool } from "../db";
import { logLifecycleEvent } from "./UserLifecycleEvent";

export type UserRole = "beginner" | "certified" | "educator" | "salon_owner" | "academy";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  experience_level: string | null;
  certifications: string[];
  specialties: string[];
  location: string | null;
  preferred_styles: string[];
  firebase_uid: string | null;
  apple_user_id: string | null;
  is_admin: boolean;
  must_change_password: boolean;
  email_verified: boolean;
  created_at: string;
}

const SAFE_USER_COLUMNS = `
  id,
  email,
  role,
  experience_level,
  certifications,
  specialties,
  location,
  preferred_styles,
  firebase_uid,
  apple_user_id,
  is_admin,
  must_change_password,
  email_verified,
  created_at
`;

export interface UserRow extends User {
  password_hash: string | null;
}

function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    experience_level: row.experience_level,
    certifications: row.certifications,
    specialties: row.specialties,
    location: row.location,
    preferred_styles: row.preferred_styles,
    firebase_uid: row.firebase_uid,
    apple_user_id: row.apple_user_id,
    is_admin: row.is_admin,
    must_change_password: row.must_change_password,
    email_verified: row.email_verified,
    created_at: row.created_at,
  };
}

export async function findUserById(userId: string): Promise<User | null> {
  const result = await pool.query<UserRow>(`SELECT ${SAFE_USER_COLUMNS} FROM users WHERE id = $1`, [
    userId,
  ]);
  const row = result.rows[0];
  return row ? mapUserRow(row) : null;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>("SELECT * FROM users WHERE lower(email) = lower($1)", [
    email,
  ]);
  return result.rows[0] ?? null;
}

export async function findUserByAppleId(appleUserId: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>("SELECT * FROM users WHERE apple_user_id = $1", [
    appleUserId,
  ]);
  return result.rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  passwordHash?: string | null;
  role: UserRole;
  firebaseUid?: string | null;
  appleUserId?: string | null;
  mustChangePassword?: boolean;
  // Apple sign-in already tells us whether Apple itself verified the email (see
  // appleSignIn.service.ts's emailVerified) — no reason to make that user go through
  // the code-verification flow too. Defaults false for the email/password path, where
  // nothing has confirmed the address yet.
  emailVerified?: boolean;
}): Promise<User> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (email, password_hash, role, firebase_uid, apple_user_id, must_change_password, email_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${SAFE_USER_COLUMNS}, password_hash`,
    [
      input.email,
      input.passwordHash ?? null,
      input.role,
      input.firebaseUid ?? null,
      input.appleUserId ?? null,
      input.mustChangePassword ?? false,
      input.emailVerified ?? false,
    ],
  );
  return mapUserRow(result.rows[0]);
}

export async function markEmailVerified(userId: string): Promise<User> {
  const result = await pool.query<UserRow>(
    `UPDATE users SET email_verified = true WHERE id = $1 RETURNING ${SAFE_USER_COLUMNS}, password_hash`,
    [userId],
  );
  return mapUserRow(result.rows[0]);
}

// Links an Apple identity to an existing email/password account — lets an artist who
// signed up with email later use "Sign in with Apple" on the same account instead of
// silently creating a second one, as long as Apple's (verified) email claim matches.
export async function linkAppleIdToUser(userId: string, appleUserId: string): Promise<User> {
  const result = await pool.query<UserRow>(
    `UPDATE users SET apple_user_id = $2 WHERE id = $1 RETURNING ${SAFE_USER_COLUMNS}, password_hash`,
    [userId, appleUserId],
  );
  return mapUserRow(result.rows[0]);
}

// mustChangePassword defaults to clearing the flag — any deliberate password change
// (including the user completing the forced first-login change) should turn it off;
// only backend/src/scripts/seedAdmin.ts sets it back to true when provisioning a
// generated default password.
export async function updateUserPasswordHash(
  userId: string,
  passwordHash: string,
  mustChangePassword = false,
): Promise<User> {
  const result = await pool.query<UserRow>(
    `UPDATE users
     SET password_hash = $2, must_change_password = $3
     WHERE id = $1
     RETURNING ${SAFE_USER_COLUMNS}, password_hash`,
    [userId, passwordHash, mustChangePassword],
  );
  return mapUserRow(result.rows[0]);
}

export async function deleteUserById(userId: string): Promise<void> {
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
}

// Self-heals is_admin from the ADMIN_EMAILS allowlist on every authenticated request
// (see requireUser middleware) so admin access doesn't depend on registration order
// relative to when this env var/migration shipped — no separate seed script to run.
//
// Fails safe if the var is unset/empty: an accidental clear (typo, dropped value on a
// Railway redeploy) must not silently demote every existing admin to is_admin:false on
// their next request. Only sync when the allowlist actually has entries, so revoking a
// specific admin still works (remove their email while others remain listed) but losing
// the whole var doesn't lock everyone out.
export async function syncAdminFlagFromAllowlist(user: User): Promise<User> {
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length === 0) {
    return user;
  }

  const shouldBeAdmin = allowlist.includes(user.email.toLowerCase());
  if (shouldBeAdmin === user.is_admin) {
    return user;
  }

  const result = await pool.query<UserRow>(
    `UPDATE users SET is_admin = $2 WHERE id = $1 RETURNING ${SAFE_USER_COLUMNS}, password_hash`,
    [user.id, shouldBeAdmin],
  );
  // Mover: the only path that changes is_admin at all — logged here specifically
  // (rather than at each of this function's call sites) so every flip is captured
  // exactly once regardless of which request happened to trigger the self-heal.
  await logLifecycleEvent({
    userId: user.id,
    userEmail: user.email,
    eventType: "mover_admin_status_changed",
    details: { from_is_admin: user.is_admin, to_is_admin: shouldBeAdmin },
  });
  return mapUserRow(result.rows[0]);
}
