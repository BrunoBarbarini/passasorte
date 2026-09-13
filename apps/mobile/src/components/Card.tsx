import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, radius, shadow, spacing } from "../theme/tokens.js";

interface CardProps extends ViewProps {
  /** Barra de acento na base do card, no estilo do "Card de experiência" (p.13). */
  accentColor?: string;
  disabled?: boolean;
}

/**
 * Superfície padrão de conteúdo: cantos suaves (radius.lg), fundo
 * branco e sombra discreta - "sombras suaves, sem brilho neon" (p.12).
 */
export function Card({ accentColor, disabled = false, style, children, ...viewProps }: CardProps): React.JSX.Element {
  return (
    <View
      {...viewProps}
      style={[
        styles.base,
        shadow.card,
        accentColor ? styles.withAccent : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {children}
      {accentColor ? <View style={[styles.accent, { backgroundColor: accentColor }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    padding: spacing.lg,
    overflow: "hidden",
  },
  disabled: { opacity: 0.5 },
  withAccent: { paddingBottom: spacing.lg + 4 },
  accent: { position: "absolute", left: 0, right: 0, bottom: 0, height: 4 },
});
