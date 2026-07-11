import { pool } from "../db";

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
}): Promise<User> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (email, password_hash, role, firebase_uid)
     VALUES ($1, $2, $3, $4)
     RETURNING ${SAFE_USER_COLUMNS}, password_hash`,
    [input.email, input.passwordHash, input.role, input.firebaseUid ?? null],
  );
  return mapUserRow(result.rows[0]);
}

export async function updateUserPasswordHash(userId: string, passwordHash: string): Promise<User> {
  const result = await pool.query<UserRow>(
    `UPDATE users
     SET password_hash = $2
     WHERE id = $1
     RETURNING ${SAFE_USER_COLUMNS}, password_hash`,
    [userId, passwordHash],
  );
  return mapUserRow(result.rows[0]);
}

export async function deleteUserById(userId: string): Promise<void> {
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
}
