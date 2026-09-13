import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { useAuth } from "../context/auth-context.js";
import { Button } from "../components/Button.js";
import { ScreenContainer } from "../components/ScreenContainer.js";
import { colors, radius, spacing, typography } from "../theme/tokens.js";

type Props = NativeStackScreenProps<RootStackParamList, "Auth">;

/**
 * TASK-039 Mobile Auth (ADR-008 Supabase Auth, email+password - see
 * auth-context.tsx for why that specific method was picked).
 */
export function AuthScreen({ navigation }: Props): React.JSX.Element {
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    setError(undefined);
    setSubmitting(true);
    try {
      if (mode === "signIn") {
        await signInWithPassword(email, password);
      } else {
        await signUpWithPassword(email, password);
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível autenticar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.title}>{mode === "signIn" ? "Entrar" : "Criar conta"}</Text>
      <TextInput
        style={styles.input}
        placeholder="E-mail"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        label={submitting ? "Enviando..." : mode === "signIn" ? "Entrar" : "Criar conta"}
        loading={submitting}
        onPress={() => void submit()}
      />
      <Pressable onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
        <Text style={styles.switchLink}>
          {mode === "signIn" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
        </Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: "center" },
  title: { ...typography.h2, color: colors.navy, marginBottom: spacing.xl, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#E4D9CC",
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.white,
    color: colors.navy,
    fontSize: typography.body.fontSize,
  },
  error: { color: colors.danger, marginBottom: spacing.md },
  switchLink: {
    ...typography.body,
    color: colors.violet,
    textAlign: "center",
    marginTop: spacing.xl,
    fontWeight: "600",
  },
});
