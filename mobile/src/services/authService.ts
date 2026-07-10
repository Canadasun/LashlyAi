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
  return;
}

export function subscribeToTokenRefresh(_onToken: (token: string | null) => void): () => void {
  return () => {};
}
