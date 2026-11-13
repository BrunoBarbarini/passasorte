/**
 * GameEngine V2 (ADR-022): pure, versioned, deterministic. No clock, no
 * randomness, no I/O. The caller supplies server time, ids and the
 * initial Sorte position (derived from committed randomness); everything
 * else is a function of (config, seats, history).
 *
 * Rules implemented: circular bar, 1 position per credit (DECISION-01);
 * AUTOMATIC executes the configured autoAction for exactly 1 movement and
 * NONE / zero balance skips the round action at no cost (DECISION-03/04, BR-070);
 * unused movements EXPIRE at completion (BR-064); MVP winningZoneSize = 1
 * (DECISION-06); no final lock (BR-067); a manual STAY costs 1 (BR-021).
 */
import { assertValidBarSize, assertValidPosition, displaceSorte } from "./circular-bar.js";
import { chainHash, sha256Hex, canonicalize } from "./canonical-hash.js";
import type { CanonicalValue } from "./canonical-hash.js";
import { GameEngineError } from "./errors.js";
import { ENGINE_V2_VERSION } from "./types.js";
import { resolveRoundWith } from "./round.js";
import type { RoundInput, RoundResolution, SubmissionCheckInput } from "./round.js";
import type {
  AbsentActionPlan,
  AutoAction,
  CompleteInput,
  CompleteTransition,
  GameConfigV2,
  GameInitInput,
  GameReplayInputV2,
  GameReplayOutputV2,
  GameResultV2,
  GameStateV2,
  MovementCommandV2,
  MovementTransition,
  ParticipantSeatV2,
  SeatState,
  SkipReason,
  SkipTransition,
  SkipActionInput,
  Transition,
  TransitionResult,
} from "./types.js";

const AUTO_ACTIONS: readonly AutoAction[] = ["LEFT", "RIGHT", "STAY", "NONE"];
const DIRECTIONS = ["LEFT", "RIGHT", "STAY"] as const;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type TransitionBody = DistributiveOmit<Transition, "previousStateHash" | "currentStateHash">;

function validateConfig(config: GameConfigV2): void {
  const zone: unknown = config.winningZoneSize;
  const cap: unknown = config.maxMovementsPerRound;
  if (typeof zone !== "number" || !Number.isSafeInteger(zone) || zone < 1) {
    throw new GameEngineError(
      "INVALID_CONFIG",
      "winningZoneSize deve ser um inteiro maior ou igual a 1.",
    );
  }
  if (zone !== 1) {
    throw new GameEngineError(
      "UNSUPPORTED_WINNING_ZONE",
      "No MVP a zona vencedora tem exatamente 1 posição; zonas maiores ainda não têm regra definida.",
    );
  }
  if (cap === undefined) {
    throw new GameEngineError(
      "INVALID_CONFIG",
      "maxMovementsPerRound exige uma escolha explícita: um número inteiro ou null (sem limite).",
    );
  }
  if (cap !== null && (typeof cap !== "number" || !Number.isSafeInteger(cap) || cap < 1)) {
    throw new GameEngineError(
      "INVALID_CONFIG",
      "maxMovementsPerRound deve ser null ou um inteiro maior ou igual a 1.",
    );
  }
}

function normalizeSeats(participants: readonly ParticipantSeatV2[]): {
  seats: SeatState[];
  size: number;
} {
  if (participants.length === 0) {
    throw new GameEngineError("INVALID_SEATS", "O jogo precisa de pelo menos um participante.");
  }
  const ids = new Set<string>();
  const orders = new Set<number>();
  const owned = new Set<number>();
  let size = 0;
  for (const seat of participants) {
    if (seat.participantId.length === 0 || ids.has(seat.participantId)) {
      throw new GameEngineError(
        "INVALID_SEATS",
        "Identificadores de participante devem ser únicos e não vazios.",
      );
    }
    ids.add(seat.participantId);
    if (
      !Number.isSafeInteger(seat.entrySequence) ||
      seat.entrySequence < 0 ||
      orders.has(seat.entrySequence)
    ) {
      throw new GameEngineError(
        "INVALID_SEATS",
        "A ordem de confirmação deve ser única e não negativa.",
      );
    }
    orders.add(seat.entrySequence);
    if (!Number.isSafeInteger(seat.movementBalance) || seat.movementBalance < 0) {
      throw new GameEngineError(
        "INVALID_SEATS",
        "O saldo de movimentos deve ser um inteiro não negativo.",
      );
    }
    if (!AUTO_ACTIONS.includes(seat.autoAction)) {
      throw new GameEngineError("INVALID_SEATS", "autoAction inválida.");
    }
    for (const position of seat.positions) {
      if (!Number.isSafeInteger(position) || position < 1 || owned.has(position)) {
        throw new GameEngineError(
          "INVALID_SEATS",
          "Posições devem ser inteiros positivos com um único dono.",
        );
      }
      owned.add(position);
    }
    size += seat.positions.length;
  }
  assertValidBarSize(size);
  for (let position = 1; position <= size; position += 1) {
    if (!owned.has(position)) {
      throw new GameEngineError("INVALID_SEATS", `A posição ${position} da barra não tem dono.`);
    }
  }
  const seats = [...participants]
    .sort((a, b) => a.entrySequence - b.entrySequence)
    .map<SeatState>((seat) => ({
      participantId: seat.participantId,
      entrySequence: seat.entrySequence,
      positions: [...seat.positions].sort((a, b) => a - b),
      movementBalance: seat.movementBalance,
      autoAction: seat.autoAction,
      movementsExpired: 0,
    }));
  return { seats, size };
}

