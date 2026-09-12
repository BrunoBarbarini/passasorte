import { assertRoomTransition, type GameRoom } from "@passasorte/domain";
import type { RoomRepository } from "../../ports/room-repository.port.js";
import { NotFoundError } from "../../errors.js";

export interface LockRoomEntriesCommand {
  roomId: string;
  now?: Date;
}

/**
 * OPEN -> ENTRY_LOCKED (CLAUDE.md #7 room state machine). Like Campaign's
 * transitions, this is an explicit operator action (no backlog task asks
 * for an auto-lock-on-capacity behavior, so none is invented) — the
 * automatic side of Phase 5 (TASK-034) only covers RUNNING onward, where
 * the trigger conditions ARE already decided (see
 * AdvanceRoomOperationsUseCase).
 */
export class LockRoomEntriesUseCase {
  constructor(private readonly roomRepository: RoomRepository) {}

  async execute(command: LockRoomEntriesCommand): Promise<GameRoom> {
    const room = await this.roomRepository.findById(command.roomId);
    if (!room) {
      throw new NotFoundError("GameRoom", command.roomId);
    }
    assertRoomTransition(room.status, "ENTRY_LOCKED");
    return this.roomRepository.transition(
      command.roomId,
      "ENTRY_LOCKED",
      command.now ?? new Date(),
    );
  }
}
