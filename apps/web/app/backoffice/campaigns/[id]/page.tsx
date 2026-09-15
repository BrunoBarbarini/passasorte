"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../../src/context/auth-context";
import { apiRequest } from "../../../../src/lib/api-client";
import { CAMPAIGN_STATUSES, type CampaignStatus, type CampaignView, type GameRoomView } from "../../../../src/types/api";
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
  Select,
  StatusPill,
  Textarea,
} from "../../../../src/components/ui";
import { colors, spacing } from "../../../../src/theme/tokens";

const GAME_CONFIG_PLACEHOLDER = `{
  "engineVersion": "...",
  "board": { "size": 0 },
  "initialSorteZone": { "start": 0, "end": 0 },
  "temperatureBands": [{ "name": "...", "maxNormalizedDistance": 0 }],
  "movementAllowancePerParticipation": 0,
  "finalLock": { "finalPhaseStartSequence": 0 }
}`;
const PACKAGES_PLACEHOLDER = `[{
  "id": "...",
  "positionCount": 0,
  "movementAllowance": 0,
  "eligibilityRuleIds": [],
  "priceMinorUnits": 0
}]`;
const OPS_CONFIG_PLACEHOLDER = `{ "finalLockGracePeriodMs": 0 }`;

/**
 * FR-013..FR-017 campaign detail: edit DRAFT fields, run state
 * transitions (CLAUDE.md's own state machine, no shortcuts invented
 * here), and manage the campaign's rooms. Room creation asks for
 * gameConfig/participationPackages/operationsConfig as raw JSON rather
 * than a rich form on purpose - board size, Sorte zone, temperature
 * bands and movement allowance are explicitly TBD/caller-decided per
 * CLAUDE.md #56/#58 (see contexto-passasorte.md), so this screen must
 * not pre-fill or guess real values - the operator supplies them.
 */
