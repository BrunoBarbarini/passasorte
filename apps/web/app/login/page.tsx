"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../src/context/auth-context";
import { Banner, Button, Card, Field, Input } from "../../src/components/ui";
import { colors, spacing } from "../../src/theme/tokens";

/**
 * Login em duas etapas: senha (aal1) e, se a conta exigir (CLAUDE.md #17,
 * REQUIRE_MFA_FOR_PRIVILEGED_ROLES), o código TOTP (aal2).
 *
 * Gap real encontrado no teste E2E do backoffice (15/09/2026): esta tela
 * nunca tinha uma segunda etapa — qualquer ADMIN/OPERATOR conseguia logar
 * com senha e caía no dashboard, mas ficava preso em aal1 para sempre, já
 * que não existia nenhum jeito de completar o MFA pelo navegador. Toda
 * chamada de backoffice então voltava 403 AUTHORIZATION_ERROR em silêncio
 * (a lista aparecia vazia, sem nenhum aviso, até a tela ganhar o
 * loadError). O provedor (Supabase) e o fator (TOTP) já eram decisão
 * tomada (ADR-008 + enrollment real da conta ADMIN) - esta tela só fecha o
 * fluxo que faltava, não inventa nenhum mecanismo novo de MFA.
 */
export default function LoginPage() {
  const { session, signIn, mfaRequired, verifyMfaCode } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"password" | "mfa">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Não redireciona cego para o dashboard só porque existe uma sessão
  // (ela pode ter ficado persistida em aal1 de um login anterior que
  // nunca completou o MFA - exatamente o bug encontrado no teste E2E de
  // 15/09/2026). Confirma o nível de verificação antes de decidir.
  useEffect(() => {
    if (!session || step !== "password") return;
    let cancelled = false;
    mfaRequired()
      .then((required) => {
        if (cancelled) return;
        if (required) {
          setStep("mfa");
        } else {
          router.replace("/dashboard");
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session, step, mfaRequired, router]);

  async function handlePasswordSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      if (await mfaRequired()) {
        setStep("mfa");
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await verifyMfaCode(mfaCode);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.navy,
        padding: spacing.lg,
      }}
    >
      <Card style={{ width: "100%", maxWidth: 380 }}>
        <h1 style={{ fontSize: 22, marginBottom: spacing.xs }}>PassaSorte</h1>
        <p style={{ color: colors.textMuted, marginTop: 0, marginBottom: spacing.xl }}>
          {step === "password" ? "Backoffice" : "Verificação em duas etapas"}
        </p>

        {step === "password" ? (
          <form onSubmit={(e) => void handlePasswordSubmit(e)}>
            <Field label="E-mail" htmlFor="email">
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Senha" htmlFor="password">
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <Banner tone="error">{error}</Banner>}
            <Button type="submit" loading={submitting} style={{ width: "100%" }}>
              Entrar
            </Button>
          </form>
        ) : (
          <form onSubmit={(e) => void handleMfaSubmit(e)}>
            <p style={{ color: colors.textMuted, fontSize: 14, marginTop: 0 }}>
              Digite o código de 6 dígitos do seu aplicativo autenticador.
            </p>
            <Field label="Código de verificação" htmlFor="mfaCode">
              <Input
                id="mfaCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              />
            </Field>
            {error && <Banner tone="error">{error}</Banner>}
            <Button type="submit" loading={submitting} style={{ width: "100%" }}>
              Confirmar
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
