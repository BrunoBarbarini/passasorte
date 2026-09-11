import React, { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { apiRequest } from "../lib/api-client.js";
import type { Campaign, GameRoom } from "../types/api.js";

type Props = NativeStackScreenProps<RootStackParamList, "CampaignDetail">;

const ROOM_STATUS_LABEL: Record<GameRoom["status"], string> = {
  DRAFT: "Em preparação",
  OPEN: "Aberta para participação",
  ENTRY_LOCKED: "Entradas encerradas",
  RUNNING: "Em andamento",
  FINAL_LOCK: "Fase final",
  RESOLVING: "Apurando resultado",
  COMPLETED: "Encerrada",
  CANCELLED: "Cancelada",
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
    <View style={styles.container}>
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
            style={[styles.card, item.status !== "OPEN" && styles.cardDisabled]}
            disabled={item.status !== "OPEN"}
            onPress={() => navigation.navigate("PositionSelection", { roomId: item.id })}
          >
            <Text style={styles.cardTitle}>Sala {item.id.slice(0, 8)}</Text>
            <Text style={styles.cardSubtitle}>
              {ROOM_STATUS_LABEL[item.status]} · capacidade {item.capacity}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { color: "#6b7280", marginTop: 4, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  error: { color: "#b91c1c", marginBottom: 8 },
  empty: { color: "#6b7280" },
  separator: { height: 12 },
  card: { padding: 16, borderRadius: 12, backgroundColor: "#f3f4f6" },
  cardDisabled: { opacity: 0.5 },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardSubtitle: { color: "#6b7280", marginTop: 4 },
});
