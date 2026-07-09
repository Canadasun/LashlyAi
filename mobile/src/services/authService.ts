import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';

export interface Session {
  email: string;
  token: string;
}

/**
 * In dev-stub mode (no Firebase project configured yet), "signing in" just mints a
 * "dev:<email>" token — the exact format backend/src/services/auth.service.ts accepts
 * as its DEV AUTH BYPASS. Swap to real Firebase automatically once .env has real config.
 */
export async function signUp(email: string, password: string): Promise<Session> {
  if (!isFirebaseConfigured || !auth) {
    return { email, token: `dev:${email}` };
  }
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const token = await credential.user.getIdToken();
  return { email, token };
}

export async function signIn(email: string, password: string): Promise<Session> {
  if (!isFirebaseConfigured || !auth) {
    return { email, token: `dev:${email}` };
  }
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const token = await credential.user.getIdToken();
  return { email, token };
}

export async function signOut(): Promise<void> {
  if (isFirebaseConfigured && auth) {
    await firebaseSignOut(auth);
  }
}
