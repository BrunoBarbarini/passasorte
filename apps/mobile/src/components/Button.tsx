import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing } from "../theme/tokens.js";

type Variant = "primary" | "secondary";

interface ButtonProps extends Omit<PressableProps, "style"> {
  label: string;
  variant?: Variant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * p.13 "Botões": "Participar" (sólido, coral) e "Ver experiência"
 * (contorno, violeta) - os dois estilos de botão que o design system
 * define. Pílula (radius.pill), sem gradiente, sem brilho.
 */
export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  ...pressableProps
}: ButtonProps): React.JSX.Element {
  const isPrimary = variant === "primary";
  const isDisabled = disabled || loading;
  return (
    <Pressable
      {...pressableProps}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.white : colors.violet} />
      ) : (
        <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelSecondary]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.coral },
  secondary: { backgroundColor: "transparent", borderWidth: 2, borderColor: colors.violet },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
  label: { fontSize: 16, lineHeight: 20, fontWeight: "700" },
  labelPrimary: { color: colors.white },
  labelSecondary: { color: colors.violet },
});
