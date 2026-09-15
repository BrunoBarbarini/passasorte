import { assertRoomTransition, type GameRoom } from "@passasorte/domain";
import type { RoomRepository } from "../../ports/room-repository.port.js";
import { NotFoundError } from "../../errors.js";

export interface OpenRoomCommand {
  roomId: string;
  now?: Date;
}

/**
 * DRAFT -> OPEN (CLAUDE.md #7 room state machine). Explicit operator
 * action, same shape as LockRoomEntriesUseCase/StartRoomUseCase - the
 * state machine has always allowed this transition, but until the
 * backoffice E2E test of 15/09/2026 nothing in the codebase (no
 * endpoint, no scheduler trigger) ever performed it, so every room
 * created via the backoffice was permanently stuck at DRAFT. The
 * user's explicit decision (15/09/2026) was a manual operator action
 * ("Opcao 1"), not an automatic trigger tied to campaign publication -
 * that choice is what this use case encodes, nothing invented beyond it.
 */
export class OpenRoomUseCase {
  constructor(private readonly roomRepository: RoomRepository) {}

  async execute(command: OpenRoomCommand): Promise<GameRoom> {
    const room = await this.roomRepository.findById(command.roomId);
    if (!room) {
      throw new NotFoundError("GameRoom", command.roomId);
    }
    assertRoomTransition(room.status, "OPEN");
    return this.roomRepository.transition(command.roomId, "OPEN", command.now ?? new Date());
  }
}
