import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
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

/**
 * Firebase ID tokens expire after 1 hour. The SDK auto-refreshes them internally
 * (~5 min before expiry) as long as something is listening — onIdTokenChanged fires
 * with the new token each time that happens. Without this, every session would start
 * getting silent 401s an hour after sign-in. No-op in dev-stub mode, where
 * "dev:<email>" tokens don't expire.
 */
export function subscribeToTokenRefresh(onToken: (token: string | null) => void): () => void {
  if (!isFirebaseConfigured || !auth) {
    return () => {};
  }
  return onIdTokenChanged(auth, async (user) => {
    if (!user) {
      onToken(null);
      return;
    }
    const token = await user.getIdToken();
    onToken(token);
  });
}
