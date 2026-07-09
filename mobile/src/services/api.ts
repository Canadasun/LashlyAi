import { API_BASE_URL } from '@env';

let currentToken: string | undefined;

export function setAuthToken(token: string | undefined) {
  currentToken = token;
}

// Lets AuthContext react to any 401 from anywhere in the app (e.g. an expired token)
// by signing the user out and bouncing to the login screen, instead of leaving them
// stuck on whatever screen they were on with a raw "invalid token" error.
let onUnauthorized: (() => void) | undefined;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    onUnauthorized?.();
    throw new Error('Your session expired. Please sign in again.');
  }

  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new Error(body?.error ?? `Request to ${path} failed with status ${response.status}`);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
