import {
  assertValidGameConfigSnapshot,
  assertValidHoldPolicy,
  assertValidParticipationPackages,
  assertValidRoomCapacity,
  assertValidRoomOperationsConfig,
  type GameConfigSnapshot,
  type GameRoom,
  type ParticipationPackage,
  type RoomOperationsConfig,
} from "@passasorte/domain";
import type { RoomRepository } from "../../ports/room-repository.port.js";

export interface CreateRoomCommand {
  campaignId: string;
  capacity: number;
  gameConfig: GameConfigSnapshot;
  holdTtlMs: number;
  participationPackages: readonly ParticipationPackage[];
  operationsConfig: RoomOperationsConfig;
}

/**
 * TASK-024 Room Domain, operational side: opens a new room under a
 * campaign. Every business-sensitive value here (capacity, hold TTL,
 * game config, packages, operations pacing) is validated structurally
 * but never defaulted — the caller (an operator via the backoffice) must
 * supply all of it, per CLAUDE.md #58.
 */
export class CreateRoomUseCase {
  constructor(private readonly roomRepository: RoomRepository) {}

  async execute(command: CreateRoomCommand): Promise<GameRoom> {
    assertValidRoomCapacity(command.capacity);
    assertValidGameConfigSnapshot(command.gameConfig);
    assertValidHoldPolicy({ ttlMs: command.holdTtlMs });
    assertValidParticipationPackages(command.participationPackages);
    assertValidRoomOperationsConfig(command.operationsConfig);

    return this.roomRepository.create({
      campaignId: command.campaignId,
      capacity: command.capacity,
      gameConfig: command.gameConfig,
      holdTtlMs: command.holdTtlMs,
      participationPackages: command.participationPackages,
      operationsConfig: command.operationsConfig,
    });
  }
}