function genesisHash(
  config: GameConfigV2,
  seats: readonly SeatState[],
  size: number,
  input: GameInitInput,
): string {
  const payload: CanonicalValue = {
    kind: "GENESIS",
    engineVersion: ENGINE_V2_VERSION,
    config: {
      winningZoneSize: config.winningZoneSize,
      maxMovementsPerRound: config.maxMovementsPerRound,
    },
    size,
    randomnessCommitmentHash: input.randomnessCommitmentHash,
    initialSortePosition: input.initialSortePosition,
    seats: seats.map((seat) => ({
      participantId: seat.participantId,
      entrySequence: seat.entrySequence,
      positions: [...seat.positions],
      movementBalance: seat.movementBalance,
      autoAction: seat.autoAction,
    })),
  };
  return sha256Hex(canonicalize(payload));
}

function payloadOf(body: TransitionBody): CanonicalValue {
  const common = {
    sequence: body.sequence,
    serverTime: body.serverTime,
    sorteBefore: body.sorteBefore,
    sorteAfter: body.sorteAfter,
    engineVersion: body.engineVersion,
    outcome: body.outcome,
  };
  switch (body.outcome) {
    case "APPLIED":
      return {
        ...common,
        command: {
          participantId: body.command.participantId,
          actionId: body.command.actionId,
          round: body.command.round,
          resolutionSequence: body.command.resolutionSequence,
          serverTime: body.command.serverTime,
          kind: body.command.kind,
          credits: body.command.credits,
          executionType: body.command.executionType,
        },
        creditsConsumed: body.creditsConsumed,
        creditsRemainingAfter: body.creditsRemainingAfter,
      };
    case "SKIPPED":
      return {
        ...common,
        action: {
          participantId: body.action.participantId,
          actionId: body.action.actionId,
          round: body.action.round,
          resolutionSequence: body.action.resolutionSequence,
          serverTime: body.action.serverTime,
        },
        skipReason: body.skipReason,
        creditsConsumed: body.creditsConsumed,
        creditsRemainingAfter: body.creditsRemainingAfter,
      };
    case "COMPLETED":
      return {
        ...common,
        expired: body.expired.map((entry) => ({
          participantId: entry.participantId,
          movements: entry.movements,
        })),
      };
  }
}

function seal(previousStateHash: string, body: TransitionBody): Transition {
  const currentStateHash = chainHash(previousStateHash, payloadOf(body));
  return { ...body, previousStateHash, currentStateHash };
}

function requireRunning(state: GameStateV2): void {
  if (state.status !== "RUNNING") {
    throw new GameEngineError("GAME_NOT_RUNNING", "A partida não está em andamento.");
  }
}

function seatIndex(state: GameStateV2, participantId: string): number {
  const index = state.seats.findIndex((seat) => seat.participantId === participantId);
  if (index < 0) {
    throw new GameEngineError("UNKNOWN_PARTICIPANT", "Participante não pertence a esta partida.");
  }
  return index;
}

function requireFreeAction(state: GameStateV2, actionId: string): void {
  if (state.consumedActionIds.includes(actionId)) {
    throw new GameEngineError(
      "ROUND_ACTION_ALREADY_CONSUMED",
      "Esta ação da rodada já foi registrada.",
    );
  }
}

