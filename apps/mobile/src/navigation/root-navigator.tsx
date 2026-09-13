import React from "react";
import { NavigationContainer, DefaultTheme, type Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./types.js";
import { HomeScreen } from "../screens/HomeScreen.js";
import { AuthScreen } from "../screens/AuthScreen.js";
import { CampaignDetailScreen } from "../screens/CampaignDetailScreen.js";
import { PositionSelectionScreen } from "../screens/PositionSelectionScreen.js";
import { ParticipationConfirmationScreen } from "../screens/ParticipationConfirmationScreen.js";
import { LiveGameScreen } from "../screens/LiveGameScreen.js";
import { FinalLockScreen } from "../screens/FinalLockScreen.js";
import { ResultScreen } from "../screens/ResultScreen.js";
import { BenefitsScreen } from "../screens/BenefitsScreen.js";
import { colors } from "../theme/tokens.js";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Tema de navegação no vocabulário de cor do design system (p.11/p.18):
// cabeçalho navy com texto branco, fundo de tela cream.
const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.violet,
    background: colors.cream,
    card: colors.navy,
    text: colors.white,
    border: colors.navy,
  },
};

/** TASK-036 Mobile Application Shell: the navigation graph for the whole participant journey. */
export function RootNavigator(): React.JSX.Element {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "PassaSorte" }} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ title: "Entrar" }} />
        <Stack.Screen
          name="CampaignDetail"
          component={CampaignDetailScreen}
          options={{ title: "Campanha" }}
        />
        <Stack.Screen
          name="PositionSelection"
          component={PositionSelectionScreen}
          options={{ title: "Escolher posição" }}
        />
        <Stack.Screen
          name="ParticipationConfirmation"
          component={ParticipationConfirmationScreen}
          options={{ title: "Confirmar participação" }}
        />
        <Stack.Screen name="LiveGame" component={LiveGameScreen} options={{ title: "Jogo" }} />
        <Stack.Screen
          name="FinalLock"
          component={FinalLockScreen}
          options={{ title: "Travamento final" }}
        />
        <Stack.Screen name="Result" component={ResultScreen} options={{ title: "Resultado" }} />
        <Stack.Screen
          name="Benefits"
          component={BenefitsScreen}
          options={{ title: "Benefícios" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
