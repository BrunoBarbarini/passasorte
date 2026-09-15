"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../../src/context/auth-context";
import { apiRequest } from "../../../../src/lib/api-client";
import type { ExperienceView, MerchantLocationView, MerchantView } from "../../../../src/types/api";
import { Nav } from "../../../../src/components/Nav";
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
} from "../../../../src/components/ui";
import { colors, spacing } from "../../../../src/theme/tokens";

/**
 * Merchant detail: edit FR-010 fields + status, FR-011 locations
 * (add/list), and the merchant's FR-012 experiences (list/create) —
 * one screen because a merchant with no experience yet can't have a
 * campaign, so this is the natural next step from here.
 */
export default function MerchantDetailPage() {
  const params = useParams<{ id: string }>();
  const merchantId = params.id;
  const { session, loading } = useAuth();
  const router = useRouter();

  const [merchant, setMerchant] = useState<MerchantView | null>(null);
  const [locations, setLocations] = useState<MerchantLocationView[]>([]);
  const [experiences, setExperiences] = useState<ExperienceView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [locLabel, setLocLabel] = useState("");
  const [locAddress, setLocAddress] = useState("");
  const [locCity, setLocCity] = useState("");
  const [locState, setLocState] = useState("");
  const [locPostal, setLocPostal] = useState("");

  const [expTitle, setExpTitle] = useState("");
  const [expDescription, setExpDescription] = useState("");

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const refresh = useCallback(async () => {
    if (!session) return;
    const token = session.access_token;
    const [m, locs, exps] = await Promise.all([
      apiRequest<MerchantView>(`/backoffice/merchants/${merchantId}`, { accessToken: token }),
      apiRequest<MerchantLocationView[]>(`/merchants/${merchantId}/locations`, { accessToken: token }),
      apiRequest<ExperienceView[]>(`/backoffice/experiences?merchantId=${merchantId}`, { accessToken: token }),
    ]);
    setMerchant(m);
    setLegalName(m.legalName);
    setDisplayName(m.displayName);
    setLocations(locs);
    setExperiences(exps);
  }, [session, merchantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleUpdate(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/merchants/${merchantId}`, {
        method: "PATCH",
        accessToken: session.access_token,
        body: { legalName, displayName },
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar merchant.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(): Promise<void> {
    if (!session || !merchant) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/merchants/${merchantId}/status`, {
        method: "PATCH",
        accessToken: session.access_token,
        body: { status: merchant.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao mudar status.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddLocation(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/merchants/${merchantId}/locations`, {
        method: "POST",
        accessToken: session.access_token,
        body: {
          label: locLabel,
          addressLine1: locAddress,
          city: locCity,
          state: locState,
          postalCode: locPostal,
        },
      });
      setLocLabel("");
      setLocAddress("");
      setLocCity("");
      setLocState("");
      setLocPostal("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao adicionar localização.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateExperience(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/experiences", {
        method: "POST",
        accessToken: session.access_token,
        body: { merchantId, title: expTitle, description: expDescription },
      });
      setExpTitle("");
      setExpDescription("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar experience.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session || !merchant) {
    return <main style={{ padding: spacing.xl }}>Carregando...</main>;
  }

  return (
    <>
      <Nav />
      <main style={{ padding: spacing.xl, maxWidth: 900, margin: "0 auto" }}>
        <PageHeader
          title={merchant.displayName}
          subtitle={merchant.legalName}
          actions={
            <>
              <StatusPill status={merchant.status} />
              <Button variant="secondary" onClick={() => void toggleStatus()} disabled={busy}>
                {merchant.status === "ACTIVE" ? "Desativar" : "Ativar"}
              </Button>
            </>
          }
        />

        {error && <Banner tone="error">{error}</Banner>}

        <Card style={{ marginBottom: spacing.xl }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Dados do merchant</h2>
          <form onSubmit={(e) => void handleUpdate(e)}>
            <Field label="Razão social" htmlFor="legalName">
              <Input id="legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </Field>
            <Field label="Nome de exibição" htmlFor="displayName">
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <Button type="submit" variant="secondary" loading={busy}>
              Salvar alterações
            </Button>
          </form>
        </Card>

        <Card style={{ marginBottom: spacing.xl }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Localizações (FR-011)</h2>
          {locations.length === 0 ? (
            <EmptyState label="Nenhuma localização cadastrada." />
          ) : (
            <ul style={{ paddingLeft: spacing.lg, marginBottom: spacing.lg }}>
              {locations.map((loc) => (
                <li key={loc.id} style={{ marginBottom: spacing.xs }}>
                  <strong>{loc.label}</strong> — {loc.addressLine1}, {loc.city}/{loc.state}
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={(e) => void handleAddLocation(e)}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md }}>
              <Field label="Rótulo" htmlFor="locLabel">
                <Input id="locLabel" required value={locLabel} onChange={(e) => setLocLabel(e.target.value)} />
              </Field>
              <Field label="Endereço" htmlFor="locAddress">
                <Input id="locAddress" required value={locAddress} onChange={(e) => setLocAddress(e.target.value)} />
              </Field>
              <Field label="Cidade" htmlFor="locCity">
                <Input id="locCity" required value={locCity} onChange={(e) => setLocCity(e.target.value)} />
              </Field>
              <Field label="Estado" htmlFor="locState">
                <Input id="locState" required value={locState} onChange={(e) => setLocState(e.target.value)} />
              </Field>
              <Field label="CEP" htmlFor="locPostal">
                <Input id="locPostal" required value={locPostal} onChange={(e) => setLocPostal(e.target.value)} />
              </Field>
            </div>
            <Button type="submit" variant="secondary" loading={busy}>
              Adicionar localização
            </Button>
          </form>
        </Card>

        <Card>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Experiences (FR-012)</h2>
          {experiences.length === 0 ? (
            <EmptyState label="Nenhuma experience cadastrada ainda." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: spacing.lg }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", color: colors.textMuted, fontSize: 12 }}>Título</th>
                  <th style={{ textAlign: "left", color: colors.textMuted, fontSize: 12 }}>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {experiences.map((exp) => (
                  <tr key={exp.id}>
                    <td style={{ padding: `${spacing.sm}px 0` }}>{exp.title}</td>
                    <td>
                      <StatusPill status={exp.status} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <LinkButton href={`/backoffice/experiences/${exp.id}`}>Ver</LinkButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form onSubmit={(e) => void handleCreateExperience(e)}>
            <Field label="Título" htmlFor="expTitle">
              <Input id="expTitle" required value={expTitle} onChange={(e) => setExpTitle(e.target.value)} />
            </Field>
            <Field label="Descrição" htmlFor="expDescription">
              <Input id="expDescription" required value={expDescription} onChange={(e) => setExpDescription(e.target.value)} />
            </Field>
            <Button type="submit" variant="secondary" loading={busy}>
              Criar experience
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}
