import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { apiRequest } from "../lib/api-client.js";
import type { Campaign, CampaignListPage } from "../types/api.js";
import { useAuth } from "../context/auth-context.js";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

/** TASK-037 Mobile Home: FR-007 public campaign catalog, no auth required. */
export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const { session, signOut } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    setLoading(true);
    setError(undefined);
    apiRequest<CampaignListPage>("/campaigns")
      .then((page) => setCampaigns(page.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro ao carregar."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Campanhas em destaque</Text>
        {session ? (
          <View style={styles.headerLinks}>
            <Pressable onPress={() => navigation.navigate("Benefits")}>
              <Text style={styles.link}>Benefícios</Text>
            </Pressable>
            <Pressable onPress={() => void signOut()}>
              <Text style={styles.link}>Sair</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => navigation.navigate("Auth")}>
            <Text style={styles.link}>Entrar</Text>
          </Pressable>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={campaigns}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>Nenhuma campanha disponível no momento.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate("CampaignDetail", { campaignId: item.id })}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>{item.status}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLinks: { flexDirection: "row", gap: 16 },
  title: { fontSize: 20, fontWeight: "700" },
  link: { color: "#2563eb", fontWeight: "600" },
  error: { color: "#b91c1c", marginBottom: 8 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 32 },
  separator: { height: 12 },
  card: { padding: 16, borderRadius: 12, backgroundColor: "#f3f4f6" },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardSubtitle: { color: "#6b7280", marginTop: 4 },
});
