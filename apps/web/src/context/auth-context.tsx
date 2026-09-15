"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * True quando o login com senha deu certo mas a conta exige um segundo
   * fator (TOTP) para chegar em aal2 — CLAUDE.md #17/TASK-061, REQUIRE_MFA_FOR_PRIVILEGED_ROLES.
   * Descoberto no teste E2E de 15/09/2026: sem essa checagem, o app nunca
   * pedia o código e o usuário ficava travado em aal1 para sempre, levando
   * a 403 AUTHORIZATION_ERROR silencioso em toda rota de backoffice.
   */
  mfaRequired: () => Promise<boolean>;
  verifyMfaCode: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Mirrors apps/mobile's auth-context.tsx: Supabase email/password sign-in is a pragmatic implementation choice (ADR-008 only decided the PROVIDER), not a CLAUDE.md decision. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => undefined)
      .finally(() => setLoading(false));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  // Guarda global de aal2: uma sessão persistida (localStorage) pode ter
  // ficado em aal1 de uma sessão de navegador anterior que nunca completou
  // o MFA — antes desta correção (15/09/2026), qualquer tela de
  // backoffice carregava normalmente e só descobria o 403 silenciosamente
  // ao chamar a API. Em vez de deixar cada tela repetir essa checagem,
  // centralizamos aqui: qualquer sessão aal1-mas-precisa-de-aal2 é
  // mandada para /login, que sabe pedir o código.
  useEffect(() => {
    if (!session || pathname === "/login") return;
    let cancelled = false;
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data, error }) => {
      if (cancelled || error) return;
      if (data.nextLevel === "aal2" && data.currentLevel !== data.nextLevel) {
        router.replace("/login");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session, pathname, router]);

  async function signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  /**
   * Supabase reporta o nível atual (aal1 logo após senha) e o próximo
   * nível exigido pelos fatores cadastrados na conta (aal2 se houver TOTP
   * verificado). Só pedimos o código quando os dois divergem — uma conta
   * sem MFA cadastrado nunca vê essa tela.
   */
  async function mfaRequired(): Promise<boolean> {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    return data.nextLevel === "aal2" && data.currentLevel !== data.nextLevel;
  }

  async function verifyMfaCode(code: string): Promise<void> {
    const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;
    const totpFactor = factorsData.totp.find((f) => f.status === "verified");
    if (!totpFactor) {
      throw new Error("Nenhum fator de autenticação (TOTP) verificado foi encontrado nesta conta.");
    }
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: totpFactor.id,
    });
    if (challengeError) throw challengeError;
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challengeData.id,
      code,
    });
    if (verifyError) throw verifyError;
    // supabase-js já atualiza a sessão internamente (aal2) e dispara
    // onAuthStateChange, que atualiza o `session` deste contexto sozinho.
  }

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut, mfaRequired, verifyMfaCode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth precisa estar dentro de um AuthProvider.");
  }
  return ctx;
}
