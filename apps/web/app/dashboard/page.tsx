"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../src/context/auth-context";
import { apiRequest } from "../../src/lib/api-client";
import type { GameRoomView, OutboxBacklog, RoomStatus } from "../../src/types/api";
import { Nav } from "../../src/components/Nav";
import { Banner, Button, Card, EmptyState, PageHeader, StatusPill } from "../../src/components/ui";
import { colors, spacing } from "../../src/theme/tokens";

const MONITORED_STATUSES: RoomStatus[] = [
  "OPEN",
  "ENTRY_LOCKED",
  "RUNNING",
  "FINAL_LOCK",
  "RESOLVING",
];

/**
 * TASK-047 Game Operational Dashboard. Read side: rooms currently in
 * each in-flight status + the outbox backlog size. Action side: the
 * exact same operator actions apps/worker runs automatically when
 * ENABLE_GAME_AUTO_ADVANCE is on (CLAUDE.md #22, default OFF) — this
 * page is how an operator does that work manually while it's off, via
 * apps/api's OperationsController, never a second implementation of
 * the same logic. Restyled to the PassaSorte design system alongside
 * the new merchants/experiences/campaigns/rooms backoffice screens —
 * logic unchanged.
 */
export default function DashboardPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [roomsByStatus, setRoomsByStatus] = useState<Record<string, GameRoomView[]>>({});
  const [backlog, setBacklog] = useState<OutboxBacklog | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const refresh = useCallback(async () => {
    if (!session) return;
    const token = session.access_token;
    const entries = await Promise.all(
      MONITORED_STATUSES.map(async (status) => {
        const rooms = await apiRequest<GameRoomView[]>(`/operations/rooms?status=${status}`, {
          accessToken: token,
        });
        return [status, rooms] as const;
      }),
    );
    setRoomsByStatus(Object.fromEntries(entries));
    setBacklog(
      await apiRequest<OutboxBacklog>("/operations/outbox-backlog", { accessToken: token }),
    );
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runAction(action: () => Promise<unknown>, label: string): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(`${label}: concluído.`);
      await refresh();
    } catch (err) {
      setMessage(`${label}: falhou — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session) {
    return <main style={{ padding: spacing.xl }}>Carregando...</main>;
  }

  const token = session.access_token;

  return (
    <>
      <Nav />
      <main style={{ padding: spacing.xl, maxWidth: 1000, margin: "0 auto" }}>
        <PageHeader title="Operações" subtitle="Fila de eventos e ciclo de vida das salas em andamento." />

        <Card style={{ marginBottom: spacing.xl }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Fila de eventos (outbox)</h2>
          <p style={{ color: colors.textMuted }}>Pendentes: {backlog?.pending ?? "—"}</p>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void runAction(
                  () =>
                    apiRequest("/operations/dispatch-outbox", { method: "POST", accessToken: token }),
                  "Despachar outbox",
                )
              }
            >
              Despachar agora
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void runAction(
                  () => apiRequest("/operations/expire-holds", { method: "POST", accessToken: token }),
                  "Expirar reservas",
                )
              }
            >
              Expirar reservas vencidas
            </Button>
          </div>
        </Card>

        {message && <Banner>{message}</Banner>}

        {MONITORED_STATUSES.map((status) => (
          <Card key={status} style={{ marginBottom: spacing.lg }}>
            <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
              <StatusPill status={status} />
            </div>
            {(roomsByStatus[status] ?? []).length === 0 ? (
              <EmptyState label="Nenhuma sala." />
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", color: colors.textMuted, fontSize: 12 }}>Sala</th>
                    <th style={{ textAlign: "left", color: colors.textMuted, fontSize: 12 }}>Capacidade</th>
                    <th style={{ textAlign: "left", color: colors.textMuted, fontSize: 12 }}>Criada em</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(roomsByStatus[status] ?? []).map((room) => (
                    <tr key={room.id}>
                      <td style={{ padding: `${spacing.xs}px 0` }}>{room.id}</td>
                      <td>{room.capacity}</td>
                      <td>{new Date(room.createdAt).toLocaleString("pt-BR")}</td>
                      <td>
                        {(status === "RUNNING" || status === "FINAL_LOCK") && (
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              void runAction(
                                () =>
                                  apiRequest(`/operations/rooms/${room.id}/advance`, {
                                    method: "POST",
                                    accessToken: token,
                                  }),
                                `Avançar sala ${room.id}`,
                              )
                            }
                          >
                            Avançar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        ))}
      </main>
    </>
  );
}
