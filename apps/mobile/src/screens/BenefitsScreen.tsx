import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { apiRequest, generateIdempotencyKey } from "../lib/api-client.js";
import type { Benefit, BenefitStatus, ListMyBenefitsResponse } from "../types/api.js";
import { useAuth } from "../context/auth-context.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { Pill, type PillTone } from "../components/Pill.js";
import { ScreenContainer } from "../components/ScreenContainer.js";
import { colors, spacing, typography } from "../theme/tokens.js";

type Props = NativeStackScreenProps<RootStackParamList, "Benefits">;

const STATUS_LABEL: Record<Benefit["status"], string> = {
  GRANTED: "Concedido",
  AVAILABLE: "Disponível",
  REDEEMED: "Resgatado",
  EXPIRED: "Expirado",
  REVERSED: "Revertido",
};

// Cores puramente visuais para cada status de benefício que a API já
// retorna (BenefitStatus em types/api.ts).
const STATUS_TONE: Record<BenefitStatus, PillTone> = {
  GRANTED: "violet",
  AVAILABLE: "aqua",
  REDEEMED: "navy",
  EXPIRED: "neutral",
  REVERSED: "danger",
};

/**
 * FR-055 Benefit Ledger + FR-057 Benefit Redemption. No task in the
 * CLAUDE.md backlog (TASK-057/058 are backend-only) names a mobile
 * screen for this, so this is a minimal view: balance, the ledger-
 * derived list of benefits, and a "Resgatar" action on whatever is
 * AVAILABLE - it never assumes a currency for `amountMinorUnits` (see
 * types/api.ts) and it never invents what earned a benefit (that's an
 * OPERATOR/ADMIN/FINANCE backoffice action, not something a participant
 * triggers). Redemption itself may be refused by the server with a
 * pt-BR message when ENABLE_BENEFIT_REDEMPTION is off (CLAUDE.md #1.9
 * LEGAL GATE) - this screen just surfaces that message, it doesn't hide
 * the button.
 */
export function BenefitsScreen(_props: Props): React.JSX.Element {
  const { session } = useAuth();
  const [data, setData] = useState<ListMyBenefitsResponse | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [redeemingId, setRedeemingId] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    if (!session) return;
    setLoading(true);
    setError(undefined);
    apiRequest<ListMyBenefitsResponse>("/me/benefits", { accessToken: session.access_token })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro ao carregar."))
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const redeem = async (benefit: Benefit): Promise<void> => {
    if (!session) return;
    setRedeemingId(benefit.id);
    setError(undefined);
    try {
      await apiRequest<unknown>("/benefit-redemptions", {
        method: "POST",
        accessToken: session.access_token,
        idempotencyKey: generateIdempotencyKey(),
        body: { benefitId: benefit.id },
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível resgatar este benefício.");
    } finally {
      setRedeemingId(undefined);
    }
  };

  if (!session) {
    return (
      <ScreenContainer style={styles.centered}>
        <Text style={styles.note}>Entre para ver seus benefícios.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer noPadding>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Saldo</Text>
        <Text style={styles.balance}>{data?.balanceMinorUnits ?? 0} unidades</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={data?.benefits ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>Nenhum benefício por aqui ainda.</Text> : null
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.cardTitle}>{item.reason}</Text>
            <Text style={styles.cardSubtitle}>{item.amountMinorUnits} unidades</Text>
            <View style={styles.cardFooter}>
              <Pill label={STATUS_LABEL[item.status]} tone={STATUS_TONE[item.status]} />
              {item.expiresAt ? (
                <Text style={styles.cardMeta}>
                  Expira em {new Date(item.expiresAt).toLocaleDateString("pt-BR")}
                </Text>
              ) : null}
            </View>
            {item.status === "AVAILABLE" ? (
              <Button
                label={redeemingId === item.id ? "Resgatando..." : "Resgatar"}
                loading={redeemingId === item.id}
                onPress={() => void redeem(item)}
                style={styles.redeemButton}
              />
            ) : null}
          </Card>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: { justifyContent: "center", alignItems: "center" },
  balanceCard: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  balanceLabel: { ...typography.small, color: colors.textMuted },
  balance: { ...typography.h1, color: colors.navy, marginTop: spacing.xs },
  error: { color: colors.danger, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  note: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  list: { flex: 1 },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
  empty: { ...typography.body, color: colors.textMuted, textAlign: "center", marginTop: spacing.xxl },
  separator: { height: spacing.md },
  cardTitle: { ...typography.h3, color: colors.navy },
  cardSubtitle: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
  cardFooter: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cardMeta: { ...typography.small, color: colors.textMuted },
  redeemButton: { marginTop: spacing.md },
});
