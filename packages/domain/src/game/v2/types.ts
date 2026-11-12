/**
 * GameEngine V2 types (CLAUDE.md section 8, ADR-022). The Sorte is the only
 * movable entity; participants' positions are fixed once the selection
 * phase ends. Rules that came from owner decisions: DECISION-01..06 (6.5).
 */
export const ENGINE_V2_VERSION = "2.0.0" as const;

export type SorteDirection = "LEFT" | "RIGHT" | "STAY";
export type AutoAction = SorteDirection | "NONE";
export type ExecutionType = "MANUAL" | "AUTOMATIC";
export type SkipReason = "ABSENT_NO_AUTO_ACTION" | "NO_MOVEMENTS_LEFT";
export type GameStatus = "RUNNING" | "COMPLETED";

/** Frozen into the room snapshot at start (BR-024). Nothing here is a magic number. */
export interface GameConfigV2 {
  /** MVP = 1 (DECISION-06). Greater values are rejected until a rule is defined (BR-066). */
  readonly winningZoneSize: number;
  /** Cap on credits per MANUAL command. Explicit number or explicit `null` = no limit; no default (BR-068). */
  readonly maxMovementsPerRound: number | null;
}

export interface ParticipantSeatV2 {
  readonly participantId: string;
  /** Server-assigned entry order (DECISION-08): pick priority and an auditable attribute; the resolution order of a round is NOT derived from it yet (T-32). */
  readonly entrySequence: number;
  /** Fixed positions owned (1..N). Every position of the bar must have exactly one owner. */
  readonly positions: readonly number[];
  readonly movementBalance: number;
  readonly autoAction: AutoAction;
}

export interface SeatState extends ParticipantSeatV2 {
  /** Movements that EXPIRED at completion (DECISION-04). 0 while RUNNING. */
  readonly movementsExpired: number;
}

/**
 * One participant's action inside one collective round window (DECISION-16).
 * `actionId` is server-issued, one per (round, participant); `resolutionSequence`
 * is the position of this action in the resolution of its round (T-32).
 * Supplied by the application layer; the engine never reads a clock.
 */
export interface RoundActionContext {
  readonly actionId: string;
  readonly round: number;
  readonly resolutionSequence: number;
  /** UTC ISO-8601, from the server clock - never from the client (BR-025). */
  readonly serverTime: string;
}

export interface MovementCommandV2 extends RoundActionContext {
  readonly participantId: string;
  readonly kind: SorteDirection;
  /** MANUAL: >= 1 (STAY: exactly 1), capped by maxMovementsPerRound. AUTOMATIC: always exactly 1. */
  readonly credits: number;
  readonly executionType: ExecutionType;
}

export interface SkipActionInput extends RoundActionContext {
  readonly participantId: string;
}

export interface CompleteInput {
  readonly serverTime: string;
}

export interface GameInitInput {
  readonly config: GameConfigV2;
  readonly participants: readonly ParticipantSeatV2[];
  /** Hash of the randomness commitment published before N was known (ADR-025). */
  readonly randomnessCommitmentHash: string;
  /** Derived from committed randomness by the caller (distribution: T-13). */
  readonly initialSortePosition: number;
}

export interface GameStateV2 {
  readonly engineVersion: typeof ENGINE_V2_VERSION;
  readonly config: GameConfigV2;
  readonly size: number;
  readonly status: GameStatus;
  readonly sortePosition: number;
  readonly seats: readonly SeatState[];
  readonly consumedActionIds: readonly string[];
  readonly sequence: number;
  /** Head of the hash chain (genesis hash until the first transition). */
  readonly stateHash: string;
}

interface TransitionBase {
  readonly sequence: number;
  readonly serverTime: string;
  readonly sorteBefore: number;
  readonly sorteAfter: number;
  readonly previousStateHash: string;
  readonly currentStateHash: string;
  readonly engineVersion: typeof ENGINE_V2_VERSION;
}

export interface MovementTransition extends TransitionBase {
  readonly outcome: "APPLIED";
  readonly command: MovementCommandV2;
  readonly creditsConsumed: number;
  readonly creditsRemainingAfter: number;
}

export interface SkipTransition extends TransitionBase {
  readonly outcome: "SKIPPED";
  readonly command: null;
  readonly action: RoundActionContext & { readonly participantId: string };
  readonly skipReason: SkipReason;
  readonly creditsConsumed: 0;
  readonly creditsRemainingAfter: number;
}

export interface CompleteTransition extends TransitionBase {
  readonly outcome: "COMPLETED";
  readonly expired: readonly { readonly participantId: string; readonly movements: number }[];
}

export type Transition = MovementTransition | SkipTransition | CompleteTransition;

export interface TransitionResult<T extends Transition = Transition> {
  readonly state: GameStateV2;
  readonly transition: T;
}

export type AbsentActionPlan =
  | { readonly action: "AUTOMATIC"; readonly kind: SorteDirection; readonly credits: 1 }
  | { readonly action: "SKIP"; readonly reason: SkipReason };

export interface GameResultV2 {
  readonly sortePosition: number;
  readonly winningPositions: readonly number[];
  readonly winners: readonly {
    readonly participantId: string;
    readonly winningPositions: readonly number[];
  }[];
  readonly finalStateHash: string;
}

export type ReplayStep =
  | { readonly type: "MOVEMENT"; readonly command: MovementCommandV2 }
  | { readonly type: "SKIP"; readonly input: SkipActionInput }
  | { readonly type: "COMPLETE"; readonly input: CompleteInput };

export interface GameReplayInputV2 {
  readonly init: GameInitInput;
  readonly steps: readonly ReplayStep[];
  /** When given, every recomputed hash must match the stored transitions (audit). */
  readonly expectedTransitions?: readonly Transition[];
}

export interface GameReplayOutputV2 {
  readonly state: GameStateV2;
  readonly transitions: readonly Transition[];
  /** null while the game has not been completed. */
  readonly result: GameResultV2 | null;
}
