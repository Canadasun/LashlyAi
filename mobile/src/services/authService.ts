import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

export interface Session {
  email: string;
  token: string;
}

interface AuthResponse {
  token: string;
  user: {
    email: string;
  };
}

const SESSION_STORAGE_KEY = 'lashlyai.session';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function signUp(email: string, password: string): Promise<Session> {
  const response = await api.post<AuthResponse>('/auth/register', {
    email: normalizeEmail(email),
    password,
  });
  return { email: response.user.email, token: response.token };
}

export async function signIn(email: string, password: string): Promise<Session> {
  const response = await api.post<AuthResponse>('/auth/login', {
    email: normalizeEmail(email),
    password,
  });
  return { email: response.user.email, token: response.token };
}

export async function signOut(): Promise<void> {
  await clearPersistedSession();
}

// Sessions previously only lived in React state — closing the app (not just
// backgrounding it) signed everyone out every time, since nothing survived a fresh
// launch. Restored by AuthContext on mount.
export async function persistSession(session: Session): Promise<void> {
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function loadPersistedSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.email === 'string' && typeof parsed.token === 'string') {
      return { email: parsed.email, token: parsed.token };
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearPersistedSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
}
