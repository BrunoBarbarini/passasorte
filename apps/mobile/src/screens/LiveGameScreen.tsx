import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.js";
import { apiRequest, generateIdempotencyKey } from "../lib/api-client.js";
import { formatCountdown, usePolling, useServerClock } from "../lib/use-server-clock.js";
import type { AutoAction, ParticipantGameState, RoundActionKind } from "../types/api.js";
import { useAuth } from "../context/auth-context.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { PositionPickPanel } from "../components/PositionPickPanel.js";
import { ScreenContainer } from "../components/ScreenContainer.js";
import { Segmented, type SegmentedOption } from "../components/Segmented.js";
import { TemperatureCard } from "../components/TemperatureCard.js";
import { colors, radius, spacing, typography } from "../theme/tokens.js";

type Props = NativeStackScreenProps<RootStackParamList, "LiveGame">;

const KIND_LABEL: Record<RoundActionKind, string> = {
  LEFT: "← Esquerda",
  RIGHT: "Direita →",
  STAY: "Ficar",
};
const ACTION_OPTIONS: readonly SegmentedOption<RoundActionKind>[] = [
  { value: "LEFT", label: KIND_LABEL.LEFT },
  { value: "STAY", label: KIND_LABEL.STAY },
  { value: "RIGHT", label: KIND_LABEL.RIGHT },
];
const AUTO_OPTIONS: readonly SegmentedOption<AutoAction>[] = [
  { value: "NONE", label: "Pular" },
  { value: "LEFT", label: "← Esq." },
  { value: "STAY", label: "Ficar" },
  { value: "RIGHT", label: "Dir. →" },
];

/**
 * The participant's whole game (Engine V2): waiting, position selection, ready, live rounds
 * with personal temperature, and the final result. Everything comes from the server
 * (GET /participations/{id}/game-state): the app never computes state, only shows it.
 * There is no "final lock" (BR-067).
 */