export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;
  const { session, loading } = useAuth();
  const router = useRouter();

  const [campaign, setCampaign] = useState<CampaignView | null>(null);
  const [rooms, setRooms] = useState<GameRoomView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [timezone, setTimezone] = useState("");

  const [targetStatus, setTargetStatus] = useState<CampaignStatus>("IN_REVIEW");
  const [cancellationReason, setCancellationReason] = useState("");

  const [capacity, setCapacity] = useState("");
  const [holdTtlMs, setHoldTtlMs] = useState("");
  const [gameConfigJson, setGameConfigJson] = useState("");
  const [packagesJson, setPackagesJson] = useState("");
  const [opsConfigJson, setOpsConfigJson] = useState("");

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const refresh = useCallback(async () => {
    if (!session) return;
    const token = session.access_token;
    try {
      const [c, rs] = await Promise.all([
        apiRequest<CampaignView>(`/backoffice/campaigns/${campaignId}`, { accessToken: token }),
        apiRequest<GameRoomView[]>(`/backoffice/campaigns/${campaignId}/rooms`, { accessToken: token }),
      ]);
      setCampaign(c);
      setTitle(c.title);
      setTimezone(c.timezone ?? "");
      setRooms(rs);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Falha ao carregar a campanha.");
    }
  }, [session, campaignId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleUpdateDraft(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/campaigns/${campaignId}`, {
        method: "PATCH",
        accessToken: session.access_token,
        body: { title, timezone: timezone || undefined },
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar rascunho.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTransition(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/campaigns/${campaignId}/transitions`, {
        method: "POST",
        accessToken: session.access_token,
        body: {
          status: targetStatus,
          cancellationReason: targetStatus === "CANCELLED" ? cancellationReason || undefined : undefined,
        },
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao transicionar campanha.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateRoom(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      // Explicitly typed `unknown` (not the `any` JSON.parse returns) -
      // this app's eslint config (@typescript-eslint/no-unsafe-assignment)
      // forbids assigning `any` even to a local, and `unknown` is honest
      // here anyway: this screen doesn't validate the shape, the API's
      // own CreateRoomSchema (Zod) does that server-side.
      const gameConfig: unknown = JSON.parse(gameConfigJson);
      const participationPackages: unknown = JSON.parse(packagesJson);
      const operationsConfig: unknown = JSON.parse(opsConfigJson);
      await apiRequest(`/campaigns/${campaignId}/rooms`, {
        method: "POST",
        accessToken: session.access_token,
        body: {
          capacity: Number(capacity),
          holdTtlMs: Number(holdTtlMs),
          gameConfig,
          participationPackages,
          operationsConfig,
        },
      });
      setCapacity("");
      setHoldTtlMs("");
      setGameConfigJson("");
      setPackagesJson("");
      setOpsConfigJson("");
      await refresh();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("JSON inválido em um dos campos de configuração da sala.");
      } else {
        setError(err instanceof Error ? err.message : "Falha ao criar sala.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session) {
    return <main style={{ padding: spacing.xl }}>Carregando...</main>;
  }

  if (!campaign) {
    return (
      <>
        <Nav />
        <main style={{ padding: spacing.xl, maxWidth: 900, margin: "0 auto" }}>
          <Banner tone="error">{loadError ?? "Carregando a campanha..."}</Banner>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main style={{ padding: spacing.xl, maxWidth: 900, margin: "0 auto" }}>
        <PageHeader title={campaign.title} actions={<StatusPill status={campaign.status} />} />
        {loadError && <Banner tone="error">{loadError}</Banner>}
        {error && <Banner tone="error">{error}</Banner>}

        {campaign.status === "DRAFT" && (
          <Card style={{ marginBottom: spacing.xl }}>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Rascunho (FR-014)</h2>
            <form onSubmit={(e) => void handleUpdateDraft(e)}>
              <Field label="Título" htmlFor="title">
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field label="Timezone (IANA, opcional)" htmlFor="timezone">
                <Input id="timezone" placeholder="America/Sao_Paulo" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </Field>
              <Button type="submit" variant="secondary" loading={busy}>
                Salvar rascunho
              </Button>
            </form>
          </Card>
        )}

        <Card style={{ marginBottom: spacing.xl }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Transição de estado (FR-015/FR-016/FR-017)</h2>
          <form onSubmit={(e) => void handleTransition(e)}>
            <Field label="Novo status" htmlFor="targetStatus">
              <Select id="targetStatus" value={targetStatus} onChange={(e) => setTargetStatus(e.target.value as CampaignStatus)}>
                {CAMPAIGN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            {targetStatus === "CANCELLED" && (
              <Field label="Motivo do cancelamento" htmlFor="cancellationReason">
                <Input id="cancellationReason" value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)} />
              </Field>
            )}
            <Button type="submit" variant="secondary" loading={busy}>
              Aplicar transição
            </Button>
          </form>
        </Card>

        <Card style={{ marginBottom: spacing.xl }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Salas</h2>
          {rooms.length === 0 ? (
            <EmptyState label="Nenhuma sala criada para esta campanha ainda." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: spacing.lg }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", color: colors.textMuted, fontSize: 12 }}>Sala</th>
                  <th style={{ textAlign: "left", color: colors.textMuted, fontSize: 12 }}>Capacidade</th>
                  <th style={{ textAlign: "left", color: colors.textMuted, fontSize: 12 }}>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id}>
                    <td style={{ padding: `${spacing.sm}px 0` }}>{room.id}</td>
                    <td>{room.capacity}</td>
                    <td>
                      <StatusPill status={room.status} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <LinkButton href={`/backoffice/rooms/${room.id}`}>Ver</LinkButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 style={{ fontSize: 14 }}>Nova sala</h3>
          <p style={{ color: colors.textMuted, fontSize: 13 }}>
            Tamanho do tabuleiro, zona da Sorte, bandas de temperatura, pacotes de participação etc. ainda são TBD de
            produto (CLAUDE.md #56/#58) — preencha com a configuração real desta sala, nada aqui vem pré-preenchido.
          </p>
          <form onSubmit={(e) => void handleCreateRoom(e)}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md }}>
              <Field label="Capacidade" htmlFor="capacity">
                <Input id="capacity" type="number" required value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </Field>
              <Field label="Hold TTL (ms)" htmlFor="holdTtlMs">
                <Input id="holdTtlMs" type="number" required value={holdTtlMs} onChange={(e) => setHoldTtlMs(e.target.value)} />
              </Field>
            </div>
            <Field label="gameConfig (JSON)" htmlFor="gameConfigJson">
              <Textarea
                id="gameConfigJson"
                required
                placeholder={GAME_CONFIG_PLACEHOLDER}
                value={gameConfigJson}
                onChange={(e) => setGameConfigJson(e.target.value)}
              />
            </Field>
            <Field label="participationPackages (JSON)" htmlFor="packagesJson">
              <Textarea
                id="packagesJson"
                required
                placeholder={PACKAGES_PLACEHOLDER}
                value={packagesJson}
                onChange={(e) => setPackagesJson(e.target.value)}
              />
            </Field>
            <Field label="operationsConfig (JSON)" htmlFor="opsConfigJson">
              <Textarea
                id="opsConfigJson"
                required
                placeholder={OPS_CONFIG_PLACEHOLDER}
                value={opsConfigJson}
                onChange={(e) => setOpsConfigJson(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="secondary" loading={busy}>
              Criar sala
            </Button>
          </form>
        </Card>

        <LinkButton href={`/backoffice/merchants/${campaign.merchantId}`}>← Voltar ao merchant</LinkButton>
      </main>
    </>
  );
}
