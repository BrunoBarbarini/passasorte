import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { apiRequest, generateIdempotencyKey } from "../lib/api-client.js";
import type { Benefit, ListMyBenefitsResponse } from "../types/api.js";
import { useAuth } from "../context/auth-context.js";

type Props = NativeStackScreenProps<RootStackParamList, "Benefits">;

const STATUS_LABEL: Record<Benefit["status"], string> = {
  GRANTED: "Concedido",
  AVAILABLE: "Disponível",
  REDEEMED: "Resgatado",
  EXPIRED: "Expirado",
  REVERSED: "Revertido",
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
      <View style={styles.container}>
        <Text style={styles.note}>Entre para ver seus benefícios.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.balanceLabel}>Saldo</Text>
      <Text style={styles.balance}>{data?.balanceMinorUnits ?? 0} unidades</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={data?.benefits ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>Nenhum benefício por aqui ainda.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.reason}</Text>
            <Text style={styles.cardSubtitle}>
              {item.amountMinorUnits} unidades · {STATUS_LABEL[item.status]}
            </Text>
            {item.expiresAt ? (
              <Text style={styles.cardMeta}>
                Expira em {new Date(item.expiresAt).toLocaleDateString("pt-BR")}
              </Text>
            ) : null}
            {item.status === "AVAILABLE" ? (
              <Pressable
                style={styles.button}
                disabled={redeemingId === item.id}
                onPress={() => void redeem(item)}
              >
                <Text style={styles.buttonText}>
                  {redeemingId === item.id ? "Resgatando..." : "Resgatar"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  balanceLabel: { color: "#6b7280", fontSize: 13 },
  balance: { fontSize: 28, fontWeight: "700", marginBottom: 16 },
  error: { color: "#b91c1c", marginBottom: 8 },
  note: { color: "#6b7280", textAlign: "center", marginTop: 32 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 32 },
  separator: { height: 12 },
  card: { padding: 16, borderRadius: 12, backgroundColor: "#f3f4f6" },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardSubtitle: { color: "#6b7280", marginTop: 4 },
  cardMeta: { color: "#9ca3af", marginTop: 4, fontSize: 12 },
  button: {
    marginTop: 12,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
