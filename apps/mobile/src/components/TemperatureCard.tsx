import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TemperatureLevel } from "../types/api.js";
import { colors, radius, spacing, temperatureColors, typography } from "../theme/tokens.js";

const HINT: Record<TemperatureLevel, string> = {
  MUITO_QUENTE: "A Sorte está muito perto de uma das suas posições.",
  QUENTE: "A Sorte está perto das suas posições.",
  MORNO: "A Sorte está a uma distância média das suas posições.",
  FRIO: "A Sorte está longe das suas posições.",
  CONGELANDO: "A Sorte está o mais longe possível das suas posições.",
};

/**
 * Personal temperature (BR-017/BR-090): level + text only. The meaning is always spelled out
 * in words, never by colour alone (WCAG, CLAUDE.md #38). No distance, no Sorte position.
 */
export function TemperatureCard({
  level,
  label,
}: {
  level: TemperatureLevel;
  label: string;
}): React.JSX.Element {
  const background = temperatureColors[level];
  const darkText = level === "MUITO_QUENTE";
  const textColor = darkText ? colors.navy : colors.white;
  return (
    <View
      accessible
      accessibilityLabel={`Temperatura: ${label}. ${HINT[level]}`}
      style={[styles.card, { backgroundColor: background }]}
    >
      <Text style={[styles.caption, { color: textColor }]}>Sua temperatura</Text>
      <Text style={[styles.level, { color: textColor }]}>{label}</Text>
      <Text style={[styles.hint, { color: textColor }]}>{HINT[level]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.xl },
  caption: { ...typography.label, textTransform: "uppercase", opacity: 0.85 },
  level: { ...typography.h1, marginTop: spacing.xs },
  hint: { ...typography.body, marginTop: spacing.sm },
});
