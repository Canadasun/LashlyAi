import {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_APP_ID,
  FIREBASE_MESSAGING_SENDER_ID,
} from '@env';
import { initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

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
  // Default in-memory persistence — session won't survive an app restart until this
  // is revisited alongside a real Firebase project (see docs/roadmap.md Phase 2).
  auth = getAuth(app);
} else {
  console.warn(
    '[firebase] No Firebase config in .env — auth will use the dev-mode stub sign-in, ' +
      'matching the backend DEV AUTH BYPASS. Add real Firebase config to test actual auth.',
  );
}
