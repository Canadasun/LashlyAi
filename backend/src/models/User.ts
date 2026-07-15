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
  is_admin: boolean;
  must_change_password: boolean;
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
  is_admin,
  must_change_password,
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
    is_admin: row.is_admin,
    must_change_password: row.must_change_password,
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

export async function createUser(input: {
  email: string;
  passwordHash: string;
  role: UserRole;
  firebaseUid?: string | null;
  mustChangePassword?: boolean;
}): Promise<User> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (email, password_hash, role, firebase_uid, must_change_password)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SAFE_USER_COLUMNS}, password_hash`,
    [
      input.email,
      input.passwordHash,
      input.role,
      input.firebaseUid ?? null,
      input.mustChangePassword ?? false,
    ],
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
export async function syncAdminFlagFromAllowlist(user: User): Promise<User> {
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

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
