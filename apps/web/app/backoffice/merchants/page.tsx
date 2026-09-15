"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../src/context/auth-context";
import { apiRequest } from "../../../src/lib/api-client";
import type { MerchantView } from "../../../src/types/api";
import { Nav } from "../../../src/components/Nav";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  StatusPill,
} from "../../../src/components/ui";
import { colors, spacing } from "../../../src/theme/tokens";

/** FR-010 Merchant Management, list + create. GET /backoffice/merchants and POST /merchants (OPERATOR/ADMIN). */
export default function MerchantsPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [merchants, setMerchants] = useState<MerchantView[]>([]);
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const rows = await apiRequest<MerchantView[]>("/backoffice/merchants", {
        accessToken: session.access_token,
      });
      setMerchants(rows);
      setLoadError(null);
    } catch (err) {
      // Bug real encontrado no teste E2E (15/09/2026): esta chamada não
      // tinha try/catch nenhum - qualquer falha (403 de MFA, 500, rede)
      // virava uma promise rejeitada silenciosa e a tela mostrava "nenhum
      // merchant cadastrado" como se a lista estivesse vazia de verdade,
      // escondendo o erro real do operador.
      setLoadError(err instanceof Error ? err.message : "Falha ao carregar merchants.");
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/merchants", {
        method: "POST",
        accessToken: session.access_token,
        body: { legalName, displayName },
      });
      setLegalName("");
      setDisplayName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar merchant.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session) {
    return <main style={{ padding: spacing.xl }}>Carregando...</main>;
  }

  return (
    <>
      <Nav />
      <main style={{ padding: spacing.xl, maxWidth: 900, margin: "0 auto" }}>
        <PageHeader title="Merchants" subtitle="FR-010 — cadastro e gestão de comerciantes parceiros." />

        {loadError && <Banner tone="error">{loadError}</Banner>}

        <Card style={{ marginBottom: spacing.xl }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Novo merchant</h2>
          <form onSubmit={(e) => void handleCreate(e)}>
            <Field label="Razão social" htmlFor="legalName">
              <Input id="legalName" required value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </Field>
            <Field label="Nome de exibição" htmlFor="displayName">
              <Input id="displayName" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            {error && <Banner tone="error">{error}</Banner>}
            <Button type="submit" loading={busy}>
              Criar merchant
            </Button>
          </form>
        </Card>

        <Card>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Todos os merchants</h2>
          {merchants.length === 0 ? (
            <EmptyState label="Nenhum merchant cadastrado ainda." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", color: colors.textMuted, fontSize: 12 }}>Nome</th>
                  <th style={{ textAlign: "left", color: colors.textMuted, fontSize: 12 }}>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {merchants.map((m) => (
                  <tr key={m.id}>
                    <td style={{ padding: `${spacing.sm}px 0` }}>{m.displayName}</td>
                    <td>
                      <StatusPill status={m.status} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <LinkButton href={`/backoffice/merchants/${m.id}`}>Ver</LinkButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </main>
    </>
  );
}
