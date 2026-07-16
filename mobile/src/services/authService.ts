import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { api } from './api';

export interface Session {
  email: string;
  token: string;
  mustChangePassword: boolean;
}

interface AuthResponse {
  token: string;
  user: {
    email: string;
    must_change_password: boolean;
  };
}

// Keychain (iOS Keychain / Android Keystore-backed) rather than AsyncStorage — the
// session token is a bearer credential and AsyncStorage is plain, unencrypted on-disk
// storage (a plist/SQLite file readable on a jailbroken/rooted or backed-up device).
// WHEN_UNLOCKED_THIS_DEVICE_ONLY: never synced to iCloud Keychain, and unreadable
// before the device's first unlock, but doesn't prompt Face ID/Touch ID on every read
// (that would fight the "restore session on launch" goal, not just secure it).
const KEYCHAIN_SERVICE = 'com.lashlyai.session';
const KEYCHAIN_OPTIONS: Keychain.SetOptions = {
  service: KEYCHAIN_SERVICE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// Legacy storage key from before the Keychain migration — kept only so existing
// installs (e.g. current TestFlight testers) don't get silently signed out the first
// time they open the app after this update. Migrated into Keychain on first read, then
// deleted; nothing new is ever written here.
const LEGACY_ASYNC_STORAGE_KEY = 'lashlyai.session';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toSession(response: AuthResponse): Session {
  return {
    email: response.user.email,
    token: response.token,
    mustChangePassword: response.user.must_change_password,
  };
}

function parseSession(raw: string): Session | null {
  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.email === 'string' && typeof parsed.token === 'string') {
      return {
        email: parsed.email,
        token: parsed.token,
        mustChangePassword: parsed.mustChangePassword ?? false,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function signUp(email: string, password: string): Promise<Session> {
  const response = await api.post<AuthResponse>('/auth/register', {
    email: normalizeEmail(email),
    password,
  });
  return toSession(response);
}

export async function signIn(email: string, password: string): Promise<Session> {
  const response = await api.post<AuthResponse>('/auth/login', {
    email: normalizeEmail(email),
    password,
  });
  return toSession(response);
}

export async function signInWithApple(
  identityToken: string,
  fullName?: { givenName?: string | null; familyName?: string | null } | null,
): Promise<Session> {
  const response = await api.post<AuthResponse>('/auth/apple', {
    identity_token: identityToken,
    full_name: fullName,
  });
  return toSession(response);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<Session> {
  const response = await api.post<AuthResponse>('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return toSession(response);
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email: normalizeEmail(email) });
}

export async function resetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<Session> {
  const response = await api.post<AuthResponse>('/auth/reset-password', {
    email: normalizeEmail(email),
    code,
    new_password: newPassword,
  });
  return toSession(response);
}

export async function signOut(): Promise<void> {
  await clearPersistedSession();
}

// Sessions previously only lived in React state — closing the app (not just
// backgrounding it) signed everyone out every time, since nothing survived a fresh
// launch. Restored by AuthContext on mount.
export async function persistSession(session: Session): Promise<void> {
  await Keychain.setGenericPassword(session.email, JSON.stringify(session), KEYCHAIN_OPTIONS);
}

export async function loadPersistedSession(): Promise<Session | null> {
  // Keychain is a native module with real failure modes AsyncStorage never had (no
  // device passcode set, entitlement misconfiguration, restore-from-backup edge cases)
  // — fail closed to "no session" (forces a normal re-login) instead of throwing and
  // leaving AuthContext's restore effect with an unhandled rejection.
  let credentials: false | Keychain.UserCredentials;
  try {
    credentials = await Keychain.getGenericPassword(KEYCHAIN_OPTIONS);
  } catch {
    credentials = false;
  }
  if (credentials) {
    return parseSession(credentials.password);
  }

  // Nothing in Keychain yet — check for a pre-migration session in AsyncStorage so an
  // existing install doesn't get signed out by this upgrade.
  const legacyRaw = await AsyncStorage.getItem(LEGACY_ASYNC_STORAGE_KEY);
  if (!legacyRaw) return null;

  const legacySession = parseSession(legacyRaw);
  await AsyncStorage.removeItem(LEGACY_ASYNC_STORAGE_KEY);
  if (!legacySession) return null;

  await persistSession(legacySession);
  return legacySession;
}

export async function clearPersistedSession(): Promise<void> {
  await Keychain.resetGenericPassword(KEYCHAIN_OPTIONS);
  await AsyncStorage.removeItem(LEGACY_ASYNC_STORAGE_KEY);
}
