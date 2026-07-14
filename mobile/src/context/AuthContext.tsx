import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { setAuthToken, setUnauthorizedHandler } from '../services/api';
import {
  changePassword as doChangePassword,
  loadPersistedSession,
  persistSession,
  Session,
  signIn as doSignIn,
  signOut as doSignOut,
  signUp as doSignUp,
} from '../services/authService';

interface AuthContextValue {
  session: Session | null;
  restoringSession: boolean;
  sessionExpiredMessage: string | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoringSession, setRestoringSession] = useState(true);
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

  // Sessions live in AsyncStorage (services/authService.ts), not just React state —
  // restore whatever was persisted on the previous launch instead of forcing a
  // re-login every time the app is closed and reopened.
  useEffect(() => {
    loadPersistedSession()
      .then((restored) => {
        if (restored) {
          setAuthToken(restored.token);
          setSession(restored);
        }
      })
      .finally(() => setRestoringSession(false));
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const s = await doSignUp(email, password);
    await persistSession(s);
    setAuthToken(s.token);
    setSessionExpiredMessage(null);
    setSession(s);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const s = await doSignIn(email, password);
    await persistSession(s);
    setAuthToken(s.token);
    setSessionExpiredMessage(null);
    setSession(s);
  }, []);

  const signOut = useCallback(async () => {
    await doSignOut();
    setAuthToken(undefined);
    setSession(null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const s = await doChangePassword(currentPassword, newPassword);
    await persistSession(s);
    setAuthToken(s.token);
    setSession(s);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        restoringSession,
        sessionExpiredMessage,
        signUp,
        signIn,
        signOut,
        changePassword,
      }}>
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
