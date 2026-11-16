import { gameV2, type GameRoom } from "@passasorte/domain";
import type { SelectionSnapshot } from "../../ports/position-selection.port.js";
import type { PublishOutboxEventInput } from "../../ports/outbox.port.js";
import { ValidationError } from "../../errors.js";

/** Builds the pure selection state (domain) from a room and what the database holds. */
export function buildSelectionState(
  room: GameRoom,
  snapshot: SelectionSnapshot,
): gameV2.PositionSelectionState {
  const entries = snapshot.entries.map((entry) => {
    const pkg = room.participationPackages.find((candidate) => candidate.id === entry.packageId);
    if (!pkg) {
      throw new ValidationError("O pacote da participação não existe mais na sala.", {
        participationId: entry.participationId,
      });
    }
    if (entry.entrySequence === null) {
      throw new ValidationError("Há participação confirmada sem ordem de entrada atribuída.", {
        participationId: entry.participationId,
      });
    }
    return {
      participantId: entry.participationId,
      entrySequence: entry.entrySequence,
      positionCredits: pkg.positionCount,
      movementCredits: pkg.movementAllowance,
      autoAction: "NONE" as const,
    };
  });
  const base = gameV2.createPositionSelection(entries);
  const picks = [...snapshot.assignments]
    .sort((a, b) => a.pickedAt.getTime() - b.pickedAt.getTime())
    .map((assignment) => ({
      participantId: assignment.participationId,
      positions: assignment.positions,
    }));
  return { ...base, picks };
}

export interface PickWindow {
  readonly openedAt: Date;
  readonly closesAt: Date;
}

/**
 * DECISION-24/33: a participant's window opens when the previous pick (manual or automatic) is
 * committed, or when the selection starts, and lasts `pickWindowMs` on the server clock.
 */
export function currentPickWindow(room: GameRoom, snapshot: SelectionSnapshot): PickWindow {
  const config = room.positionSelection;
  if (!config) throw new ValidationError("A sala não tem a fase de seleção configurada.");
  const openedAtMs = snapshot.assignments.reduce(
    (max, assignment) => Math.max(max, assignment.pickedAt.getTime()),
    Date.parse(config.startedAt),
  );
  return { openedAt: new Date(openedAtMs), closesAt: new Date(openedAtMs + config.pickWindowMs) };
}

export function currentPickDeadline(room: GameRoom, snapshot: SelectionSnapshot): Date {
  return currentPickWindow(room, snapshot).closesAt;
}

/** DECISION-34 analytics/notification event: the next participant's window just opened. */
export function windowOpenedEvents(
  room: GameRoom,
  snapshot: SelectionSnapshot,
  state: gameV2.PositionSelectionState,
  openedAt: Date,
): PublishOutboxEventInput[] {
  const config = room.positionSelection;
  const picker = gameV2.currentPicker(state);
  if (!picker || !config) return [];
  const entry = snapshot.entries.find(
    (candidate) => candidate.participationId === picker.participantId,
  );
  if (!entry) return [];
  return [
    {
      aggregateType: "Participation",
      aggregateId: picker.participantId,
      eventType: "position_selection.window_opened",
      payload: {
        userId: entry.userId,
        roomId: room.id,
        campaignId: room.campaignId,
        participationId: picker.participantId,
        entrySequence: picker.entrySequence,
        positionCount: picker.positionCredits,
        opensAt: openedAt.toISOString(),
        closesAt: new Date(openedAt.getTime() + config.pickWindowMs).toISOString(),
      },
    },
  ];
}

/** Common payload of the events that report a closed window (DECISION-34, analytics properties). */
export function windowClosedPayload(input: {
  readonly room: GameRoom;
  readonly userId: string;
  readonly participationId: string;
  readonly entrySequence: number;
  readonly positions: readonly number[];
  readonly selectionType: "MANUAL" | "AUTOMATIC";
  readonly window: PickWindow;
  readonly completedAt: Date;
}): Record<string, unknown> {
  return {
    userId: input.userId,
    roomId: input.room.id,
    campaignId: input.room.campaignId,
    participationId: input.participationId,
    entrySequence: input.entrySequence,
    positionCount: input.positions.length,
    positions: [...input.positions],
    selectionType: input.selectionType,
    selectionDurationMs: input.completedAt.getTime() - input.window.openedAt.getTime(),
  };
}

export function toValidationError(error: unknown): unknown {
  if (error instanceof gameV2.GameEngineError) {
    return new ValidationError(error.message, { reason: error.code });
  }
  return error;
}
