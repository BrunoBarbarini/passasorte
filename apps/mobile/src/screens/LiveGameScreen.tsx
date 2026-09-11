import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { apiRequest, generateIdempotencyKey } from "../lib/api-client.js";
import type { Participation } from "../types/api.js";
import { useAuth } from "../context/auth-context.js";

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
      <View style={styles.container}>
        {error ? <Text style={styles.error}>{error}</Text> : <Text>Carregando...</Text>}
      </View>
    );
  }

  const remaining = participation.movementAllowanceTotal - participation.movementAllowanceUsed;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Status: {participation.status}</Text>
      <Text style={styles.line}>
        Posições: {participation.positions.map((p) => p.position).join(", ")}
      </Text>
      <Text style={styles.line}>
        Movimentos: {participation.movementAllowanceUsed}/{participation.movementAllowanceTotal} usados
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {participation.status === "ACTIVE" ? (
        <View style={styles.row}>
          <Pressable
            style={[styles.button, remaining <= 0 && styles.buttonDisabled]}
            disabled={submitting || remaining <= 0}
            onPress={() => void submitMovement("LEFT")}
          >
            <Text style={styles.buttonText}>← Esquerda</Text>
          </Pressable>
          <Pressable
            style={[styles.button, remaining <= 0 && styles.buttonDisabled]}
            disabled={submitting || remaining <= 0}
            onPress={() => void submitMovement("RIGHT")}
          >
            <Text style={styles.buttonText}>Direita →</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.note}>
          A sala ainda não está em rodada ativa para movimentos (isso depende do agendador da
          Fase 5, ainda não implementado).
        </Text>
      )}

      <Pressable
        style={styles.secondaryButton}
        onPress={() => navigation.navigate("FinalLock", { participationId })}
      >
        <Text style={styles.secondaryButtonText}>Ver travamento final</Text>
      </Pressable>
      <Pressable
        style={styles.secondaryButton}
        onPress={() => navigation.navigate("Result", { participationId })}
      >
        <Text style={styles.secondaryButtonText}>Ver resultado</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  line: { fontSize: 15, marginBottom: 4 },
  error: { color: "#b91c1c", marginVertical: 8 },
  note: { color: "#6b7280", marginVertical: 16 },
  row: { flexDirection: "row", gap: 12, marginTop: 16 },
  button: { flex: 1, backgroundColor: "#2563eb", borderRadius: 8, padding: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontWeight: "700" },
  secondaryButton: { marginTop: 12, alignItems: "center" },
  secondaryButtonText: { color: "#2563eb", fontWeight: "600" },
});
