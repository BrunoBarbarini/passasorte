import type { GameRoom } from "@passasorte/domain";
import type { PublishOutboxEventInput } from "./outbox.port.js";

/** A CONFIRMED participation waiting to choose its positions (TASK-075). */
export interface SelectionEntry {
  readonly participationId: string;
  /** Pick priority (DECISION-08); null = not assigned yet, which blocks the selection. */
  readonly entrySequence: number | null;
  readonly packageId: string;
}

export interface SelectionAssignment {
  readonly participationId: string;
  readonly positions: readonly number[];
  readonly pickedAt: Date;
  readonly kind: "MANUAL" | "AUTOMATIC";
}

export interface SelectionSnapshot {
  readonly entries: readonly SelectionEntry[];
  readonly assignments: readonly SelectionAssignment[];
}

export interface CommitSelectionStartInput {
  readonly roomId: string;
  readonly pickWindowMs: number;
  readonly boardSize: number;
  readonly startedAt: Date;
  readonly seedHex: string;
  readonly commitmentHash: string;
  readonly events: readonly PublishOutboxEventInput[];
}

export interface CommitPickInput {
  readonly roomId: string;
  readonly participationId: string;
  readonly positions: readonly number[];
  readonly kind: "MANUAL" | "AUTOMATIC";
  readonly pickedAt: Date;
  /** Optimistic guard: how many participations had already picked when the caller decided. */
  readonly expectedPickCount: number;
  readonly events: readonly PublishOutboxEventInput[];
}

/**
 * Position selection (TASK-075, DECISION-07..11). Every write is one transaction that
 * locks the room row. `UNIQUE(room_id, position)` is the final guard of BR-010: even a
 * bug above this port cannot give one position to two participations.
 */
export interface PositionSelectionPort {
  loadSnapshot(roomId: string): Promise<SelectionSnapshot>;
  /** ENTRY_LOCKED -> POSITION_SELECTION: stores the settings and the sealed seed (ConflictError otherwise). */
  commitSelectionStart(input: CommitSelectionStartInput): Promise<GameRoom>;
  loadSealedSeed(roomId: string): Promise<{ seedHex: string; commitmentHash: string } | null>;
  /**
   * Stores one pick and writes the positions on the participation. When it is the last
   * pick the room becomes READY in the same transaction. ConflictError if the room is not
   * in POSITION_SELECTION or `expectedPickCount` is stale (someone else picked first).
   */
  commitPick(input: CommitPickInput): Promise<{ readonly completed: boolean }>;
  listRoomIdsInSelection(): Promise<readonly string[]>;
}
