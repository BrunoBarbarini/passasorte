import { assertRoomTransition, commitRandomSeed, generateRandomSeed } from "@passasorte/domain";
import type { GameRoom } from "@passasorte/domain";
import type { RoomRepository } from "../../ports/room-repository.port.js";
import type { PositionSelectionPort } from "../../ports/position-selection.port.js";
import { DomainError, NotFoundError, ValidationError } from "../../errors.js";
import { buildSelectionState, toValidationError } from "./position-selection.shared.js";

export interface StartPositionSelectionInput {
  readonly roomId: string;
  /** Chosen by the operator per room; no default exists (T-14, BR-068). */
  readonly pickWindowMs: number;
}

/**
 * ENTRY_LOCKED -> POSITION_SELECTION (TASK-075). The board size is the sum of the position
 * credits of the CONFIRMED participations (DECISION-10) and never changes afterwards
 * (DECISION-11). The randomness seed is sealed here, before any position is chosen, because
 * absent pickers are allocated from it (BR-053). Known gap (ADR-025): it is still sealed
 * after the board size is known.
 */
export class StartPositionSelectionUseCase {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly selection: PositionSelectionPort,
    private readonly clock: () => Date = () => new Date(),
    private readonly newSeed: () => string = generateRandomSeed,
  ) {}

  async execute(input: StartPositionSelectionInput): Promise<GameRoom> {
    if (!Number.isSafeInteger(input.pickWindowMs) || input.pickWindowMs < 1) {
      throw new ValidationError("O tempo de cada escolha deve ser um número inteiro positivo.", {
        field: "pickWindowMs",
      });
    }
    const room = await this.rooms.findById(input.roomId);
    if (!room) throw new NotFoundError("GameRoom", input.roomId);
    if (room.status !== "ENTRY_LOCKED") {
      throw new DomainError(
        "A sala precisa estar com as entradas travadas para iniciar a seleção.",
      );
    }
    assertRoomTransition(room.status, "POSITION_SELECTION");

    const snapshot = await this.selection.loadSnapshot(room.id);
    let boardSize: number;
    try {
      boardSize = buildSelectionState(room, snapshot).size;
    } catch (error) {
      throw toValidationError(error);
    }

    const seedHex = this.newSeed();
    return this.selection.commitSelectionStart({
      roomId: room.id,
      pickWindowMs: input.pickWindowMs,
      boardSize,
      startedAt: this.clock(),
      seedHex,
      commitmentHash: commitRandomSeed(seedHex).commitmentHash,
      events: [
        {
          aggregateType: "GameRoom",
          aggregateId: room.id,
          eventType: "selection.started",
          payload: { roomId: room.id, boardSize, pickWindowMs: input.pickWindowMs },
        },
      ],
    });
  }
}
