import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens.js";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** Single-choice selector (pill segments). Selected segment is also marked in the accessibility state. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.row, disabled ? styles.disabled : null]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected ? styles.segmentSelected : null]}
          >
            <Text style={[styles.label, selected ? styles.labelSelected : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  disabled: { opacity: 0.5 },
  segment: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.violet,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  segmentSelected: { backgroundColor: colors.violet },
  label: { ...typography.small, fontWeight: "700", color: colors.violet },
  labelSelected: { color: colors.white },
});
