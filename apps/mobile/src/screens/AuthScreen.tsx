import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { useAuth } from "../context/auth-context.js";

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
    <View style={styles.container}>
      <Text style={styles.title}>{mode === "signIn" ? "Entrar" : "Criar conta"}</Text>
      <TextInput
        style={styles.input}
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={() => void submit()} disabled={submitting}>
        <Text style={styles.buttonText}>
          {submitting ? "Enviando..." : mode === "signIn" ? "Entrar" : "Criar conta"}
        </Text>
      </Pressable>
      <Pressable onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
        <Text style={styles.switchLink}>
          {mode === "signIn" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 24, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  error: { color: "#b91c1c", marginBottom: 12 },
  button: { backgroundColor: "#2563eb", borderRadius: 8, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
  switchLink: { color: "#2563eb", textAlign: "center", marginTop: 16 },
});
