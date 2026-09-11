import { Injectable } from "@nestjs/common";
import type {
  GameConfigSnapshot,
  GameRoom,
  ParticipationPackage,
  RoomStatus,
} from "@passasorte/domain";
import type { CreateRoomInput, RoomRepository } from "@passasorte/application";
import { Prisma, type GameRoom as PrismaGameRoom } from "@prisma/client";
import { PrismaService } from "../prisma.service.js";
import { resolveEligibilityRules } from "../../eligibility/eligibility-rule-registry.js";

/** Wire/DB shape of a package — see api-contract's ParticipationPackageInputSchema. */
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

function toStoredPackage(pkg: ParticipationPackage): StoredParticipationPackage {
  return {
    id: pkg.id,
    positionCount: pkg.positionCount,
    movementAllowance: pkg.movementAllowance,
    eligibilityRuleIds: pkg.eligibilityRules.map((rule) => rule.id),
    priceMinorUnits: pkg.priceMinorUnits,
  };
}

function toDomainRoom(row: PrismaGameRoom): GameRoom {
  return {
    id: row.id,
    campaignId: row.campaignId,
    capacity: row.capacity,
    gameConfig: row.gameConfig as unknown as GameConfigSnapshot,
    holdTtlMs: row.holdTtlMs,
    participationPackages: (row.participationPackages as unknown as StoredParticipationPackage[]).map(
      toDomainPackage,
    ),
    status: row.status,
    createdAt: row.createdAt,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason,
  };
}

@Injectable()
export class PrismaRoomRepository implements RoomRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<GameRoom | null> {
    const row = await this.prisma.gameRoom.findUnique({ where: { id } });
    return row ? toDomainRoom(row) : null;
  }

  async create(input: CreateRoomInput): Promise<GameRoom> {
    const row = await this.prisma.gameRoom.create({
      data: {
        campaignId: input.campaignId,
        capacity: input.capacity,
        gameConfig: input.gameConfig as unknown as Prisma.InputJsonValue,
        holdTtlMs: input.holdTtlMs,
        participationPackages: input.participationPackages.map(toStoredPackage) as unknown as Prisma.InputJsonValue,
      },
    });
    return toDomainRoom(row);
  }

  async transition(id: string, status: RoomStatus, at: Date): Promise<GameRoom> {
    const row = await this.prisma.gameRoom.update({
      where: { id },
      data: {
        status,
        cancelledAt: status === "CANCELLED" ? at : undefined,
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
}
