import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { apiRequest } from "../lib/api-client.js";
import type { Participation } from "../types/api.js";
import { useAuth } from "../context/auth-context.js";

type Props = NativeStackScreenProps<RootStackParamList, "Result">;

const RESOLVED_STATUSES = new Set(["WON", "NOT_WON", "COMPLETED"]);

const STATUS_MESSAGE: Record<string, string> = {
  WON: "🎉 Você ganhou!",
  NOT_WON: "Não foi dessa vez.",
  COMPLETED: "Participação encerrada.",
};

/**
 * TASK-044 Result UI (FR-042 Server-Side Result Resolution, FR-043
 * Immutable Winner Persistence). The actual result/winner engine
 * (TASK-031/032, Game Result Engine + Winner Model) is Phase 5 scope and
 * doesn't exist yet, so this screen can only ever show whatever status
 * the participation is already in - it never computes or guesses a
 * result on the client.
 */
export function ResultScreen({ route }: Props): React.JSX.Element {
  const { participationId } = route.params;
  const { session } = useAuth();
  const [participation, setParticipation] = useState<Participation | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!session) return;
    apiRequest<Participation>(`/participations/${participationId}`, {
      accessToken: session.access_token,
    })
      .then(setParticipation)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro ao carregar."));
  }, [participationId, session]);

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {participation ? (
        RESOLVED_STATUSES.has(participation.status) ? (
          <Text style={styles.result}>
            {STATUS_MESSAGE[participation.status] ?? participation.status}
          </Text>
        ) : (
          <Text style={styles.note}>
            Resultado ainda não disponível (status atual: {participation.status}). A resolução
            automática do resultado é uma funcionalidade da Fase 5 (Game Result Engine / Winner
            Model) e ainda não está implementada.
          </Text>
        )
      ) : (
        <Text>Carregando...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16, justifyContent: "center" },
  result: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  note: { color: "#6b7280", textAlign: "center" },
  error: { color: "#b91c1c", marginBottom: 8 },
});
