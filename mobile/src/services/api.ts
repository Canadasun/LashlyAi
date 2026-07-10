import { API_BASE_URL } from '@env';

let currentToken: string | undefined;
const DEFAULT_API_BASE_URL = 'https://lashlyai-production.up.railway.app';

function resolveApiBaseUrl(): string {
  const baseUrl = API_BASE_URL?.trim();

  if (
    baseUrl &&
    !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseUrl)
  ) {
    return baseUrl;
  }

  if (__DEV__ && baseUrl) {
    console.warn(
      `[api] API_BASE_URL is set to ${baseUrl}; using ${DEFAULT_API_BASE_URL} for auth requests so mobile auth can reach the deployed backend.`,
    );
  }

  return DEFAULT_API_BASE_URL;
}

const resolvedApiBaseUrl = resolveApiBaseUrl();

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

  const response = await fetch(`${resolvedApiBaseUrl}${path}`, { ...options, headers });

  if (response.status === 401) {
    onUnauthorized?.();
    throw new Error('Your session expired. Please sign in again.');
  }

  const text = await response.text();
  // A non-JSON response (an HTML 404/502 page from a typo'd route, or the platform's
  // own edge proxy during a redeploy) would otherwise throw a raw "Unexpected token
  // '<'" SyntaxError here instead of a clean, actionable error message.
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const message = (body as { error?: string } | undefined)?.error;
    throw new Error(message ?? `Request to ${path} failed with status ${response.status}`);
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
