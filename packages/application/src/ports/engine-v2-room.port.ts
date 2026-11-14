import type { GameRoom, gameV2 } from "@passasorte/domain";
import type { PublishOutboxEventInput } from "./outbox.port.js";

/** A CONFIRMED participation as the start of an Engine V2 room sees it. */
export interface RoomStartSeat {
  readonly participationId: string;
  /** Assigned when the participation was confirmed (DECISION-08); null = not assigned yet. */
  readonly entrySequence: number | null;
  readonly positions: readonly number[];
  readonly movementAllowance: number;
  readonly autoAction: gameV2.AutoAction;
}

export interface CommitRoomStartInput {
  readonly roomId: string;
  readonly startedAt: Date;
  readonly config: gameV2.GameConfigV2;
  readonly initialSorte: gameV2.InitialSorteRecord;
  readonly schedule: readonly gameV2.RoundScheduleEntry[];
  readonly participationIds: readonly string[];
  readonly events: readonly PublishOutboxEventInput[];
}

/**
 * Atomic start of an Engine V2 room (TASK-106). `commitStart` runs in ONE transaction:
 * re-checks the room is READY (ConflictError otherwise), freezes the config
 * (BR-024), creates the initial Sorte and every
 * `game_rounds` window, moves the room to RUNNING and the participations to ACTIVE.
 */
export interface EngineV2StartPort {
  /** The seed sealed when the position selection started (TASK-075); null if it never ran. */
  loadSealedSeed(roomId: string): Promise<{ seedHex: string; commitmentHash: string } | null>;
  listConfirmedSeats(roomId: string): Promise<readonly RoomStartSeat[]>;
  commitStart(input: CommitRoomStartInput): Promise<GameRoom>;
}

export interface DueRound {
  readonly roundId: string;
  readonly roomId: string;
  readonly roundNo: number;
}

export interface ResolutionSeat {
  readonly participationId: string;
  readonly entrySequence: number;
  readonly positions: readonly number[];
  readonly movementAllowanceTotal: number;
  readonly autoAction: gameV2.AutoAction;
}

export interface RoundResolutionContext {
  readonly round: {
    readonly id: string;
    readonly roomId: string;
    readonly roundNo: number;
    readonly windowOpensAt: Date;
    readonly windowClosesAt: Date;
    readonly isLast: boolean;
  };
  readonly config: gameV2.GameConfigV2;
  readonly initialSorte: gameV2.InitialSorteRecord;
  readonly seats: readonly ResolutionSeat[];
  /** Every step of the rounds already resolved, in order. */
  readonly priorSteps: readonly gameV2.ReplayStep[];
  /** All stored submissions of this round; participantId = participationId. */
  readonly submissions: readonly gameV2.StoredSubmission[];
}

export interface CommitRoundResolutionInput {
  readonly roundId: string;
  readonly resolutionStartedAt: Date;
  readonly resolution: gameV2.RoundResolution;
  /** Present only for the last round: completion + result in the same transaction. */
  readonly completion: {
    readonly step: gameV2.ReplayStep;
    readonly transition: gameV2.CompleteTransition;
    readonly result: gameV2.GameResultV2;
  } | null;
  readonly events: readonly PublishOutboxEventInput[];
}

/**
 * Round resolution (TASK-106). `commitResolution` runs in one transaction that locks
 * the round: if it is already RESOLVED nothing is written (`alreadyResolved: true`),
 * so two workers can never resolve the same round twice.
 */
export interface EngineV2ResolutionPort {
  findDueRounds(now: Date, limit: number): Promise<readonly DueRound[]>;
  /** null when the round does not exist or was already resolved. */
  loadResolutionContext(roundId: string): Promise<RoundResolutionContext | null>;
  commitResolution(
    input: CommitRoundResolutionInput,
  ): Promise<{ readonly alreadyResolved: boolean }>;
}
