/**
 * Collective round resolution (DECISION-16..21).
 *
 * All participants may submit during the same action window. When the window
 * closes the engine resolves the round: every participant receives exactly one
 * outcome - their manual action, their automatic action (absent with a
 * configured autoAction) or a skip - applied to the Sorte in a caller-supplied
 * order.
 *
 * ROUND_RESOLUTION_ORDER is TBD (T-32): this module does NOT choose an order.
 * The proposed `entrySequence` order is exposed as `proposedEntrySequenceOrder`
 * for the caller to opt into explicitly, and the policy id is recorded in the
 * audit. With the current rules (additive circular displacement) the Sorte
 * position at the END of the round does not depend on the order; only the
 * per-action `luckPositionBefore/After` in the audit do.
 */
import { GameEngineError } from "./errors.js";
import type {
  AbsentActionPlan,
  ExecutionType,
  GameStateV2,
  MovementCommandV2,
  MovementTransition,
  ReplayStep,
  SkipActionInput,
  SkipReason,
  SkipTransition,
  SorteDirection,
  Transition,
  TransitionResult,
} from "./types.js";

/** A manual action accepted by the server inside the window (one per participant, T-33). */
export interface RoundSubmission {
  readonly participantId: string;
  readonly kind: SorteDirection;
  readonly credits: number;
  /** UTC ISO-8601 from the SERVER clock; must be inside [windowOpensAt, windowClosesAt). */
  readonly submittedAt: string;
}

export interface SubmissionCheckInput {
  readonly participantId: string;
  readonly kind: SorteDirection;
  readonly credits: number;
}

export interface RoundInput {
  readonly roundId: string;
  readonly roundNumber: number;
  readonly windowOpensAt: string;
  readonly windowClosesAt: string;
  /** Server time at which resolution runs; never earlier than the window close. */
  readonly resolutionStartedAt: string;
  readonly submissions: readonly RoundSubmission[];
  /** Every participant exactly once, in the order the actions are applied. */
  readonly resolutionOrder: readonly string[];
  /** Recorded in the audit so replay knows which order rule was used (T-32). */
  readonly resolutionOrderPolicy: string;
}

/** One audit row per participant per round (DECISION-21). */
export interface RoundAuditRow {
  readonly roundNumber: number;
  readonly windowOpensAt: string;
  readonly windowClosesAt: string;
  readonly participantId: string;
  readonly entrySequence: number;
  readonly resolutionSequence: number;
  readonly actionSubmittedAt: string | null;
  readonly action: SorteDirection | null;
  readonly executionType: ExecutionType | null;
  readonly outcome: "APPLIED" | "SKIPPED";
  readonly skipReason: SkipReason | null;
  readonly movementsConsumed: number;
  readonly luckPositionBefore: number;
  readonly luckPositionAfter: number;
}

export interface RoundResolution {
  readonly state: GameStateV2;
  readonly transitions: readonly Transition[];
  /** Feed these to `replay` to rebuild the same hash chain. */
  readonly steps: readonly ReplayStep[];
  readonly audit: readonly RoundAuditRow[];
  readonly luckPositionBeforeRound: number;
  readonly luckPositionAfterRound: number;
  readonly resolutionOrderPolicy: string;
}

export interface RoundPrimitives {
  planAbsentAction(state: GameStateV2, participantId: string): AbsentActionPlan;
  applyMovement(
    state: GameStateV2,
    command: MovementCommandV2,
  ): TransitionResult<MovementTransition>;
  skipAction(state: GameStateV2, input: SkipActionInput): TransitionResult<SkipTransition>;
  validateSubmission(state: GameStateV2, submission: SubmissionCheckInput): void;
}

export const PROPOSED_ENTRY_SEQUENCE_ORDER_POLICY = "PROPOSED_ENTRY_SEQUENCE_V1";

/**
 * PROPOSED, NOT APPROVED (T-32): participants ordered by entrySequence. Never
 * applied implicitly; the caller must pass it as `resolutionOrder`.
 */
export function proposedEntrySequenceOrder(state: GameStateV2): readonly string[] {
  return [...state.seats]
    .sort((a, b) => a.entrySequence - b.entrySequence)
    .map((seat) => seat.participantId);
}

function parseTime(value: string, label: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new GameEngineError("INVALID_ROUND", `${label} não é um horário ISO-8601 válido.`);
  }
  return ms;
}

