import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens.js";

export type PillTone = "navy" | "territory" | "violet" | "coral" | "amber" | "aqua" | "neutral" | "danger";

const TONE_COLOR: Record<PillTone, string> = {
  navy: colors.navy,
  territory: colors.territory,
  violet: colors.violet,
  coral: colors.coral,
  amber: colors.amber,
  aqua: colors.aqua,
  neutral: colors.textMuted,
  danger: colors.danger,
};

/**
 * Badge de estado no vocabulário de cor do design system (p.6/p.11).
 * Usado para colorir os status que já existem no domínio (sala,
 * campanha, benefício, participação) - não introduz nenhum status novo,
 * só dá cor de marca a valores que a API já retorna.
 */
export function Pill({ label, tone = "neutral" }: { label: string; tone?: PillTone }): React.JSX.Element {
  return (
    <View style={[styles.pill, { backgroundColor: TONE_COLOR[tone] }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  text: { ...typography.label, color: colors.white, textTransform: "uppercase" },
});
