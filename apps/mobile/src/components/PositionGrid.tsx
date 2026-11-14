import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens.js";

/** Board of positions 1..size: taken ones are disabled, picked ones highlighted. */
export function PositionGrid({
  size,
  taken,
  selected,
  onToggle,
  interactive,
}: {
  size: number;
  taken: ReadonlySet<number>;
  selected: ReadonlySet<number>;
  onToggle: (position: number) => void;
  interactive: boolean;
}): React.JSX.Element {
  const COLUMNS = 6;
  const rows = React.useMemo(() => {
    const numbers = Array.from({ length: size }, (_, index) => index + 1);
    const chunks: number[][] = [];
    for (let i = 0; i < numbers.length; i += COLUMNS) chunks.push(numbers.slice(i, i + COLUMNS));
    return chunks;
  }, [size]);
  // Plain views (not a FlatList) so the grid can live inside the screen's ScrollView.
  return (
    <View>
      {rows.map((row) => (
        <View key={row[0]} style={styles.row}>
          {Array.from({ length: COLUMNS }, (_, column) => row[column]).map((item, column) => {
            if (item === undefined) return <View key={`pad-${column}`} style={styles.pad} />;
            const isTaken = taken.has(item);
            const isSelected = selected.has(item);
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityLabel={`Posição ${item}${isTaken ? ", ocupada" : isSelected ? ", escolhida" : ", livre"}`}
                disabled={!interactive || isTaken}
                onPress={() => onToggle(item)}
                style={[
                  styles.cell,
                  isTaken ? styles.taken : null,
                  isSelected ? styles.selected : null,
                ]}
              >
                <Text
                  style={[
                    styles.text,
                    isTaken ? styles.textTaken : null,
                    isSelected ? styles.textSelected : null,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  pad: { flex: 1 },
  cell: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.violet,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  taken: { backgroundColor: "#E5E7EB", borderColor: "#E5E7EB" },
  selected: { backgroundColor: colors.coral, borderColor: colors.coral },
  text: { ...typography.small, fontWeight: "700", color: colors.navy },
  textTaken: { color: colors.textMuted, textDecorationLine: "line-through" },
  textSelected: { color: colors.white },
});
