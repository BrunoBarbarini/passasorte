"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../../src/context/auth-context";
import { apiRequest } from "../../../../src/lib/api-client";
import type { GameRoomFullView } from "../../../../src/types/api";
import { Nav } from "../../../../src/components/Nav";
import { Banner, Button, Card, PageHeader, StatusPill } from "../../../../src/components/ui";
import { colors, spacing } from "../../../../src/theme/tokens";

/**
 * Room detail: read-only config (gameConfig/participationPackages/
 * operationsConfig shown as raw JSON - same reasoning as the create-room
 * form, these are TBD product config, not something this screen
 * interprets) + the OPEN->ENTRY_LOCKED->RUNNING operator actions
 * RoomsController already exposes (TASK-024).
 */
export default function RoomDetailPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const { session, loading } = useAuth();
  const router = useRouter();

  const [room, setRoom] = useState<GameRoomFullView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const r = await apiRequest<GameRoomFullView>(`/backoffice/rooms/${roomId}`, {
        accessToken: session.access_token,
      });
      setRoom(r);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Falha ao carregar a sala.");
    }
  }, [session, roomId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runAction(path: string, label: string): Promise<void> {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/rooms/${roomId}/${path}`, { method: "POST", accessToken: session.access_token });
      await refresh();
    } catch (err) {
      setError(`${label}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session) {
    return <main style={{ padding: spacing.xl }}>Carregando...</main>;
  }

  if (!room) {
    return (
      <>
        <Nav />
        <main style={{ padding: spacing.xl, maxWidth: 700, margin: "0 auto" }}>
          <Banner tone="error">{loadError ?? "Carregando a sala..."}</Banner>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main style={{ padding: spacing.xl, maxWidth: 700, margin: "0 auto" }}>
        <PageHeader title={`Sala ${room.id}`} actions={<StatusPill status={room.status} />} />
        {loadError && <Banner tone="error">{loadError}</Banner>}
        {error && <Banner tone="error">{error}</Banner>}

        <Card style={{ marginBottom: spacing.lg }}>
          <p style={{ margin: 0, color: colors.textMuted }}>Campanha: {room.campaignId}</p>
          <p style={{ margin: 0, color: colors.textMuted }}>Capacidade: {room.capacity}</p>
          <p style={{ margin: 0, color: colors.textMuted }}>Hold TTL: {room.holdTtlMs}ms</p>
          <p style={{ margin: 0, color: colors.textMuted }}>Criada em: {new Date(room.createdAt).toLocaleString("pt-BR")}</p>
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Ações (TASK-024)</h2>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <Button variant="secondary" disabled={busy || room.status !== "DRAFT"} onClick={() => void runAction("open", "Abrir sala")}>
              Abrir sala
            </Button>
            <Button variant="secondary" disabled={busy || room.status !== "OPEN"} onClick={() => void runAction("lock-entries", "Travar entradas")}>
              Travar entradas
            </Button>
            <Button variant="secondary" disabled={busy || room.status !== "ENTRY_LOCKED"} onClick={() => void runAction("start", "Iniciar sala")}>
              Iniciar sala
            </Button>
          </div>
        </Card>

        <Card>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Configuração (JSON)</h2>
          <pre style={{ fontSize: 12, overflowX: "auto", backgroundColor: "#F5F0E8", padding: spacing.md, borderRadius: 8 }}>
            {JSON.stringify(
              {
                gameConfig: room.gameConfig,
                participationPackages: room.participationPackages,
                operationsConfig: room.operationsConfig,
              },
              null,
              2,
            )}
          </pre>
        </Card>
      </main>
    </>
  );
}
