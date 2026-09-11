import {
  assertValidHoldPolicy,
  type HoldPolicy,
  type Position,
  type PositionHold,
} from "@passasorte/domain";
import type { PositionHoldRepository } from "../../ports/position-hold-repository.port.js";
import type { RoomRepository } from "../../ports/room-repository.port.js";
import { ConflictError, NotFoundError, ValidationError } from "../../errors.js";

export interface HoldPositionsCommand {
  roomId: string;
  positions: readonly Position[];
  holderRef: string;
  holdPolicy: HoldPolicy;
  now?: Date;
}

/**
 * FR-022..FR-024: authoritative, atomic position holds. Each position is
 * held independently via the repository's atomic `tryHold` (BR-010); if
 * any position in the batch is already held, everything already
 * acquired in this call is released so the caller never ends up with a
 * partial, inconsistent set of holds.
 */
export class HoldPositionsUseCase {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly holdRepository: PositionHoldRepository,
  ) {}

  async execute(command: HoldPositionsCommand): Promise<readonly PositionHold[]> {
    if (command.positions.length === 0) {
      throw new ValidationError("É necessário selecionar ao menos uma posição.", {
        field: "positions",
      });
    }
    assertValidHoldPolicy(command.holdPolicy);

    const room = await this.roomRepository.findById(command.roomId);
    if (!room) {
      throw new NotFoundError("GameRoom", command.roomId);
    }
    if (room.status !== "OPEN") {
      throw new ConflictError(
        `A sala "${room.id}" não está aberta para novas reservas de posição.`,
      );
    }

    const now = command.now ?? new Date();
    const expiresAt = new Date(now.getTime() + command.holdPolicy.ttlMs);

    const acquired: PositionHold[] = [];
    for (const position of command.positions) {
      const hold = await this.holdRepository.tryHold({
        roomId: command.roomId,
        position,
        holderRef: command.holderRef,
        now,
        expiresAt,
      });
      if (!hold) {
        for (const previouslyAcquired of acquired) {
          await this.holdRepository.release(previouslyAcquired.id);
        }
        throw new ConflictError(`A posição ${position} já está reservada.`);
      }
      acquired.push(hold);
    }

    return acquired;
  }
}
