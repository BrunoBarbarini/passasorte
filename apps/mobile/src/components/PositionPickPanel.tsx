import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, Vibration, View } from "react-native";
import { apiRequest } from "../lib/api-client.js";
import {
  formatCountdown,
  formatSeconds,
  usePolling,
  useServerClock,
} from "../lib/use-server-clock.js";
import type { PositionSelectionView } from "../types/api.js";
import { Button } from "./Button.js";
import { Card } from "./Card.js";
import { PositionGrid } from "./PositionGrid.js";
import { colors, spacing, typography } from "../theme/tokens.js";

/**
 * Position-selection phase (TASK-075, DECISION-07/08/10/11). Everyone sees the board and whose
 * turn it is; only the participant whose turn it is can choose, EXACTLY the number of positions
 * bought, inside a window that opens when their turn arrives (DECISION-24). The countdown follows
 * the SERVER clock and gets more evident near the end (DECISION-26: the visual marks are UX, not
 * rules). After the deadline the server chooses at random among the free positions (DECISION-27).
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

  // DECISION-25: one haptic nudge when the tightest warning mark is crossed during my turn.
  const buzzedFor = useRef<string | undefined>(undefined);
  const warnAt = view?.warningThresholdSeconds?.length
    ? Math.min(...view.warningThresholdSeconds)
    : undefined;
  const secondsLeft = view?.currentTurn
    ? Math.ceil((Date.parse(view.currentTurn.deadline) - clock.now()) / 1000)
    : undefined;
  useEffect(() => {
    if (!myTurn || warnAt === undefined || secondsLeft === undefined || !view?.currentTurn) return;
    const turnKey = view.currentTurn.opensAt;
    if (secondsLeft > 0 && secondsLeft <= warnAt && buzzedFor.current !== turnKey) {
      buzzedFor.current = turnKey;
      Vibration.vibrate(300);
    }
  }, [myTurn, warnAt, secondsLeft, view]);

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
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const windowSeconds = view.selectionWindowSeconds ?? 0;
  // 60s -> normal, 30s -> attention, 10s -> urgent when the window is long enough (never a business rule).
  const urgent = remainingSeconds <= Math.min(10, windowSeconds * 0.2);
  const attention = remainingSeconds <= Math.min(30, windowSeconds * 0.5);
  const expired = Boolean(view.currentTurn) && remainingMs <= 0;
  const accent = !myTurn
    ? colors.violet
    : urgent
      ? colors.coral
      : attention
        ? colors.amber
        : colors.aqua;

  return (
    <View>
      <Card accentColor={accent} style={styles.card}>
        <Text style={styles.title}>{myTurn ? "SUA VEZ" : "Escolha de posições em andamento"}</Text>
        {view.currentTurn ? (
          myTurn ? (
            <>
              <Text style={styles.line}>
                {`Você tem ${formatSeconds(windowSeconds)} para escolher ${needed} ${needed === 1 ? "posição" : "posições"}.`}
              </Text>
              {expired ? (
                <Text style={styles.countdown}>
                  Tempo encerrado. Estamos escolhendo suas posições automaticamente...
                </Text>
              ) : (
                <>
                  <Text style={styles.countdown} accessibilityLiveRegion="polite">
                    {formatCountdown(remainingMs)} restantes
                  </Text>
                  {urgent ? (
                    <Text style={styles.urgent}>Faltam {formatSeconds(remainingSeconds)}.</Text>
                  ) : attention ? (
                    <Text style={styles.small}>Sua vez de escolher está terminando.</Text>
                  ) : null}
                </>
              )}
            </>
          ) : (
            <Text style={styles.line}>
              {`Vez de outro participante (${formatCountdown(remainingMs)}). Já escolheram ${view.picked ?? 0} de ${view.total ?? 0}.`}
            </Text>
          )
        ) : (
          <Text style={styles.line}>Aguarde: a seleção está sendo concluída.</Text>
        )}
        {myTurn ? (
          <Text style={styles.small}>
            Se o tempo acabar, escolhemos automaticamente entre as posições livres. Você não perde a
            participação.
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
      {myTurn && !expired ? (
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
  countdown: { ...typography.h3, color: colors.navy, marginTop: spacing.sm },
  urgent: { ...typography.body, color: colors.danger, marginTop: spacing.xs },
  note: { ...typography.body, color: colors.textMuted },
  error: { color: colors.danger, marginBottom: spacing.sm },
  button: { marginTop: spacing.md },
});
