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
  firebase_uid: string;
  created_at: string;
}

export async function findUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
  const result = await pool.query<User>("SELECT * FROM users WHERE firebase_uid = $1", [
    firebaseUid,
  ]);
  return result.rows[0] ?? null;
}

export async function createUser(input: {
  firebaseUid: string;
  email: string;
  role: UserRole;
}): Promise<User> {
  const result = await pool.query<User>(
    `INSERT INTO users (firebase_uid, email, role)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.firebaseUid, input.email, input.role],
  );
  return result.rows[0];
}