function withSeat(state: GameStateV2, index: number, seat: SeatState): readonly SeatState[] {
  return state.seats.map((current, i) => (i === index ? seat : current));
}

export interface GameEngineV2 {
  readonly version: typeof ENGINE_V2_VERSION;
  initialize(input: GameInitInput): GameStateV2;
  /** Decides what happens at the deadline for a participant who did not act (DECISION-03/04). */
  planAbsentAction(state: GameStateV2, participantId: string): AbsentActionPlan;
  /**
   * Checks a manual submission against the current state WITHOUT applying it
   * (cap, balance, STAY cost). The API calls it when the participant submits,
   * so an invalid action is rejected inside the window and never reaches
   * resolution (DECISION-16).
   */
  validateSubmission(state: GameStateV2, submission: SubmissionCheckInput): void;
  /**
   * Resolves ONE collective round: every participant gets exactly one outcome
   * (manual, automatic or skipped) applied in the caller-supplied order
   * (T-32 is TBD, so no order is assumed here).
   */
  resolveRound(state: GameStateV2, input: RoundInput): RoundResolution;
  /** Applies ONE command that moves the SORTE. Never mutates participants' positions. */
  applyMovement(
    state: GameStateV2,
    command: MovementCommandV2,
  ): TransitionResult<MovementTransition>;
  /** Records a skipped turn: consumes nothing, still hash-chained (BR-063). */
  skipAction(state: GameStateV2, input: SkipActionInput): TransitionResult<SkipTransition>;
  /** Ends the match (no final lock, BR-067) and EXPIRES unused movements (BR-064). */
  complete(state: GameStateV2, input: CompleteInput): TransitionResult<CompleteTransition>;
  calculateWinners(state: GameStateV2): GameResultV2;
  replay(input: GameReplayInputV2): GameReplayOutputV2;
}

function initialize(input: GameInitInput): GameStateV2 {
  validateConfig(input.config);
  const { seats, size } = normalizeSeats(input.participants);
  assertValidPosition(input.initialSortePosition, size);
  if (input.randomnessCommitmentHash.length === 0) {
    throw new GameEngineError(
      "INVALID_CONFIG",
      "O hash do compromisso de aleatoriedade é obrigatório.",
    );
  }
  const config: GameConfigV2 = {
    winningZoneSize: input.config.winningZoneSize,
    maxMovementsPerRound: input.config.maxMovementsPerRound,
  };
  return {
    engineVersion: ENGINE_V2_VERSION,
    config,
    size,
    status: "RUNNING",
    sortePosition: input.initialSortePosition,
    seats,
    consumedActionIds: [],
    sequence: 0,
    stateHash: genesisHash(config, seats, size, input),
  };
}

function planAbsentAction(state: GameStateV2, participantId: string): AbsentActionPlan {
  requireRunning(state);
  const seat = state.seats[seatIndex(state, participantId)] as SeatState;
  if (seat.movementBalance === 0) return { action: "SKIP", reason: "NO_MOVEMENTS_LEFT" };
  if (seat.autoAction === "NONE") return { action: "SKIP", reason: "ABSENT_NO_AUTO_ACTION" };
  return { action: "AUTOMATIC", kind: seat.autoAction, credits: 1 };
}

function assertCommandAllowed(
  state: Pick<GameStateV2, "config">,
  seat: Pick<SeatState, "autoAction" | "movementBalance">,
  command: Pick<MovementCommandV2, "kind" | "credits" | "executionType">,
): void {
  if (!DIRECTIONS.includes(command.kind)) {
    throw new GameEngineError("INVALID_CREDITS", "Direção de movimento inválida.");
  }
  if (!Number.isSafeInteger(command.credits) || command.credits < 1) {
    throw new GameEngineError("INVALID_CREDITS", "O movimento deve consumir pelo menos 1 crédito.");
  }
  if (command.kind === "STAY" && command.credits !== 1) {
    throw new GameEngineError(
      "INVALID_CREDITS",
      "Manter a posição (STAY) consome exatamente 1 movimento.",
    );
  }
  if (command.executionType === "AUTOMATIC") {
    if (seat.autoAction === "NONE" || seat.autoAction !== command.kind || command.credits !== 1) {
      throw new GameEngineError(
        "AUTOMATIC_MISMATCH",
        "A execução automática deve repetir a ação configurada pelo participante, com exatamente 1 movimento.",
      );
    }
  } else {
    const cap = state.config.maxMovementsPerRound;
    if (cap !== null && command.credits > cap) {
      throw new GameEngineError(
        "EXCEEDS_ROUND_CAP",
        `O limite por rodada nesta campanha é de ${cap} movimentos.`,
      );
    }
  }
  if (command.credits > seat.movementBalance) {
    throw new GameEngineError(
      "INSUFFICIENT_MOVEMENTS",
      "Você não tem movimentos suficientes para esta jogada.",
    );
  }
}

