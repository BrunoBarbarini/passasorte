"use client";

import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../src/context/auth-context";
import { apiRequest } from "../../../src/lib/api-client";
import type { CampaignListPageView, CampaignView, ExperienceView, MerchantView } from "../../../src/types/api";
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
  Select,
  StatusPill,
} from "../../../src/components/ui";
import { colors, spacing } from "../../../src/theme/tokens";

/** FR-013/FR-014 Campaign Creation + Configuration — list (any status, via /backoffice/campaigns) + create. */
export default function CampaignsPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Carregando...</main>}>
      <CampaignsPageInner />
    </Suspense>
  );
}

/** useSearchParams (to prefill merchantId/experienceId from the experience detail page link) requires a Suspense boundary in the app router - see the wrapper above. */
function CampaignsPageInner() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [merchants, setMerchants] = useState<MerchantView[]>([]);
  const [experiences, setExperiences] = useState<ExperienceView[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [merchantId, setMerchantId] = useState(searchParams.get("merchantId") ?? "");
  const [experienceId, setExperienceId] = useState(searchParams.get("experienceId") ?? "");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const refresh = useCallback(async () => {
    if (!session) return;
    const token = session.access_token;
    try {
      const [ms, page] = await Promise.all([
        apiRequest<MerchantView[]>("/backoffice/merchants", { accessToken: token }),
        apiRequest<CampaignListPageView>(
          `/backoffice/campaigns${merchantId ? `?merchantId=${merchantId}` : ""}`,
          { accessToken: token },
        ),
      ]);
      setMerchants(ms);
      setCampaigns(page.items);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Falha ao carregar campanhas.");
    }
  }, [session, merchantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!session || !merchantId) {
      setExperiences([]);
      return;
    }
    apiRequest<ExperienceView[]>(`/backoffice/experiences?merchantId=${merchantId}`, {
      accessToken: session.access_token,
    })
      .then(setExperiences)
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Falha ao carregar experiences do merchant.");
      });
  }, [session, merchantId]);

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/campaigns", {
        method: "POST",
        accessToken: session.access_token,
        body: { merchantId, experienceId, title },
      });
      setTitle("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar campanha.");
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
        <PageHeader title="Campanhas" subtitle="FR-013..FR-017 — criação, aprovação, publicação e cancelamento." />

        {loadError && <Banner tone="error">{loadError}</Banner>}

        <Card style={{ marginBottom: spacing.xl }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Nova campanha (rascunho)</h2>
          <form onSubmit={(e) => void handleCreate(e)}>
            <Field label="Merchant" htmlFor="merchantId">
              <Select
                id="merchantId"
                required
                value={merchantId}
                onChange={(e) => {
                  setMerchantId(e.target.value);
                  setExperienceId("");
                }}
              >
                <option value="">Selecione...</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Experience" htmlFor="experienceId">
              <Select id="experienceId" required value={experienceId} onChange={(e) => setExperienceId(e.target.value)} disabled={!merchantId}>
                <option value="">{merchantId ? "Selecione..." : "Escolha um merchant primeiro"}</option>
                {experiences.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Título da campanha" htmlFor="title">
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            {error && <Banner tone="error">{error}</Banner>}
            <Button type="submit" loading={busy}>
              Criar campanha
            </Button>
          </form>
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Campanhas</h2>
            <Select value={merchantId} onChange={(e) => setMerchantId(e.target.value)} style={{ width: 220 }}>
              <option value="">Todos os merchants</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </Select>
          </div>
          {campaigns.length === 0 ? (
            <EmptyState label="Nenhuma campanha ainda." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", color: colors.textMuted, fontSize: 12 }}>Título</th>
                  <th style={{ textAlign: "left", color: colors.textMuted, fontSize: 12 }}>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td style={{ padding: `${spacing.sm}px 0` }}>{c.title}</td>
                    <td>
                      <StatusPill status={c.status} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <LinkButton href={`/backoffice/campaigns/${c.id}`}>Ver</LinkButton>
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
