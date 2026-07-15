import crypto from "node:crypto";

/**
 * Verifies a Sign in with Apple identity token (a JWT signed by Apple, not us) without
 * pulling in a JWT/JWKS library — same hand-rolled-crypto style as auth.service.ts's
 * session tokens. Apple's public keys rotate infrequently; cached in memory for an hour
 * per Apple's own guidance rather than fetched on every sign-in.
 */

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";
const KEYS_CACHE_TTL_MS = 60 * 60 * 1000;

interface AppleJwk {
  kty: string;
  kid: string;
  alg: string;
  n: string;
  e: string;
}

let cachedKeys: AppleJwk[] | null = null;
let cachedAt = 0;

async function getApplePublicKeys(): Promise<AppleJwk[]> {
  if (cachedKeys && Date.now() - cachedAt < KEYS_CACHE_TTL_MS) {
    return cachedKeys;
  }
  const response = await fetch(APPLE_KEYS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Apple's signing keys (status ${response.status})`);
  }
  const body = (await response.json()) as { keys: AppleJwk[] };
  cachedKeys = body.keys;
  cachedAt = Date.now();
  return cachedKeys;
}

function base64UrlDecode(segment: string): Buffer {
  return Buffer.from(segment, "base64url");
}

export class AppleIdentityTokenError extends Error {}

export interface AppleIdentity {
  appleUserId: string; // the "sub" claim — immutable, use this as the join key, never email
  email: string | null;
  emailVerified: boolean;
}

/**
 * Verifies signature, issuer, audience, and expiry — the full set Apple's own docs
 * require a server to check before trusting the token's claims.
 */
export async function verifyAppleIdentityToken(identityToken: string): Promise<AppleIdentity> {
  const parts = identityToken.split(".");
  if (parts.length !== 3) {
    throw new AppleIdentityTokenError("Malformed identity token");
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { kid?: string; alg?: string };
  let payload: {
    iss?: string;
    aud?: string;
    exp?: number;
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
  };
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString("utf8"));
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"));
  } catch {
    throw new AppleIdentityTokenError("Malformed identity token");
  }

  if (header.alg !== "RS256" || !header.kid) {
    throw new AppleIdentityTokenError("Unexpected identity token header");
  }

  const keys = await getApplePublicKeys();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    throw new AppleIdentityTokenError("Identity token signed by an unrecognized key");
  }

  const publicKey = crypto.createPublicKey({
    key: { kty: jwk.kty, n: jwk.n, e: jwk.e },
    format: "jwk",
  });
  const signingInput = `${headerB64}.${payloadB64}`;
  const verified = crypto.verify(
    "RSA-SHA256",
    Buffer.from(signingInput),
    publicKey,
    base64UrlDecode(signatureB64),
  );
  if (!verified) {
    throw new AppleIdentityTokenError("Identity token signature verification failed");
  }

  const expectedAudience = process.env.APPLE_BUNDLE_ID ?? "com.canadasun.lashlyai";
  if (payload.iss !== APPLE_ISSUER) {
    throw new AppleIdentityTokenError("Unexpected token issuer");
  }
  if (payload.aud !== expectedAudience) {
    throw new AppleIdentityTokenError("Token was not issued for this app");
  }
  if (!payload.exp || payload.exp * 1000 < Date.now()) {
    throw new AppleIdentityTokenError("Identity token expired");
  }
  if (!payload.sub) {
    throw new AppleIdentityTokenError("Identity token missing subject");
  }

  return {
    appleUserId: payload.sub,
    email: payload.email ?? null,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
  };
}