export function resolveRoundWith(
  primitives: RoundPrimitives,
  initial: GameStateV2,
  input: RoundInput,
): RoundResolution {
  if (initial.status !== "RUNNING") {
    throw new GameEngineError("GAME_NOT_RUNNING", "A partida não está em andamento.");
  }
  if (
    input.roundId.length === 0 ||
    !Number.isSafeInteger(input.roundNumber) ||
    input.roundNumber < 1
  ) {
    throw new GameEngineError("INVALID_ROUND", "Rodada inválida.");
  }
  const opens = parseTime(input.windowOpensAt, "A abertura da janela");
  const closes = parseTime(input.windowClosesAt, "O fechamento da janela");
  const resolving = parseTime(input.resolutionStartedAt, "O início da resolução");
  if (closes <= opens) {
    throw new GameEngineError("INVALID_ROUND", "A janela da rodada deve ter duração positiva.");
  }
  if (resolving < closes) {
    throw new GameEngineError(
      "ROUND_NOT_CLOSED",
      "A rodada só pode ser resolvida depois que a janela fechar.",
    );
  }

  const participantIds = initial.seats.map((seat) => seat.participantId);
  const order = input.resolutionOrder;
  if (
    order.length !== participantIds.length ||
    new Set(order).size !== order.length ||
    !order.every((id) => participantIds.includes(id))
  ) {
    throw new GameEngineError(
      "INVALID_ROUND",
      "A ordem de resolução deve conter cada participante exatamente uma vez.",
    );
  }

  const byParticipant = new Map<string, RoundSubmission>();
  for (const submission of input.submissions) {
    if (!participantIds.includes(submission.participantId)) {
      throw new GameEngineError("UNKNOWN_PARTICIPANT", "Participante não pertence a esta partida.");
    }
    if (byParticipant.has(submission.participantId)) {
      throw new GameEngineError(
        "DUPLICATE_ROUND_ACTION",
        "Só é aceita uma ação por participante em cada rodada.",
      );
    }
    const at = parseTime(submission.submittedAt, "O horário da jogada");
    // serverTime >= actionWindowClosesAt means closed: nothing new is accepted.
    if (at < opens || at >= closes) {
      throw new GameEngineError(
        "SUBMISSION_OUTSIDE_WINDOW",
        "A jogada foi registrada fora da janela da rodada.",
      );
    }
    primitives.validateSubmission(initial, submission);
    byParticipant.set(submission.participantId, submission);
  }

  let state = initial;
  const transitions: Transition[] = [];
  const steps: ReplayStep[] = [];
  const audit: RoundAuditRow[] = [];

  order.forEach((participantId, resolutionSequence) => {
    const seat = state.seats.find((candidate) => candidate.participantId === participantId);
    if (seat === undefined) {
      throw new GameEngineError("UNKNOWN_PARTICIPANT", "Participante não pertence a esta partida.");
    }
    const context = {
      actionId: `${input.roundId}:${participantId}`,
      round: input.roundNumber,
      resolutionSequence,
    };
    const luckBefore = state.sortePosition;
    const submission = byParticipant.get(participantId);
    const base = {
      roundNumber: input.roundNumber,
      windowOpensAt: input.windowOpensAt,
      windowClosesAt: input.windowClosesAt,
      participantId,
      entrySequence: seat.entrySequence,
      resolutionSequence,
    };

    const applied = (command: MovementCommandV2, submittedAt: string | null): void => {
      const result = primitives.applyMovement(state, command);
      state = result.state;
      transitions.push(result.transition);
      steps.push({ type: "MOVEMENT", command });
      audit.push({
        ...base,
        actionSubmittedAt: submittedAt,
        action: command.kind,
        executionType: command.executionType,
        outcome: "APPLIED",
        skipReason: null,
        movementsConsumed: result.transition.creditsConsumed,
        luckPositionBefore: luckBefore,
        luckPositionAfter: state.sortePosition,
      });
    };

    if (submission !== undefined) {
      applied(
        {
          ...context,
          serverTime: submission.submittedAt,
          participantId,
          kind: submission.kind,
          credits: submission.credits,
          executionType: "MANUAL",
        },
        submission.submittedAt,
      );
      return;
    }

    const plan = primitives.planAbsentAction(state, participantId);
    if (plan.action === "AUTOMATIC") {
      applied(
        {
          ...context,
          serverTime: input.resolutionStartedAt,
          participantId,
          kind: plan.kind,
          credits: plan.credits,
          executionType: "AUTOMATIC",
        },
        null,
      );
      return;
    }
    const skipInput: SkipActionInput = {
      ...context,
      serverTime: input.resolutionStartedAt,
      participantId,
    };
    const result = primitives.skipAction(state, skipInput);
    state = result.state;
    transitions.push(result.transition);
    steps.push({ type: "SKIP", input: skipInput });
    audit.push({
      ...base,
      actionSubmittedAt: null,
      action: null,
      executionType: null,
      outcome: "SKIPPED",
      skipReason: result.transition.skipReason,
      movementsConsumed: 0,
      luckPositionBefore: luckBefore,
      luckPositionAfter: state.sortePosition,
    });
  });

  return {
    state,
    transitions,
    steps,
    audit,
    luckPositionBeforeRound: initial.sortePosition,
    luckPositionAfterRound: state.sortePosition,
    resolutionOrderPolicy: input.resolutionOrderPolicy,
  };
}
