import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { apiRequest } from "../lib/api-client.js";
import type { GameRoom, ParticipationPackage, PositionState } from "../types/api.js";
import { useAuth } from "../context/auth-context.js";

type Props = NativeStackScreenProps<RootStackParamList, "PositionSelection">;

const POSITION_COLORS: Record<PositionState["status"], string> = {
  AVAILABLE: "#e5e7eb",
  HELD: "#fde68a",
  TAKEN: "#fca5a5",
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
                <Text style={styles.packageChipText}>
                  {pkg.positionCount} posição(ões) · {pkg.movementAllowance} movimento(s)
                  {pkg.priceMinorUnits !== undefined ? ` · R$ ${(pkg.priceMinorUnits / 100).toFixed(2)}` : " · grátis"}
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
                <Text style={styles.cellText}>{p.position}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            disabled={!canSubmit || submitting}
            onPress={() => void holdAndContinue()}
          >
            <Text style={styles.buttonText}>
              {submitting ? "Reservando..." : "Reservar posições"}
            </Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  error: { color: "#b91c1c", marginBottom: 8 },
  banner: { backgroundColor: "#fef3c7", padding: 12, borderRadius: 8, marginBottom: 12 },
  bannerText: { color: "#92400e" },
  packageRow: { gap: 8 },
  packageChip: { padding: 12, borderRadius: 8, backgroundColor: "#f3f4f6", marginBottom: 8 },
  packageChipSelected: { backgroundColor: "#dbeafe" },
  packageChipText: { fontWeight: "500" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cellSelected: { borderWidth: 3, borderColor: "#2563eb" },
  cellText: { fontWeight: "600" },
  button: { backgroundColor: "#2563eb", borderRadius: 8, padding: 14, alignItems: "center", marginTop: 24 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontWeight: "700" },
});
