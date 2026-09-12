import {
  assertParticipationTransition,
  assertRoomTransition,
  commitRandomSeed,
  generateRandomSeed,
  type GameRoom,
} from "@passasorte/domain";
import type { RoomRepository } from "../../ports/room-repository.port.js";
import type { ParticipationRepository } from "../../ports/participation-repository.port.js";
import type { GameRunRepository } from "../../ports/game-run-repository.port.js";
import { NotFoundError } from "../../errors.js";

export interface StartRoomCommand {
  roomId: string;
  now?: Date;
}

/**
 * ENTRY_LOCKED -> RUNNING. BR-030/BR-031: the randomness seed for this
 * room's round is generated and cryptographically committed HERE, before
 * any movement can happen or any result exists — the commitment record
 * is persisted immediately (GameRunRepository.create) so a later
 * resolution (AdvanceRoomOperationsUseCase) can prove the SAME seed was
 * used (BR-031: an administrator cannot swap it after the fact) rather
 * than merely asserting fairness.
 *
 * Every CONFIRMED participation in the room becomes ACTIVE at this point
 * — a mechanical consequence of "the room is now running" (CONFIRMED ->
 * ACTIVE is the only transition CLAUDE.md's participation state machine
 * defines from CONFIRMED), not an invented business rule.
 */
export class StartRoomUseCase {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly participationRepository: ParticipationRepository,
    private readonly gameRunRepository: GameRunRepository,
  ) {}

  async execute(command: StartRoomCommand): Promise<GameRoom> {
    const room = await this.roomRepository.findById(command.roomId);
    if (!room) {
      throw new NotFoundError("GameRoom", command.roomId);
    }
    assertRoomTransition(room.status, "RUNNING");

    const seed = generateRandomSeed();
    const commitment = commitRandomSeed(seed);
    await this.gameRunRepository.create({
      roomId: room.id,
      engineVersion: room.gameConfig.engineVersion,
      commitment,
      seed,
    });

    const transitioned = await this.roomRepository.transition(
      command.roomId,
      "RUNNING",
      command.now ?? new Date(),
    );

    const participations = await this.participationRepository.listByRoomId(room.id);
    for (const participation of participations) {
      if (participation.status !== "CONFIRMED") continue;
      assertParticipationTransition(participation.status, "ACTIVE");
      await this.participationRepository.transition(participation.id, "ACTIVE");
    }

    return transitioned;
  }
}
