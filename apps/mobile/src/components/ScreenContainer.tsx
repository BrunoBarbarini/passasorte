import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../theme/tokens.js";

interface ScreenContainerProps extends ViewProps {
  /** "dark" é reservado para telas institucionais/onboarding no estilo dos mockups escuros da p.18 - nenhuma tela de produto usa hoje. */
  tone?: "light" | "dark";
  /** Quando a tela já tem seu próprio scroll (FlatList/ScrollView), evita view+padding duplicados. */
  noPadding?: boolean;
}

/** Fundo padrão do app: cream nas telas de produto (p.2, p.18). */
export function ScreenContainer({
  tone = "light",
  noPadding = false,
  style,
  children,
  ...viewProps
}: ScreenContainerProps): React.JSX.Element {
  return (
    <SafeAreaView style={[styles.safe, tone === "dark" ? styles.dark : styles.light]}>
      <View {...viewProps} style={[styles.content, noPadding ? null : styles.padded, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  light: { backgroundColor: colors.cream },
  dark: { backgroundColor: colors.navy },
  content: { flex: 1 },
  padded: { padding: spacing.lg },
});
