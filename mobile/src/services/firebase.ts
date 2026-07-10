import {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_APP_ID,
  FIREBASE_MESSAGING_SENDER_ID,
} from '@env';
import { initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

// UNUSED: nothing in the app imports `auth` from this module. Real sign-up/sign-in
// goes through services/authService.ts directly against the backend's own
// email/password sessions (backend/src/services/auth.service.ts) — not Firebase. This
// file is a leftover placeholder for the Firebase-based auth originally described in
// CLAUDE.md's tech stack, never wired in after the pivot to homegrown auth.
export const isFirebaseConfigured = Boolean(FIREBASE_API_KEY);

export let auth: Auth | undefined;

if (isFirebaseConfigured) {
  const app = initializeApp({
    apiKey: FIREBASE_API_KEY,
    authDomain: FIREBASE_AUTH_DOMAIN,
    projectId: FIREBASE_PROJECT_ID,
    appId: FIREBASE_APP_ID,
    messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  });
  auth = getAuth(app);
}
