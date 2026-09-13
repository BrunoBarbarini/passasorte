import React, { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { apiRequest } from "../lib/api-client.js";
import type { Campaign, GameRoom, RoomStatus } from "../types/api.js";
import { Card } from "../components/Card.js";
import { Pill, type PillTone } from "../components/Pill.js";
import { ScreenContainer } from "../components/ScreenContainer.js";
import { colors, spacing, typography } from "../theme/tokens.js";

type Props = NativeStackScreenProps<RootStackParamList, "CampaignDetail">;

const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  DRAFT: "Em preparação",
  OPEN: "Aberta para participação",
  ENTRY_LOCKED: "Entradas encerradas",
  RUNNING: "Em andamento",
  FINAL_LOCK: "Fase final",
  RESOLVING: "Apurando resultado",
  COMPLETED: "Encerrada",
  CANCELLED: "Cancelada",
};

// Cores puramente visuais para cada status de sala (RoomStatus já
// existe em types/api.ts) - só dá cor de marca, não muda a regra que
// decide se a sala aceita participação (isso é feito pelo backend).
const ROOM_STATUS_TONE: Record<RoomStatus, PillTone> = {
  DRAFT: "neutral",
  OPEN: "aqua",
  ENTRY_LOCKED: "amber",
  RUNNING: "violet",
  FINAL_LOCK: "coral",
  RESOLVING: "territory",
  COMPLETED: "navy",
  CANCELLED: "danger",
};

/** TASK-038 Campaign Detail: FR-007 campaign + its rooms (FR-018 Multiple Rooms). */
export function CampaignDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { campaignId } = route.params;
  const [campaign, setCampaign] = useState<Campaign | undefined>(undefined);
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    Promise.all([
      apiRequest<Campaign>(`/campaigns/${campaignId}`),
      apiRequest<GameRoom[]>(`/campaigns/${campaignId}/rooms`),
    ])
      .then(([campaignResult, roomsResult]) => {
        setCampaign(campaignResult);
        setRooms(roomsResult);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro ao carregar."));
  }, [campaignId]);

  return (
    <ScreenContainer>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {campaign ? (
        <>
          <Text style={styles.title}>{campaign.title}</Text>
          <Text style={styles.subtitle}>Fuso horário: {campaign.timezone}</Text>
        </>
      ) : null}
      <Text style={styles.sectionTitle}>Salas</Text>
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma sala publicada ainda.</Text>}
        renderItem={({ item }) => (
          <Pressable
            disabled={item.status !== "OPEN"}
            onPress={() => navigation.navigate("PositionSelection", { roomId: item.id })}
          >
            <Card disabled={item.status !== "OPEN"} accentColor={colors.violet}>
              <Text style={styles.cardTitle}>Sala {item.id.slice(0, 8)}</Text>
              <Text style={styles.cardSubtitle}>capacidade {item.capacity}</Text>
              <View style={styles.cardFooter}>
                <Pill label={ROOM_STATUS_LABEL[item.status]} tone={ROOM_STATUS_TONE[item.status]} />
              </View>
            </Card>
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.navy },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.xl },
  sectionTitle: { ...typography.h3, color: colors.navy, marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.sm },
  empty: { ...typography.body, color: colors.textMuted },
  separator: { height: spacing.md },
  cardTitle: { ...typography.h3, color: colors.navy },
  cardSubtitle: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
  cardFooter: { marginTop: spacing.md, flexDirection: "row" },
});
