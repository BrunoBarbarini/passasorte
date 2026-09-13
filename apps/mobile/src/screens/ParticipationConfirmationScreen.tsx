import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { apiRequest } from "../lib/api-client.js";
import type { Participation } from "../types/api.js";
import { useAuth } from "../context/auth-context.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { ScreenContainer } from "../components/ScreenContainer.js";
import { colors, spacing, typography } from "../theme/tokens.js";

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
    <ScreenContainer>
      <Text style={styles.title}>Revise sua participação</Text>
      <Card accentColor={colors.coral}>
        <Text style={styles.label}>Posições selecionadas</Text>
        <Text style={styles.line}>{positions.join(", ")}</Text>
      </Card>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        label={submitting ? "Confirmando..." : "Confirmar participação"}
        loading={submitting}
        onPress={() => void confirm()}
        style={styles.button}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.navy, marginBottom: spacing.lg },
  label: { ...typography.small, color: colors.textMuted },
  line: { ...typography.h3, color: colors.navy, marginTop: spacing.xs },
  error: { color: colors.danger, marginTop: spacing.md },
  button: { marginTop: spacing.xl },
});
