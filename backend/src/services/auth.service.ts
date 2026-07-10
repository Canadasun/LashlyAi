import crypto from "node:crypto";

export interface VerifiedIdentity {
  userId: string;
  email: string;
}

const SESSION_PREFIX = "lashly";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function resolveSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET ?? process.env.ADMIN_API_KEY;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging") {
    throw new Error(
      "AUTH_SESSION_SECRET is missing. Refusing to start without a signed session secret.",
    );
  }

  console.warn(
    "[auth.service] AUTH_SESSION_SECRET is missing — using a local development fallback secret.",
  );
  return "lashlyai-local-dev-session-secret";
}

const SESSION_SECRET = resolveSessionSecret();

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("base64url");
  return `scrypt$${salt}$${derivedKey}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const [scheme, salt, hash] = passwordHash.split("$");
  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }

  const derivedKey = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "base64url");
  return expected.length === derivedKey.length && crypto.timingSafeEqual(expected, derivedKey);
}

export function createSessionToken(identity: VerifiedIdentity): string {
  const payload = {
    sub: identity.userId,
    email: identity.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    v: 1,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(encodedPayload).digest("base64url");
  return `${SESSION_PREFIX}.${encodedPayload}.${signature}`;
}

export function verifySessionToken(sessionToken: string): VerifiedIdentity {
  const [prefix, encodedPayload, signature] = sessionToken.split(".");
  if (prefix !== SESSION_PREFIX || !encodedPayload || !signature) {
    throw new Error("Invalid session token.");
  }

  const expectedSignature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encodedPayload)
    .digest("base64url");
  const received = Buffer.from(signature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new Error("Invalid session token.");
  }

  let payload: { sub?: string; email?: string; exp?: number };
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      sub?: string;
      email?: string;
      exp?: number;
    };
  } catch {
    throw new Error("Invalid session token.");
  }

  if (!payload.sub || !payload.email || !payload.exp) {
    throw new Error("Invalid session token.");
  }

  if (payload.exp * 1000 < Date.now()) {
    throw new Error("Session token expired.");
  }

  return { userId: payload.sub, email: payload.email };
}
