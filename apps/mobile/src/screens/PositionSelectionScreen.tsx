import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { apiRequest } from "../lib/api-client.js";
import type { GameRoom, ParticipationPackage, PositionState } from "../types/api.js";
import { useAuth } from "../context/auth-context.js";
import { Button } from "../components/Button.js";
import { ScreenContainer } from "../components/ScreenContainer.js";
import { colors, radius, spacing, typography } from "../theme/tokens.js";

type Props = NativeStackScreenProps<RootStackParamList, "PositionSelection">;

// Cores puramente visuais para os 3 status de posição já existentes
// (PositionStatus em types/api.ts): disponível = neutro, reservada
// (HELD) = âmbar (atenção/em espera), ocupada (TAKEN) = coral.
const POSITION_COLORS: Record<PositionState["status"], string> = {
  AVAILABLE: colors.white,
  HELD: colors.amber,
  TAKEN: colors.coral,
};

const POSITION_TEXT_COLORS: Record<PositionState["status"], string> = {
  AVAILABLE: colors.navy,
  HELD: colors.navy,
  TAKEN: colors.white,
};

/**
 * TASK-040 Position Selection UI (FR-022 Position Availability, FR-023
 * Position Selection, FR-024 Atomic Position Hold). A package must be
 * picked first because it fixes how many positions the participant is
 * about to select (FR-029).
 */
export function PositionSelectionScreen({ route, navigation }: Props): React.JSX.Element {
  const { roomId } = route.params;
  const { session } = useAuth();
  const [room, setRoom] = useState<GameRoom | undefined>(undefined);
  const [positions, setPositions] = useState<PositionState[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<ParticipationPackage | undefined>(undefined);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      apiRequest<GameRoom>(`/rooms/${roomId}`),
      apiRequest<PositionState[]>(`/rooms/${roomId}/positions`),
    ])
      .then(([roomResult, positionsResult]) => {
        setRoom(roomResult);
        setPositions(positionsResult);
        setSelectedPackage((current) => current ?? roomResult.participationPackages[0]);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro ao carregar."));
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load]);

  const requiredCount = selectedPackage?.positionCount ?? 1;

  const togglePosition = (position: number, status: PositionState["status"]): void => {
    if (status !== "AVAILABLE") return;
    setSelected((current) => {
      if (current.includes(position)) {
        return current.filter((p) => p !== position);
      }
      if (current.length >= requiredCount) {
        return current;
      }
      return [...current, position];
    });
  };

  const canSubmit = useMemo(
    () => selected.length === requiredCount && !!selectedPackage && !!session,
    [selected, requiredCount, selectedPackage, session],
  );

  const holdAndContinue = async (): Promise<void> => {
    if (!session || !selectedPackage) return;
    setSubmitting(true);
    setError(undefined);
    try {
      await apiRequest(`/rooms/${roomId}/holds`, {
        method: "POST",
        accessToken: session.access_token,
        body: { positions: selected },
      });
      navigation.navigate("ParticipationConfirmation", {
        roomId,
        packageId: selectedPackage.id,
        positions: selected,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível reservar as posições.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer noPadding>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!session ? (
          <Pressable style={styles.banner} onPress={() => navigation.navigate("Auth")}>
            <Text style={styles.bannerText}>Entre na sua conta para reservar posições.</Text>
          </Pressable>
        ) : null}

        {room ? (
          <>
            <Text style={styles.sectionTitle}>Pacote de participação</Text>
            <View style={styles.packageRow}>
              {room.participationPackages.map((pkg) => (
                <Pressable
                  key={pkg.id}
                  style={[
                    styles.packageChip,
                    selectedPackage?.id === pkg.id && styles.packageChipSelected,
                  ]}
                  onPress={() => {
                    setSelectedPackage(pkg);
                    setSelected([]);
                  }}
                >
                  <Text
                    style={[
                      styles.packageChipText,
                      selectedPackage?.id === pkg.id && styles.packageChipTextSelected,
                    ]}
                  >
                    {pkg.positionCount} posição(ões) · {pkg.movementAllowance} movimento(s)
                    {pkg.priceMinorUnits !== undefined
                      ? ` · R$ ${(pkg.priceMinorUnits / 100).toFixed(2)}`
                      : " · grátis"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>
              Posições ({selected.length}/{requiredCount} selecionadas)
            </Text>
            <View style={styles.grid}>
              {positions.map((p) => (
                <Pressable
                  key={p.position}
                  onPress={() => togglePosition(p.position, p.status)}
                  style={[
                    styles.cell,
                    { backgroundColor: POSITION_COLORS[p.status] },
                    selected.includes(p.position) && styles.cellSelected,
                  ]}
                >
                  <Text style={[styles.cellText, { color: POSITION_TEXT_COLORS[p.status] }]}>
                    {p.position}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Button
              label={submitting ? "Reservando..." : "Reservar posições"}
              loading={submitting}
              disabled={!canSubmit}
              onPress={() => void holdAndContinue()}
              style={styles.submitButton}
            />
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg },
  sectionTitle: { ...typography.h3, color: colors.navy, marginTop: spacing.xl, marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.sm },
  banner: {
    backgroundColor: "#FCE7D6",
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  bannerText: { ...typography.body, color: colors.navy },
  packageRow: { gap: spacing.sm },
  packageChip: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: "transparent",
  },
  packageChipSelected: { borderColor: colors.violet },
  packageChipText: { ...typography.body, fontWeight: "600", color: colors.navy },
  packageChipTextSelected: { color: colors.violet },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  cell: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  cellSelected: { borderWidth: 3, borderColor: colors.violet },
  cellText: { fontWeight: "700" },
  submitButton: { marginTop: spacing.xl },
});
