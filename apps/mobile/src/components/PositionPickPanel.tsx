import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { apiRequest } from "../lib/api-client.js";
import { formatCountdown, usePolling, useServerClock } from "../lib/use-server-clock.js";
import type { PositionSelectionView } from "../types/api.js";
import { Button } from "./Button.js";
import { Card } from "./Card.js";
import { PositionGrid } from "./PositionGrid.js";
import { colors, spacing, typography } from "../theme/tokens.js";

/**
 * Position-selection phase (TASK-075, DECISION-07/08/10/11). Everyone sees the board and whose
 * turn it is; only the participant whose turn it is can choose, EXACTLY the number of positions
 * bought. After the deadline the server draws free positions for whoever did not choose.
 */
export function PositionPickPanel({
  roomId,
  participationId,
  accessToken,
  onPicked,
}: {
  roomId: string;
  participationId: string;
  accessToken: string;
  onPicked: () => void;
}): React.JSX.Element {
  const [view, setView] = useState<PositionSelectionView | undefined>(undefined);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const clock = useServerClock();

  const load = useCallback(() => {
    apiRequest<PositionSelectionView>(`/rooms/${roomId}/position-selection`, { accessToken })
      .then((next) => {
        clock.sync(next.serverTime);
        setView(next);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro ao carregar."));
  }, [roomId, accessToken, clock]);
  usePolling(load, 3000);

  const taken = useMemo(() => new Set(view?.takenPositions ?? []), [view]);
  const myTurn = view?.currentTurn?.participationId === participationId;
  const needed = view?.currentTurn?.positionCount ?? 0;

  const toggle = (position: number): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(position)) next.delete(position);
      else if (next.size < needed) next.add(position);
      return next;
    });
  };

  const confirm = async (): Promise<void> => {
    setSubmitting(true);
    setError(undefined);
    try {
      await apiRequest(`/participations/${participationId}/position-picks`, {
        method: "POST",
        accessToken,
        body: { positions: [...selected].sort((a, b) => a - b) },
      });
      setSelected(new Set());
      onPicked();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar a escolha.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!view || view.boardSize === null) {
    return <Text style={styles.note}>{error ?? "Carregando a barra..."}</Text>;
  }

  const remainingMs = view.currentTurn ? Date.parse(view.currentTurn.deadline) - clock.now() : 0;

  return (
    <View>
      <Card accentColor={myTurn ? colors.coral : colors.violet} style={styles.card}>
        <Text style={styles.title}>
          {myTurn ? "É a sua vez de escolher" : "Escolha de posições em andamento"}
        </Text>
        {view.currentTurn ? (
          <Text style={styles.line}>
            {myTurn
              ? `Escolha ${needed} ${needed === 1 ? "posição" : "posições"}. Tempo restante: ${formatCountdown(remainingMs)}`
              : `Vez de outro participante (${formatCountdown(remainingMs)}). Já escolheram ${view.picked ?? 0} de ${view.total ?? 0}.`}
          </Text>
        ) : (
          <Text style={styles.line}>Aguarde: a seleção está sendo concluída.</Text>
        )}
        {myTurn ? (
          <Text style={styles.small}>
            Se o tempo acabar, o sistema sorteia posições livres para você.
          </Text>
        ) : null}
      </Card>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PositionGrid
        size={view.boardSize}
        taken={taken}
        selected={selected}
        onToggle={toggle}
        interactive={myTurn}
      />
      {myTurn ? (
        <Button
          label={submitting ? "Enviando..." : `Confirmar ${selected.size}/${needed}`}
          loading={submitting}
          disabled={selected.size !== needed}
          onPress={() => void confirm()}
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  title: { ...typography.h3, color: colors.navy },
  line: { ...typography.body, color: colors.navy, marginTop: spacing.xs },
  small: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
  note: { ...typography.body, color: colors.textMuted },
  error: { color: colors.danger, marginBottom: spacing.sm },
  button: { marginTop: spacing.md },
});
