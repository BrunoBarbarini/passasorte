import { gameV2, type GameRoom } from "@passasorte/domain";
import type { SelectionSnapshot } from "../../ports/position-selection.port.js";
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

/** The current turn ends `pickWindowMs` after the previous pick (or after the selection started). */
export function currentPickDeadline(room: GameRoom, snapshot: SelectionSnapshot): Date {
  const config = room.positionSelection;
  if (!config) throw new ValidationError("A sala não tem a fase de seleção configurada.");
  const last = snapshot.assignments.reduce(
    (max, assignment) => Math.max(max, assignment.pickedAt.getTime()),
    Date.parse(config.startedAt),
  );
  return new Date(last + config.pickWindowMs);
}

export function toValidationError(error: unknown): unknown {
  if (error instanceof gameV2.GameEngineError) {
    return new ValidationError(error.message, { reason: error.code });
  }
  return error;
}