function applyMovement(
  state: GameStateV2,
  command: MovementCommandV2,
): TransitionResult<MovementTransition> {
  requireRunning(state);
  const index = seatIndex(state, command.participantId);
  const seat = state.seats[index] as SeatState;
  requireFreeAction(state, command.actionId);

  assertCommandAllowed(state, seat, command);

  const sorteAfter = displaceSorte(state.sortePosition, command.kind, command.credits, state.size);
  const remaining = seat.movementBalance - command.credits;
  const sequence = state.sequence + 1;
  const body: TransitionBody = {
    sequence,
    serverTime: command.serverTime,
    sorteBefore: state.sortePosition,
    sorteAfter,
    engineVersion: ENGINE_V2_VERSION,
    outcome: "APPLIED",
    command,
    creditsConsumed: command.credits,
    creditsRemainingAfter: remaining,
  };
  const transition = seal(state.stateHash, body) as MovementTransition;
  return {
    transition,
    state: {
      ...state,
      sortePosition: sorteAfter,
      seats: withSeat(state, index, { ...seat, movementBalance: remaining }),
      consumedActionIds: [...state.consumedActionIds, command.actionId],
      sequence,
      stateHash: transition.currentStateHash,
    },
  };
}

function skipAction(state: GameStateV2, input: SkipActionInput): TransitionResult<SkipTransition> {
  requireRunning(state);
  const index = seatIndex(state, input.participantId);
  const seat = state.seats[index] as SeatState;
  requireFreeAction(state, input.actionId);
  const plan = planAbsentAction(state, input.participantId);
  if (plan.action !== "SKIP") {
    throw new GameEngineError(
      "SKIP_NOT_APPLICABLE",
      "O participante tem uma ação automática configurada e movimentos disponíveis; a ação da rodada não pode ser pulada.",
    );
  }
  const sequence = state.sequence + 1;
  const body: TransitionBody = {
    sequence,
    serverTime: input.serverTime,
    sorteBefore: state.sortePosition,
    sorteAfter: state.sortePosition,
    engineVersion: ENGINE_V2_VERSION,
    outcome: "SKIPPED",
    command: null,
    action: {
      participantId: input.participantId,
      actionId: input.actionId,
      round: input.round,
      resolutionSequence: input.resolutionSequence,
      serverTime: input.serverTime,
    },
    skipReason: plan.reason,
    creditsConsumed: 0,
    creditsRemainingAfter: seat.movementBalance,
  };
  const transition = seal(state.stateHash, body) as SkipTransition;
  return {
    transition,
    state: {
      ...state,
      consumedActionIds: [...state.consumedActionIds, input.actionId],
      sequence,
      stateHash: transition.currentStateHash,
    },
  };
}

function complete(state: GameStateV2, input: CompleteInput): TransitionResult<CompleteTransition> {
  requireRunning(state);
  const expired = state.seats
    .filter((seat) => seat.movementBalance > 0)
    .map((seat) => ({ participantId: seat.participantId, movements: seat.movementBalance }));
  const sequence = state.sequence + 1;
  const body: TransitionBody = {
    sequence,
    serverTime: input.serverTime,
    sorteBefore: state.sortePosition,
    sorteAfter: state.sortePosition,
    engineVersion: ENGINE_V2_VERSION,
    outcome: "COMPLETED",
    expired,
  };
  const transition = seal(state.stateHash, body) as CompleteTransition;
  return {
    transition,
    state: {
      ...state,
      status: "COMPLETED",
      seats: state.seats.map((seat) => ({
        ...seat,
        movementBalance: 0,
        movementsExpired: seat.movementsExpired + seat.movementBalance,
      })),
      sequence,
      stateHash: transition.currentStateHash,
    },
  };
}

