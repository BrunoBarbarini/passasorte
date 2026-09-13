import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { apiRequest } from "../lib/api-client.js";
import type { Campaign, CampaignListPage, CampaignStatus } from "../types/api.js";
import { useAuth } from "../context/auth-context.js";
import { Card } from "../components/Card.js";
import { Pill, type PillTone } from "../components/Pill.js";
import { ScreenContainer } from "../components/ScreenContainer.js";
import { colors, spacing, typography } from "../theme/tokens.js";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

// Cores puramente visuais para cada status de campanha que a API já
// retorna (types/api.ts) - nenhum status novo é criado aqui.
const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, PillTone> = {
  DRAFT: "neutral",
  IN_REVIEW: "amber",
  APPROVED: "violet",
  SCHEDULED: "territory",
  PUBLISHED: "aqua",
  ENDED: "navy",
  CANCELLED: "danger",
};

const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: "Rascunho",
  IN_REVIEW: "Em revisão",
  APPROVED: "Aprovada",
  SCHEDULED: "Agendada",
  PUBLISHED: "Publicada",
  ENDED: "Encerrada",
  CANCELLED: "Cancelada",
};

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
    <ScreenContainer noPadding>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>
            Passa<Text style={styles.brandAccent}>Sorte</Text>
          </Text>
          <Text style={styles.title}>Campanhas em destaque</Text>
        </View>
        {session ? (
          <View style={styles.headerLinks}>
            <Pressable onPress={() => navigation.navigate("Benefits")}>
              <Text style={styles.link}>Benefícios</Text>
            </Pressable>
            <Pressable onPress={() => void signOut()}>
              <Text style={styles.linkMuted}>Sair</Text>
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
        style={styles.list}
        contentContainerStyle={styles.listContent}
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
          <Pressable onPress={() => navigation.navigate("CampaignDetail", { campaignId: item.id })}>
            <Card accentColor={colors.coral}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <View style={styles.cardFooter}>
                <Pill label={CAMPAIGN_STATUS_LABEL[item.status]} tone={CAMPAIGN_STATUS_TONE[item.status]} />
              </View>
            </Card>
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  brand: { ...typography.h3, color: colors.navy },
  brandAccent: { color: colors.coral },
  title: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
  headerLinks: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.xs },
  link: { ...typography.body, color: colors.violet, fontWeight: "700" },
  linkMuted: { ...typography.body, color: colors.textMuted, fontWeight: "600" },
  error: { color: colors.danger, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  list: { flex: 1 },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
  empty: { ...typography.body, color: colors.textMuted, textAlign: "center", marginTop: spacing.xxl },
  separator: { height: spacing.md },
  cardTitle: { ...typography.h3, color: colors.navy },
  cardFooter: { marginTop: spacing.md, flexDirection: "row" },
});
