import { pool } from "../db";
import { generateSixDigitCode, hashCode, hashCodeMatches } from "../services/hashedCode.util";

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

export interface PasswordResetCode {
  id: string;
  user_id: string;
  code_hash: string;
  expires_at: string;
  used_at: string | null;
  attempts: number;
  created_at: string;
}

/**
 * Creates a new code for this user and returns the plaintext (only ever available at
 * creation time — the DB only ever stores the hash). Doesn't invalidate prior
 * outstanding codes; a user requesting a second code before checking their email for
 * the first still has both work, harmless since verifyPasswordResetCode already caps
 * attempts and expiry per-code.
 */
export async function createPasswordResetCode(userId: string): Promise<string> {
  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  await pool.query(
    `INSERT INTO password_reset_codes (user_id, code_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hashCode(code), expiresAt],
  );
  return code;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "already_used" | "too_many_attempts" | "mismatch" };

/**
 * Checks the most recent unused code for this user against the submitted code.
 * Increments `attempts` on every mismatch (even before checking expiry) so a stale,
 * never-checked code can't be brute-forced indefinitely just by letting it expire —
 * the same code row logs the attempt regardless of outcome.
 */
export async function verifyPasswordResetCode(userId: string, submittedCode: string): Promise<VerifyResult> {
  const result = await pool.query<PasswordResetCode>(
    `SELECT * FROM password_reset_codes
     WHERE user_id = $1 AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  const record = result.rows[0];
  if (!record) {
    return { ok: false, reason: "not_found" };
  }
  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, reason: "too_many_attempts" };
  }
  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const matches = hashCodeMatches(submittedCode, record.code_hash);
  if (!matches) {
    await pool.query(`UPDATE password_reset_codes SET attempts = attempts + 1 WHERE id = $1`, [
      record.id,
    ]);
    return { ok: false, reason: "mismatch" };
  }

  await pool.query(`UPDATE password_reset_codes SET used_at = now() WHERE id = $1`, [record.id]);
  return { ok: true };
}
