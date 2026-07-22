import { pool } from "../db";
import { generateSixDigitCode, hashCode, hashCodeMatches } from "../services/hashedCode.util";

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

export interface EmailVerificationCode {
  id: string;
  user_id: string;
  code_hash: string;
  expires_at: string;
  used_at: string | null;
  attempts: number;
  created_at: string;
}

export async function createEmailVerificationCode(userId: string): Promise<string> {
  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  await pool.query(
    `INSERT INTO email_verification_codes (user_id, code_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hashCode(code), expiresAt],
  );
  return code;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "mismatch" };

export async function verifyEmailVerificationCode(
  userId: string,
  submittedCode: string,
): Promise<VerifyResult> {
  const result = await pool.query<EmailVerificationCode>(
    `SELECT * FROM email_verification_codes
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
    await pool.query(`UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1`, [
      record.id,
    ]);
    return { ok: false, reason: "mismatch" };
  }

  await pool.query(`UPDATE email_verification_codes SET used_at = now() WHERE id = $1`, [record.id]);
  return { ok: true };
}
