import React, { createContext, useCallback, useContext, useState } from 'react';
import { api, setAuthToken } from '../services/api';
import {
  Session,
  signIn as doSignIn,
  signOut as doSignOut,
  signUp as doSignUp,
} from '../services/authService';

interface AuthContextValue {
  session: Session | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  const signUp = useCallback(async (email: string, password: string) => {
    const s = await doSignUp(email, password);
    setAuthToken(s.token);
    // Links the Firebase identity to a Postgres user row. Idempotent — safe to call
    // on every sign-in too, so we don't need a separate "have we registered?" check.
    await api.post('/auth/register');
    setSession(s);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const s = await doSignIn(email, password);
    setAuthToken(s.token);
    await api.post('/auth/register');
    setSession(s);
  }, []);

  const signOut = useCallback(async () => {
    await doSignOut();
    setAuthToken(undefined);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, signUp, signIn, signOut }}>
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
