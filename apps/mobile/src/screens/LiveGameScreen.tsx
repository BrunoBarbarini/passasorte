import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { apiRequest, generateIdempotencyKey } from "../lib/api-client.js";
import type { Participation } from "../types/api.js";
import { useAuth } from "../context/auth-context.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { ScreenContainer } from "../components/ScreenContainer.js";
import { colors, spacing, typography } from "../theme/tokens.js";

type Props = NativeStackScreenProps<RootStackParamList, "LiveGame">;

/**
 * TASK-042 Live Game UI (FR-035 Movement Allowance, FR-036 LEFT/RIGHT
 * Movement, FR-037/FR-038 Movement Validation/Idempotency). What this
 * screen CANNOT show yet: a continuously advancing Sorte zone or
 * automatic round progression - that requires Phase 5's scheduler
 * (TASK-034), which does not exist yet. Today this screen only reflects
 * the participation's current stored state and lets the participant
 * spend a movement while ACTIVE.
 */
export function LiveGameScreen({ route, navigation }: Props): React.JSX.Element {
  const { participationId } = route.params;
  const { session } = useAuth();
  const [participation, setParticipation] = useState<Participation | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!session) return;
    apiRequest<Participation>(`/participations/${participationId}`, {
      accessToken: session.access_token,
    })
      .then(setParticipation)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro ao carregar."));
  }, [participationId, session]);

  useEffect(() => {
    load();
  }, [load]);

  const submitMovement = async (direction: "LEFT" | "RIGHT"): Promise<void> => {
    if (!session || !participation) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const updated = await apiRequest<{ participation: Participation }>(
        `/participations/${participationId}/movements`,
        {
          method: "POST",
          accessToken: session.access_token,
          idempotencyKey: generateIdempotencyKey(),
          body: {
            positionIndex: 0,
            direction,
            sequence: participation.movementAllowanceUsed + 1,
          },
        },
      );
      setParticipation(updated.participation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o movimento.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!participation) {
    return (
      <ScreenContainer style={styles.centered}>
        {error ? <Text style={styles.error}>{error}</Text> : <Text style={styles.note}>Carregando...</Text>}
      </ScreenContainer>
    );
  }

  const remaining = participation.movementAllowanceTotal - participation.movementAllowanceUsed;

  return (
    <ScreenContainer>
      <Text style={styles.title}>Status: {participation.status}</Text>
      <Card>
        <Text style={styles.line}>
          Posições: {participation.positions.map((p) => p.position).join(", ")}
        </Text>
        <Text style={styles.line}>
          Movimentos: {participation.movementAllowanceUsed}/{participation.movementAllowanceTotal} usados
        </Text>
      </Card>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {participation.status === "ACTIVE" ? (
        <View style={styles.row}>
          <Button
            label="← Esquerda"
            variant="secondary"
            disabled={remaining <= 0}
            loading={submitting}
            onPress={() => void submitMovement("LEFT")}
            style={styles.rowButton}
          />
          <Button
            label="Direita →"
            disabled={remaining <= 0}
            loading={submitting}
            onPress={() => void submitMovement("RIGHT")}
            style={styles.rowButton}
          />
        </View>
      ) : (
        <Text style={styles.note}>
          A sala ainda não está em rodada ativa para movimentos (isso depende do agendador da
          Fase 5, ainda não implementado).
        </Text>
      )}

      <Pressable
        style={styles.secondaryLink}
        onPress={() => navigation.navigate("FinalLock", { participationId })}
      >
        <Text style={styles.secondaryLinkText}>Ver travamento final</Text>
      </Pressable>
      <Pressable
        style={styles.secondaryLink}
        onPress={() => navigation.navigate("Result", { participationId })}
      >
        <Text style={styles.secondaryLinkText}>Ver resultado</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: { justifyContent: "center" },
  title: { ...typography.h3, color: colors.navy, marginBottom: spacing.md },
  line: { ...typography.body, color: colors.navy, marginBottom: spacing.xs },
  error: { color: colors.danger, marginVertical: spacing.md },
  note: { ...typography.body, color: colors.textMuted, marginVertical: spacing.xl },
  row: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  rowButton: { flex: 1 },
  secondaryLink: { marginTop: spacing.md, alignItems: "center" },
  secondaryLinkText: { ...typography.body, color: colors.violet, fontWeight: "700" },
});
