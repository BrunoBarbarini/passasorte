/**
 * Mirrors apps/api/src/infrastructure/prisma/repositories/room.repository.ts
 * (same RoomRepository adapter, minus the NestJS @Injectable wrapper —
 * the worker is a standalone process). Keep the two in sync; see
 * apps/worker/README.md for why this is duplicated rather than shared.
 */
import type {
  GameConfigSnapshot,
  GameRoom,
  ParticipationPackage,
  RoomOperationsConfig,
  RoomStatus,
} from "@passasorte/domain";
import type { RoomRepository } from "@passasorte/application";
import type { GameRoom as PrismaGameRoom, PrismaClient } from "@prisma/client";
import { resolveEligibilityRules } from "../../eligibility/eligibility-rule-registry.js";

interface StoredParticipationPackage {
  id: string;
  positionCount: number;
  movementAllowance: number;
  eligibilityRuleIds: string[];
  priceMinorUnits?: number;
}

function toDomainPackage(stored: StoredParticipationPackage): ParticipationPackage {
  return {
    id: stored.id,
    positionCount: stored.positionCount,
    movementAllowance: stored.movementAllowance,
    eligibilityRules: resolveEligibilityRules(stored.eligibilityRuleIds ?? []),
    priceMinorUnits: stored.priceMinorUnits,
  };
}

function toDomainRoom(row: PrismaGameRoom): GameRoom {
  return {
    id: row.id,
    campaignId: row.campaignId,
    capacity: row.capacity,
    gameConfig: row.gameConfig as unknown as GameConfigSnapshot,
    holdTtlMs: row.holdTtlMs,
    participationPackages: (
      row.participationPackages as unknown as StoredParticipationPackage[]
    ).map(toDomainPackage),
    operationsConfig: row.operationsConfig as unknown as RoomOperationsConfig,
    status: row.status,
    createdAt: row.createdAt,
    finalLockedAt: row.finalLockedAt,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason,
  };
}

export class PrismaRoomRepository implements RoomRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<GameRoom | null> {
    const row = await this.prisma.gameRoom.findUnique({ where: { id } });
    return row ? toDomainRoom(row) : null;
  }

  // The worker never creates rooms — only apps/api's backoffice does —
  // but the port requires this method to exist on any implementation.
  create(): Promise<GameRoom> {
    throw new Error("PrismaRoomRepository.create não é usado pelo worker.");
  }

  async transition(id: string, status: RoomStatus, at: Date): Promise<GameRoom> {
    const row = await this.prisma.gameRoom.update({
      where: { id },
      data: {
        status,
        cancelledAt: status === "CANCELLED" ? at : undefined,
        finalLockedAt: status === "FINAL_LOCK" ? at : undefined,
      },
    });
    return toDomainRoom(row);
  }

  async listByCampaignId(campaignId: string): Promise<readonly GameRoom[]> {
    const rows = await this.prisma.gameRoom.findMany({
      where: { campaignId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDomainRoom);
  }

  async listByStatus(status: RoomStatus): Promise<readonly GameRoom[]> {
    const rows = await this.prisma.gameRoom.findMany({ where: { status } });
    return rows.map(toDomainRoom);
  }
}