function calculateWinners(state: GameStateV2): GameResultV2 {
  if (state.status !== "COMPLETED") {
    throw new GameEngineError(
      "GAME_NOT_COMPLETED",
      "O resultado só existe depois que a partida termina.",
    );
  }
  validateConfig(state.config);
  const owner = state.seats.find((seat) => seat.positions.includes(state.sortePosition));
  if (owner === undefined) {
    throw new GameEngineError("INVALID_SEATS", "A posição final da Sorte não tem dono.");
  }
  return {
    sortePosition: state.sortePosition,
    winningPositions: [state.sortePosition],
    winners: [{ participantId: owner.participantId, winningPositions: [state.sortePosition] }],
    finalStateHash: state.stateHash,
  };
}

function replay(input: GameReplayInputV2): GameReplayOutputV2 {
  let state = initialize(input.init);
  const transitions: Transition[] = [];
  const expected = input.expectedTransitions;
  if (expected !== undefined && expected.length !== input.steps.length) {
    throw new GameEngineError(
      "REPLAY_MISMATCH",
      "O histórico armazenado tem um número diferente de passos.",
    );
  }
  input.steps.forEach((step, i) => {
    let result: TransitionResult;
    switch (step.type) {
      case "MOVEMENT":
        result = applyMovement(state, step.command);
        break;
      case "SKIP":
        result = skipAction(state, step.input);
        break;
      case "COMPLETE":
        result = complete(state, step.input);
        break;
    }
    const stored = expected?.[i];
    if (
      stored !== undefined &&
      (stored.sequence !== result.transition.sequence ||
        stored.previousStateHash !== result.transition.previousStateHash ||
        stored.currentStateHash !== result.transition.currentStateHash)
    ) {
      throw new GameEngineError(
        "REPLAY_MISMATCH",
        `O passo ${i + 1} do histórico não confere com o recálculo.`,
      );
    }
    transitions.push(result.transition);
    state = result.state;
  });
  return {
    state,
    transitions,
    result: state.status === "COMPLETED" ? calculateWinners(state) : null,
  };
}

/** Recomputes a stored chain from its genesis hash (audit verifier, nightly job - TASK-081). */
export function verifyHashChain(
  genesisStateHash: string,
  transitions: readonly Transition[],
): void {
  let previous = genesisStateHash;
  for (const transition of transitions) {
    const { previousStateHash, currentStateHash, ...rest } = transition;
    const recomputed = chainHash(previous, payloadOf(rest));
    if (previousStateHash !== previous || currentStateHash !== recomputed) {
      throw new GameEngineError(
        "REPLAY_MISMATCH",
        `A cadeia de hashes foi violada no passo ${transition.sequence}.`,
      );
    }
    previous = currentStateHash;
  }
}

/** Participant-facing text for a skipped turn (BR-048, DECISION-04). */
export function describeSkipReasonPtBr(reason: SkipReason): string {
  switch (reason) {
    case "ABSENT_NO_AUTO_ACTION":
      return "Você perdeu sua vez porque estava ausente. Seus movimentos continuam disponíveis nesta partida.";
    case "NO_MOVEMENTS_LEFT":
      return "Sua vez foi pulada porque você não tem mais movimentos disponíveis nesta partida.";
  }
}

/**
 * Same rules as `validateSubmission`, for callers that hold the frozen room
 * config and a participant's balance but not a full engine state (the API
 * validates a submission while the window is open, before the round is
 * resolved). Single source of truth: it runs `assertCommandAllowed`.
 */
export function assertManualSubmissionAllowed(
  config: GameConfigV2,
  movementBalance: number,
  submission: Pick<SubmissionCheckInput, "kind" | "credits">,
): void {
  assertCommandAllowed(
    { config },
    { autoAction: "NONE", movementBalance },
    {
      kind: submission.kind,
      credits: submission.credits,
      executionType: "MANUAL",
    },
  );
}

function validateSubmission(state: GameStateV2, submission: SubmissionCheckInput): void {
  requireRunning(state);
  const seat = state.seats[seatIndex(state, submission.participantId)] as SeatState;
  assertCommandAllowed(state, seat, {
    kind: submission.kind,
    credits: submission.credits,
    executionType: "MANUAL",
  });
}

function resolveRound(state: GameStateV2, input: RoundInput): RoundResolution {
  return resolveRoundWith(
    { planAbsentAction, applyMovement, skipAction, validateSubmission },
    state,
    input,
  );
}

export function createGameEngineV2(): GameEngineV2 {
  return {
    version: ENGINE_V2_VERSION,
    initialize,
    validateSubmission,
    resolveRound,
    planAbsentAction,
    applyMovement,
    skipAction,
    complete,
    calculateWinners,
    replay,
  };
}
