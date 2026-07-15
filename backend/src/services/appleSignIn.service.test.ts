import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { AppleIdentityTokenError, verifyAppleIdentityToken } from "./appleSignIn.service";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string };
const KID = "test-key-1";

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signToken(payload: Record<string, unknown>, opts: { kid?: string; alg?: string } = {}) {
  const header = { alg: opts.alg ?? "RS256", kid: opts.kid ?? KID, typ: "JWT" };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKey);
  return `${signingInput}.${base64Url(signature)}`;
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    iss: "https://appleid.apple.com",
    aud: "com.canadasun.lashlyai",
    exp: Math.floor(Date.now() / 1000) + 300,
    sub: "apple-user-123",
    email: "artist@example.com",
    email_verified: "true",
    ...overrides,
  };
}

function withFakeAppleKeys<T>(run: () => Promise<T>): Promise<T> {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ keys: [{ kty: "RSA", kid: KID, alg: "RS256", n: jwk.n, e: jwk.e }] }), {
      status: 200,
    })) as typeof fetch;
  return run().finally(() => {
    globalThis.fetch = realFetch;
  });
}

test("verifyAppleIdentityToken accepts a validly signed, current token", async () => {
  const token = signToken(validPayload());
  const identity = await withFakeAppleKeys(() => verifyAppleIdentityToken(token));
  assert.equal(identity.appleUserId, "apple-user-123");
  assert.equal(identity.email, "artist@example.com");
  assert.equal(identity.emailVerified, true);
});

test("verifyAppleIdentityToken rejects a tampered payload", async () => {
  const token = signToken(validPayload());
  const [header, payload, signature] = token.split(".");
  const tamperedPayload = base64Url(JSON.stringify(validPayload({ sub: "attacker-controlled" })));
  const tamperedToken = `${header}.${tamperedPayload}.${signature}`;
  await assert.rejects(
    withFakeAppleKeys(() => verifyAppleIdentityToken(tamperedToken)),
    AppleIdentityTokenError,
  );
});

test("verifyAppleIdentityToken rejects the wrong audience", async () => {
  const token = signToken(validPayload({ aud: "com.someone.else" }));
  await assert.rejects(
    withFakeAppleKeys(() => verifyAppleIdentityToken(token)),
    AppleIdentityTokenError,
  );
});

test("verifyAppleIdentityToken rejects an expired token", async () => {
  const token = signToken(validPayload({ exp: Math.floor(Date.now() / 1000) - 60 }));
  await assert.rejects(
    withFakeAppleKeys(() => verifyAppleIdentityToken(token)),
    AppleIdentityTokenError,
  );
});

test("verifyAppleIdentityToken rejects an unrecognized signing key", async () => {
  const token = signToken(validPayload(), { kid: "some-other-kid" });
  await assert.rejects(
    withFakeAppleKeys(() => verifyAppleIdentityToken(token)),
    AppleIdentityTokenError,
  );
});