export function LiveGameScreen({ route, navigation }: Props): React.JSX.Element {
  const { participationId } = route.params;
  const { session } = useAuth();
  const token = session?.access_token;
  const [state, setState] = useState<ParticipantGameState | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [kind, setKind] = useState<RoundActionKind>("LEFT");
  const [credits, setCredits] = useState(1);
  const [busy, setBusy] = useState(false);
  const clock = useServerClock();

  const load = useCallback(() => {
    if (!token) return;
    apiRequest<ParticipantGameState>(`/participations/${participationId}/game-state`, {
      accessToken: token,
    })
      .then((next) => {
        clock.sync(next.serverTime);
        setState(next);
        setError(undefined);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro ao carregar."));
  }, [participationId, token, clock]);
  usePolling(load, 4000);

  const setAuto = async (autoAction: AutoAction): Promise<void> => {
    if (!token) return;
    setBusy(true);
    try {
      await apiRequest(`/participations/${participationId}/auto-action`, {
        method: "PUT",
        accessToken: token,
        body: { autoAction },
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a ação automática.");
    } finally {
      setBusy(false);
    }
  };

  const sendAction = async (): Promise<void> => {
    if (!token) return;
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest(`/participations/${participationId}/round-actions`, {
        method: "POST",
        accessToken: token,
        idempotencyKey: generateIdempotencyKey(),
        body: { kind, credits: kind === "STAY" ? 1 : credits },
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a jogada.");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <ScreenContainer style={styles.centered}>
        <Button label="Entrar" onPress={() => navigation.navigate("Auth")} />
      </ScreenContainer>
    );
  }
  if (!state) {
    return (
      <ScreenContainer style={styles.centered}>
        <Text style={error ? styles.error : styles.note}>{error ?? "Carregando..."}</Text>
      </ScreenContainer>
    );
  }

  const beforeStart = !["RUNNING", "RESOLVING", "COMPLETED", "CANCELLED"].includes(
    state.roomStatus,
  );
  const maxCredits = Math.max(
    1,
    Math.min(state.movements.remaining, state.maxMovementsPerRound ?? state.movements.remaining),
  );
  const effectiveCredits = Math.min(credits, maxCredits);

  return (
    <ScreenContainer>
      <ScrollView>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {state.result ? (
          <Card accentColor={state.result.won ? colors.aqua : colors.violet}>
            <Text style={styles.title}>
              {state.result.won ? "Você ganhou! 🎉" : "Não foi dessa vez"}
            </Text>
            <Text style={styles.line}>
              Posição vencedora: {state.result.winningPositions.join(", ") || "—"}
            </Text>
            <Text style={styles.line}>Suas posições: {state.positions.join(", ")}</Text>
          </Card>
        ) : null}

        {state.roomStatus === "POSITION_SELECTION" ? (
          <PositionPickPanel
            roomId={state.roomId}
            participationId={participationId}
            accessToken={token}
            onPicked={load}
          />
        ) : null}

        {state.roomStatus === "READY" ? (
          <Card accentColor={colors.aqua}>
            <Text style={styles.title}>Posições definidas</Text>
            <Text style={styles.line}>Suas posições: {state.positions.join(", ")}</Text>
            <Text style={styles.note}>Aguardando o início da partida.</Text>
          </Card>
        ) : null}

        {beforeStart &&
        state.roomStatus !== "POSITION_SELECTION" &&
        state.roomStatus !== "READY" ? (
          <Card accentColor={colors.violet}>
            <Text style={styles.title}>Você está dentro</Text>
            <Text style={styles.note}>
              {state.roomStatus === "OPEN"
                ? "A sala ainda está recebendo participantes. Depois que as entradas fecharem, cada um escolhe suas posições por ordem de entrada."
                : "As entradas foram encerradas. A escolha de posições começa em breve."}
            </Text>
          </Card>
        ) : null}

        {state.roomStatus === "RUNNING" && state.participationStatus === "ACTIVE" ? (
          <>
            {state.temperature ? (
              <TemperatureCard level={state.temperature.level} label={state.temperature.label} />
            ) : null}
            <Card accentColor={colors.coral} style={styles.block}>
              <Text style={styles.small}>Suas posições</Text>
              <Text style={styles.title}>{state.positions.join(", ")}</Text>
              <Text style={styles.line}>
                Movimentos restantes: {state.movements.remaining} de {state.movements.total}
              </Text>
            </Card>

            {state.round ? (
              <Card accentColor={colors.violet} style={styles.block}>
                <Text style={styles.title}>
                  Rodada {state.round.roundNo} de {state.round.totalRounds}
                </Text>
                {state.round.phase === "UPCOMING" ? (
                  <Text style={styles.line}>
                    Abre em {formatCountdown(Date.parse(state.round.windowOpensAt) - clock.now())}
                  </Text>
                ) : state.round.phase === "OPEN" ? (
                  <Text style={styles.line}>
                    Fecha em {formatCountdown(Date.parse(state.round.windowClosesAt) - clock.now())}
                    . Todos jogam ao mesmo tempo e você pode trocar sua jogada até fechar.
                  </Text>
                ) : (
                  <Text style={styles.line}>Apurando a rodada...</Text>
                )}
                {state.myAction ? (
                  <Text style={styles.chip}>
                    Sua jogada: {KIND_LABEL[state.myAction.kind]}
                    {state.myAction.kind === "STAY" ? "" : ` × ${state.myAction.credits}`}
                  </Text>
                ) : null}

                {state.round.phase === "OPEN" ? (
                  state.movements.remaining > 0 ? (
                    <View style={styles.controls}>
                      <Segmented options={ACTION_OPTIONS} value={kind} onChange={setKind} />
                      {kind !== "STAY" ? (
                        <View style={styles.stepper}>
                          <Button
                            label="−"
                            variant="secondary"
                            disabled={effectiveCredits <= 1}
                            onPress={() => setCredits(Math.max(1, effectiveCredits - 1))}
                            style={styles.stepButton}
                          />
                          <Text style={styles.stepValue}>
                            {effectiveCredits} {effectiveCredits === 1 ? "posição" : "posições"}
                          </Text>
                          <Button
                            label="+"
                            variant="secondary"
                            disabled={effectiveCredits >= maxCredits}
                            onPress={() => setCredits(Math.min(maxCredits, effectiveCredits + 1))}
                            style={styles.stepButton}
                          />
                        </View>
                      ) : null}
                      {state.maxMovementsPerRound !== null ? (
                        <Text style={styles.small}>
                          Máximo por rodada: {state.maxMovementsPerRound}
                        </Text>
                      ) : null}
                      <Button
                        label={state.myAction ? "Trocar jogada" : "Enviar jogada"}
                        loading={busy}
                        onPress={() => void sendAction()}
                        style={styles.sendButton}
                      />
                    </View>
                  ) : (
                    <Text style={styles.note}>Você não tem mais movimentos.</Text>
                  )
                ) : null}
              </Card>
            ) : null}
          </>
        ) : null}

        {!state.result ? (
          <Card style={styles.block}>
            <Text style={styles.title}>Se eu não jogar</Text>
            <Text style={styles.note}>
              Quando você não envia jogada numa rodada, o sistema faz esta por você (custa 1
              movimento). “Pular” não gasta nada.
              {beforeStart ? "" : " Não dá mais para mudar depois que a partida começa."}
            </Text>
            <Segmented
              options={AUTO_OPTIONS}
              value={state.autoAction}
              onChange={(next) => void setAuto(next)}
              disabled={busy || !beforeStart}
            />
          </Card>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: { justifyContent: "center" },
  block: { marginTop: spacing.md },
  title: { ...typography.h3, color: colors.navy },
  line: { ...typography.body, color: colors.navy, marginTop: spacing.xs },
  small: { ...typography.small, color: colors.textMuted },
  note: { ...typography.body, color: colors.textMuted, marginVertical: spacing.sm },
  error: { color: colors.danger, marginVertical: spacing.md },
  chip: {
    ...typography.small,
    fontWeight: "700",
    color: colors.navy,
    backgroundColor: colors.cream,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: "flex-start",
    marginTop: spacing.md,
  },
  controls: { marginTop: spacing.lg, gap: spacing.md },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepButton: { width: 64, paddingHorizontal: 0 },
  stepValue: { ...typography.h3, color: colors.navy },
  sendButton: { marginTop: spacing.sm },
});
