import type { gameV2 } from "@passasorte/domain";

export interface GameRoundInfo {
  readonly roundNo: number;
  readonly windowOpensAt: Date;
  readonly windowClosesAt: Date;
  readonly resolved: boolean;
}

/** Everything needed to rebuild the live state of a running V2 room (read-only). */
export interface RoomGameData {
  readonly config: gameV2.GameConfigV2;
  readonly initialSorte: gameV2.InitialSorteRecord;
  readonly seats: readonly {
    readonly participationId: string;
    readonly entrySequence: number;
    readonly positions: readonly number[];
    readonly movementAllowanceTotal: number;
    readonly autoAction: gameV2.AutoAction;
  }[];
  /** Steps of every resolved round, in order. */
  readonly steps: readonly gameV2.ReplayStep[];
  readonly rounds: readonly GameRoundInfo[];
}

export interface LatestSubmission {
  readonly kind: gameV2.SorteDirection;
  readonly credits: number;
  readonly roundNo: number;
}

/** DECISION-32/34: how the participant's positions were chosen; null while they are still pending. */
export interface SelectionWindowInfo {
  readonly type: "MANUAL" | "AUTOMATIC";
  readonly windowOpenedAt: Date;
  readonly windowClosesAt: Date;
  readonly completedAt: Date;
}

/** Read side of the participant's live game (TASK-075 follow-up, mobile). */
export interface ParticipantGameStatePort {
  /** null when the room never started Engine V2. */
  loadRoomGameData(roomId: string): Promise<RoomGameData | null>;
  loadLatestSubmission(
    roomId: string,
    roundNo: number,
    participationId: string,
  ): Promise<LatestSubmission | null>;
  loadSelectionWindow(participationId: string): Promise<SelectionWindowInfo | null>;
  /** Only meaningful once the game completed; null before. */
  loadFinalResult(roomId: string): Promise<{ readonly winningPositions: readonly number[] } | null>;
}
