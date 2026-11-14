import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** What the rest of the app needs from a signed-in user. */
export interface AppSession {
  access_token: string;
  email: string;
}

export interface AuthContextValue {
  session: AppSession | null;
  loading: boolean;
  accessToken: string | undefined;
  /** True when the local-only test sign-in is active (no Supabase). */
  devAuth: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  /** Local test sign-in: only available when EXPO_PUBLIC_DEV_AUTH=true (API side: DEV_AUTH_ENABLED). */
  signInDev: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEV_AUTH = process.env.EXPO_PUBLIC_DEV_AUTH === "true";
const DEV_SESSION_KEY = "passasorte.dev-session";
const DEV_DOMAIN = "dev.passasorte.test";

/** Lazy: in test-login mode Supabase is never loaded (and its env vars are not required). */
async function loadSupabase() {
  return (await import("../lib/supabase.js")).supabase;
}

/**
 * TASK-039 Mobile Auth (ADR-008 Supabase Auth, email+password). While the real login is
 * deferred (CLAUDE.md, 2026-11-13) a LOCAL-ONLY test sign-in exists: the "token" is
 * `dev:<name>@dev.passasorte.test`, accepted by apps/api only when DEV_AUTH_ENABLED=true and
 * NODE_ENV=local.
 */
export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (DEV_AUTH) {
      AsyncStorage.getItem(DEV_SESSION_KEY)
        .then((stored) => {
          if (stored) setSession(JSON.parse(stored) as AppSession);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
      return undefined;
    }
    let unsubscribe: (() => void) | undefined;
    loadSupabase()
      .then(async (supabase) => {
        const { data } = await supabase.auth.getSession();
        setSession(
          data.session
            ? { access_token: data.session.access_token, email: data.session.user.email ?? "" }
            : null,
        );
        const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
          setSession(
            next ? { access_token: next.access_token, email: next.user.email ?? "" } : null,
          );
        });
        unsubscribe = () => subscription.subscription.unsubscribe();
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => unsubscribe?.();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      accessToken: session?.access_token,
      devAuth: DEV_AUTH,
      signInWithPassword: async (email: string, password: string) => {
        const supabase = await loadSupabase();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
      },
      signUpWithPassword: async (email: string, password: string) => {
        const supabase = await loadSupabase();
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
      },
      signInDev: async (name: string) => {
        if (!DEV_AUTH) throw new Error("O login de teste não está ativado neste ambiente.");
        const clean = name.trim().toLowerCase();
        if (!/^[a-z0-9._-]{1,64}$/.test(clean)) {
          throw new Error("Use só letras minúsculas, números, ponto, hífen ou sublinhado.");
        }
        const email = `${clean}@${DEV_DOMAIN}`;
        const next: AppSession = { access_token: `dev:${email}`, email };
        await AsyncStorage.setItem(DEV_SESSION_KEY, JSON.stringify(next));
        setSession(next);
      },
      signOut: async () => {
        if (DEV_AUTH) {
          await AsyncStorage.removeItem(DEV_SESSION_KEY);
          setSession(null);
          return;
        }
        const supabase = await loadSupabase();
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth() usado fora de um AuthProvider.");
  }
  return context;
}
