import React, { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { apiRequest } from "../lib/api-client.js";
import type { GameRoom, Participation } from "../types/api.js";
import { useAuth } from "../context/auth-context.js";
import { Card } from "../components/Card.js";
import { ScreenContainer } from "../components/ScreenContainer.js";
import { colors, spacing, typography } from "../theme/tokens.js";

type Props = NativeStackScreenProps<RootStackParamList, "FinalLock">;

/**
 * TASK-043 Final Lock UI (FR-039 Final Lock, FR-040 Immutable Final
 * Strategy). CLAUDE.md's Final Lock is enforced server-side by the game
 * engine's finalLock config (Phase 2) combined with automatic state
 * progression, which is Phase 5's scheduler (TASK-030/034) - not built
 * yet. This screen is informational: it shows when the final phase
 * starts and the participant's current movement usage, but does not
 * (and should not) simulate an enforcement that doesn't exist server-side.
 */
export function FinalLockScreen({ route }: Props): React.JSX.Element {
  const { participationId } = route.params;
  const { session } = useAuth();
  const [participation, setParticipation] = useState<Participation | undefined>(undefined);
  const [room, setRoom] = useState<GameRoom | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!session) return;
    apiRequest<Participation>(`/participations/${participationId}`, {
      accessToken: session.access_token,
    })
      .then((p) => {
        setParticipation(p);
        return apiRequest<GameRoom>(`/rooms/${p.roomId}`);
      })
      .then(setRoom)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro ao carregar."));
  }, [participationId, session]);

  return (
    <ScreenContainer>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {participation && room ? (
        <>
          <Text style={styles.title}>Travamento final</Text>
          <Card accentColor={colors.coral}>
            <Text style={styles.line}>
              A fase final começa no passo de sequência{" "}
              {room.gameConfig.finalLock.finalPhaseStartSequence}.
            </Text>
            <Text style={styles.line}>
              Você usou {participation.movementAllowanceUsed} de{" "}
              {participation.movementAllowanceTotal} movimentos disponíveis.
            </Text>
          </Card>
          <Text style={styles.note}>
            O travamento automático da estratégia final é uma funcionalidade da Fase 5
            (Operação Agendada do Jogo) e ainda não está implementada - por enquanto, o último
            movimento enviado na tela de jogo é o que vale.
          </Text>
        </>
      ) : (
        <Text style={styles.note}>Carregando...</Text>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h3, color: colors.navy, marginBottom: spacing.lg },
  line: { ...typography.body, color: colors.navy, marginBottom: spacing.sm },
  error: { color: colors.danger, marginBottom: spacing.sm },
  note: { ...typography.small, color: colors.textMuted, marginTop: spacing.xl },
});
