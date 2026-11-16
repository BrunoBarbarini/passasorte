import {
  assertRoomTransition,
  commitRandomSeed,
  generateRandomSeed,
  type gameV2,
} from "@passasorte/domain";
import type { GameRoom } from "@passasorte/domain";
import type { RoomRepository } from "../../ports/room-repository.port.js";
import type { PositionSelectionPort } from "../../ports/position-selection.port.js";
import { DomainError, NotFoundError, ValidationError } from "../../errors.js";
import { validatePositionSelectionConfig } from "../room/validate-position-selection-config.js";
import {
  buildSelectionState,
  toValidationError,
  windowOpenedEvents,
} from "./position-selection.shared.js";

export interface StartPositionSelectionInput {
  readonly roomId: string;
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
    const room = await this.rooms.findById(input.roomId);
    if (!room) throw new NotFoundError("GameRoom", input.roomId);
    if (room.status !== "ENTRY_LOCKED") {
      throw new DomainError(
        "A sala precisa estar com as entradas travadas para iniciar a seleção.",
      );
    }
    assertRoomTransition(room.status, "POSITION_SELECTION");

    // DECISION-23: the window is the room's own setting; there is no default (BR-068).
    const config = room.positionSelectionConfig;
    if (!config) {
      throw new ValidationError(
        "Defina o tempo de escolha das posições da sala antes de iniciar a seleção.",
        { field: "positionSelectionConfig" },
      );
    }
    validatePositionSelectionConfig(config);
    const pickWindowMs = config.selectionWindowSeconds * 1000;

    const snapshot = await this.selection.loadSnapshot(room.id);
    let state: gameV2.PositionSelectionState;
    try {
      state = buildSelectionState(room, snapshot);
    } catch (error) {
      throw toValidationError(error);
    }
    const boardSize = state.size;
    const startedAt = this.clock();
    const firstWindow = windowOpenedEvents(
      {
        ...room,
        positionSelection: { pickWindowMs, startedAt: startedAt.toISOString(), boardSize },
      },
      snapshot,
      state,
      startedAt,
    );

    const seedHex = this.newSeed();
    return this.selection.commitSelectionStart({
      roomId: room.id,
      pickWindowMs,
      ...(config.warningThresholdSeconds
        ? { warningThresholdSeconds: config.warningThresholdSeconds }
        : {}),
      ...(config.upcomingTurnThresholds
        ? { upcomingTurnThresholds: config.upcomingTurnThresholds }
        : {}),
      boardSize,
      startedAt,
      seedHex,
      commitmentHash: commitRandomSeed(seedHex).commitmentHash,
      events: [
        {
          aggregateType: "GameRoom",
          aggregateId: room.id,
          eventType: "selection.started",
          payload: { roomId: room.id, boardSize, pickWindowMs },
        },
        ...firstWindow,
      ],
    });
  }
}
