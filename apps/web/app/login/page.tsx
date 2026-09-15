"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../src/context/auth-context";
import { Banner, Button, Card, Field, Input } from "../../src/components/ui";
import { colors, spacing } from "../../src/theme/tokens";

export default function LoginPage() {
  const { session, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) router.replace("/dashboard");
  }, [session, router]);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar.");
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
        <p style={{ color: colors.textMuted, marginTop: 0, marginBottom: spacing.xl }}>Backoffice</p>
        <form onSubmit={(e) => void handleSubmit(e)}>
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
      </Card>
    </main>
  );
}
