import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { apiRequest } from "../lib/api-client.js";
import type { Participation } from "../types/api.js";
import { useAuth } from "../context/auth-context.js";

type Props = NativeStackScreenProps<RootStackParamList, "ParticipationConfirmation">;

/**
 * TASK-041 Participation Confirmation UI (FR-027 Participation Creation,
 * FR-030 Participation Confirmation). Creates the participation against
 * the positions already held, then immediately confirms it - there is no
 * external requirement to wait on yet (payment is gated off, BR-034),
 * see CreateParticipationUseCase's doc comment.
 */
export function ParticipationConfirmationScreen({ route, navigation }: Props): React.JSX.Element {
  const { roomId, packageId, positions } = route.params;
  const { session } = useAuth();
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const confirm = async (): Promise<void> => {
    if (!session) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const participation = await apiRequest<Participation>(`/rooms/${roomId}/participations`, {
        method: "POST",
        accessToken: session.access_token,
        body: { packageId, positions },
      });
      await apiRequest<Participation>(`/participations/${participation.id}/confirm`, {
        method: "POST",
        accessToken: session.access_token,
      });
      navigation.replace("LiveGame", { participationId: participation.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível confirmar a participação.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Revise sua participação</Text>
      <Text style={styles.line}>Posições: {positions.join(", ")}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} disabled={submitting} onPress={() => void confirm()}>
        <Text style={styles.buttonText}>{submitting ? "Confirmando..." : "Confirmar participação"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 16 },
  line: { fontSize: 15, marginBottom: 8 },
  error: { color: "#b91c1c", marginVertical: 8 },
  button: { backgroundColor: "#2563eb", borderRadius: 8, padding: 14, alignItems: "center", marginTop: 16 },
  buttonText: { color: "#fff", fontWeight: "700" },
});
