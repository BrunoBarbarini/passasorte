import { gameV2 } from "@passasorte/domain";
import type { ParticipationRepository } from "../../ports/participation-repository.port.js";
import type { RoomRepository } from "../../ports/room-repository.port.js";
import type { PositionSelectionPort } from "../../ports/position-selection.port.js";
import { DomainError, NotFoundError } from "../../errors.js";
import {
  buildSelectionState,
  currentPickDeadline,
  toValidationError,
} from "./position-selection.shared.js";

export interface PickPositionsInput {
  readonly participationId: string;
  readonly positions: readonly number[];
}

export interface PickPositionsResult {
  readonly positions: readonly number[];
  /** True when this was the last pick and the room is now READY. */
  readonly completed: boolean;
  /** True when the same choice had already been stored; nothing new was written. */
  readonly idempotentReplay: boolean;
}

/**
 * DECISION-07/08: the participant whose turn it is chooses EXACTLY the positions they bought,
 * on the server clock, before their turn expires. After the deadline only the server may
 * allocate (AutoAllocateExpiredPicksUseCase), never a late manual pick.
 */
export class PickPositionsUseCase {
  constructor(
    private readonly participations: ParticipationRepository,
    private readonly rooms: RoomRepository,
    private readonly selection: PositionSelectionPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: PickPositionsInput): Promise<PickPositionsResult> {
    const participation = await this.participations.findById(input.participationId);
    if (!participation) throw new NotFoundError("Participation", input.participationId);
    const room = await this.rooms.findById(participation.roomId);
    if (!room) throw new NotFoundError("GameRoom", participation.roomId);
    if (room.status !== "POSITION_SELECTION") {
      throw new DomainError("A sala não está na fase de escolha de posições.");
    }

    const snapshot = await this.selection.loadSnapshot(room.id);
    const mine = snapshot.assignments.find((a) => a.participationId === participation.id);
    if (mine) {
      const same =
        mine.positions.length === input.positions.length &&
        [...mine.positions].sort((a, b) => a - b).join() ===
          [...input.positions].sort((a, b) => a - b).join();
      if (same) return { positions: mine.positions, completed: false, idempotentReplay: true };
      throw new DomainError("Você já escolheu suas posições; elas não podem ser trocadas.");
    }

    const now = this.clock();
    if (now >= currentPickDeadline(room, snapshot)) {
      throw new DomainError(
        "O tempo desta escolha acabou; o servidor sorteia posições livres para quem não escolheu.",
      );
    }

    try {
      const state = buildSelectionState(room, snapshot);
      gameV2.pickPositions(state, participation.id, input.positions);
    } catch (error) {
      throw toValidationError(error);
    }

    const result = await this.selection.commitPick({
      roomId: room.id,
      participationId: participation.id,
      positions: [...input.positions].sort((a, b) => a - b),
      kind: "MANUAL",
      pickedAt: now,
      expectedPickCount: snapshot.assignments.length,
      events: [
        {
          aggregateType: "Participation",
          aggregateId: participation.id,
          eventType: "positions.picked",
          payload: { roomId: room.id, participationId: participation.id, kind: "MANUAL" },
        },
      ],
    });
    return {
      positions: [...input.positions].sort((a, b) => a - b),
      completed: result.completed,
      idempotentReplay: false,
    };
  }
}
