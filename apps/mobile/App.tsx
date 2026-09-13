import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/auth-context.js";
import { RootNavigator } from "./src/navigation/root-navigator.js";

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        {/* "dark": o fundo padrão do app agora é o cream do design system (p.2/p.18), que precisa de ícones escuros na status bar. */}
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
