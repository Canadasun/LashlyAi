import admin from "firebase-admin";

export interface VerifiedIdentity {
  firebaseUid: string;
  email: string;
}

const firebaseConfigured =
  !!process.env.FIREBASE_PROJECT_ID &&
  !!process.env.FIREBASE_CLIENT_EMAIL &&
  !!process.env.FIREBASE_PRIVATE_KEY;

if (firebaseConfigured) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
} else if (process.env.NODE_ENV === "production") {
  throw new Error(
    "Firebase Admin credentials are missing in production. Refusing to start with the dev auth bypass active.",
  );
} else {
  console.warn(
    "[auth.service] No Firebase Admin credentials configured — using DEV AUTH BYPASS " +
      '(Authorization: "Bearer dev:<email>"). Never enable this in production.',
  );
}

/**
 * Verifies a Firebase ID token. In dev, when no Firebase project is configured yet,
 * accepts "dev:<email>" as a stand-in so the rest of the API is testable end-to-end.
 */
export async function verifyIdToken(bearerToken: string): Promise<VerifiedIdentity> {
  if (!firebaseConfigured) {
    const devMatch = /^dev:(.+)$/.exec(bearerToken);
    if (!devMatch) {
      throw new Error('Invalid dev token. Expected "dev:<email>".');
    }
    const email = devMatch[1];
    return { firebaseUid: `dev-${email}`, email };
  }

  const decoded = await admin.auth().verifyIdToken(bearerToken);
  if (!decoded.email) {
    throw new Error("Firebase token has no associated email.");
  }
  return { firebaseUid: decoded.uid, email: decoded.email };
}
