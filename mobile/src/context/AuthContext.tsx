import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setAuthToken, setUnauthorizedHandler } from '../services/api';
import {
  Session,
  signIn as doSignIn,
  signOut as doSignOut,
  signUp as doSignUp,
  subscribeToTokenRefresh,
} from '../services/authService';

interface AuthContextValue {
  session: Session | null;
  sessionExpiredMessage: string | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  // Any 401 from anywhere in the app — including a token that's simply gone stale —
  // signs the user out and bounces them to the login screen instead of leaving them
  // stuck on whatever screen they were on with a raw "invalid token" error.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthToken(undefined);
      setSession((prev) => {
        if (prev) setSessionExpiredMessage('Your session expired. Please sign in again.');
        return null;
      });
    });
  }, []);

  // Firebase ID tokens expire after 1 hour; the SDK auto-refreshes them internally as
  // long as something is listening. Keeps the API client's token current so sessions
  // don't start silently failing an hour after sign-in. No-op in dev-stub mode.
  useEffect(() => {
    const unsubscribe = subscribeToTokenRefresh((token) => {
      if (token) {
        setAuthToken(token);
      } else {
        setAuthToken(undefined);
        setSession(null);
      }
    });
    return unsubscribe;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const s = await doSignUp(email, password);
    setAuthToken(s.token);
    // Links the Firebase identity to a Postgres user row. Idempotent — safe to call
    // on every sign-in too, so we don't need a separate "have we registered?" check.
    await api.post('/auth/register');
    setSessionExpiredMessage(null);
    setSession(s);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const s = await doSignIn(email, password);
    setAuthToken(s.token);
    await api.post('/auth/register');
    setSessionExpiredMessage(null);
    setSession(s);
  }, []);

  const signOut = useCallback(async () => {
    await doSignOut();
    setAuthToken(undefined);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, sessionExpiredMessage, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
