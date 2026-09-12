"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../src/context/auth-context";
import { apiRequest } from "../../src/lib/api-client";
import type { GameRoomView, OutboxBacklog, RoomStatus } from "../../src/types/api";

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
 * the same logic.
 */
export default function DashboardPage() {
  const { session, loading, signOut } = useAuth();
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
    return <main style={{ padding: 24 }}>Carregando...</main>;
  }

  const token = session.access_token;

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Operações — PassaSorte</h1>
        <button onClick={() => void signOut()}>Sair</button>
      </div>

      <section style={{ marginBottom: 24 }}>
        <h2>Fila de eventos (outbox)</h2>
        <p>Pendentes: {backlog?.pending ?? "—"}</p>
        <button
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
        </button>{" "}
        <button
          disabled={busy}
          onClick={() =>
            void runAction(
              () => apiRequest("/operations/expire-holds", { method: "POST", accessToken: token }),
              "Expirar reservas",
            )
          }
        >
          Expirar reservas vencidas
        </button>
      </section>

      {message && <p>{message}</p>}

      {MONITORED_STATUSES.map((status) => (
        <section key={status} style={{ marginBottom: 24 }}>
          <h2>{status}</h2>
          {(roomsByStatus[status] ?? []).length === 0 ? (
            <p style={{ color: "#666" }}>Nenhuma sala.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Sala</th>
                  <th style={{ textAlign: "left" }}>Capacidade</th>
                  <th style={{ textAlign: "left" }}>Criada em</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(roomsByStatus[status] ?? []).map((room) => (
                  <tr key={room.id}>
                    <td>{room.id}</td>
                    <td>{room.capacity}</td>
                    <td>{new Date(room.createdAt).toLocaleString("pt-BR")}</td>
                    <td>
                      {(status === "RUNNING" || status === "FINAL_LOCK") && (
                        <button
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
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </main>
  );
}
