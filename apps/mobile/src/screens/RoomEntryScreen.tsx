import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { apiRequest } from "../lib/api-client.js";
import type { GameRoom, Participation } from "../types/api.js";
import { useAuth } from "../context/auth-context.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { ScreenContainer } from "../components/ScreenContainer.js";
import { formatSeconds } from "../lib/use-server-clock.js";
import { colors, spacing, typography } from "../theme/tokens.js";

type Props = NativeStackScreenProps<RootStackParamList, "RoomEntry">;

/**
 * Entry into a room (DECISION-10): the participant picks a PACKAGE only. The positions are
 * chosen later, after the entries close, in order of entry (TASK-075). No price is shown:
 * participation is free until the legal gate opens (BR-034).
 */
export function RoomEntryScreen({ route, navigation }: Props): React.JSX.Element {
  const { roomId } = route.params;
  const { session } = useAuth();
  const [room, setRoom] = useState<GameRoom | undefined>(undefined);
  const [mine, setMine] = useState<Participation[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [submittingId, setSubmittingId] = useState<string | undefined>(undefined);

  useEffect(() => {
    apiRequest<GameRoom>(`/rooms/${roomId}`)
      .then(setRoom)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro ao carregar."));
  }, [roomId]);

  useEffect(() => {
    if (!session) return;
    apiRequest<Participation[]>(`/rooms/${roomId}/participations/me`, {
      accessToken: session.access_token,
    })
      .then(setMine)
      .catch(() => undefined);
  }, [roomId, session]);

  const enter = async (packageId: string): Promise<void> => {
    if (!session) return;
    setSubmittingId(packageId);
    setError(undefined);
    try {
      const participation = await apiRequest<Participation>(`/rooms/${roomId}/participations`, {
        method: "POST",
        accessToken: session.access_token,
        body: { packageId },
      });
      await apiRequest<Participation>(`/participations/${participation.id}/confirm`, {
        method: "POST",
        accessToken: session.access_token,
      });
      navigation.replace("LiveGame", { participationId: participation.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar na sala.");
    } finally {
      setSubmittingId(undefined);
    }
  };

  const existing = mine[0];

  return (
    <ScreenContainer>
      <ScrollView>
        <Text style={styles.title}>Entrar na sala</Text>
        <Text style={styles.note}>
          Escolha seu pacote. As posições na barra são escolhidas depois que as entradas fecharem,
          por ordem de entrada: quem entra primeiro escolhe primeiro.
        </Text>
        {/* DECISION-31: the absence rule is shown BEFORE the participant joins, not only in the terms. */}
        <Card accentColor={colors.amber} style={styles.card}>
          <Text style={styles.cardTitle}>Quando for a sua vez</Text>
          <Text style={styles.cardLine}>
            {room?.positionSelectionConfig
              ? `Você terá ${formatSeconds(room.positionSelectionConfig.selectionWindowSeconds)} para escolher suas posições. `
              : ""}
            Se você não estiver disponível na sua vez, suas posições serão escolhidas
            automaticamente entre as que estiverem livres. Você não perde a participação.
          </Text>
        </Card>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {existing ? (
          <Card accentColor={colors.aqua} style={styles.card}>
            <Text style={styles.cardTitle}>Você já participa desta sala</Text>
            <Button
              label="Abrir minha participação"
              onPress={() => navigation.replace("LiveGame", { participationId: existing.id })}
              style={styles.button}
            />
          </Card>
        ) : !session ? (
          <Button label="Entrar para participar" onPress={() => navigation.navigate("Auth")} />
        ) : (
          room?.participationPackages.map((pkg) => (
            <Card key={pkg.id} accentColor={colors.violet} style={styles.card}>
              <Text style={styles.cardTitle}>
                {pkg.positionCount} {pkg.positionCount === 1 ? "posição" : "posições"}
              </Text>
              <Text style={styles.cardLine}>
                {pkg.movementAllowance} {pkg.movementAllowance === 1 ? "movimento" : "movimentos"}{" "}
                para jogar
              </Text>
              <Button
                label={submittingId === pkg.id ? "Entrando..." : "Participar"}
                loading={submittingId === pkg.id}
                disabled={submittingId !== undefined}
                onPress={() => void enter(pkg.id)}
                style={styles.button}
              />
            </Card>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.navy, marginBottom: spacing.sm },
  note: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  cardTitle: { ...typography.h3, color: colors.navy },
  cardLine: { ...typography.body, color: colors.navy, marginTop: spacing.xs },
  button: { marginTop: spacing.lg },
});
