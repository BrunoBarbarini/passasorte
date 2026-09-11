import { Injectable } from "@nestjs/common";
import type {
  MovementAllocation,
  Participation,
  ParticipationStatus,
} from "@passasorte/domain";
import type {
  CreateParticipationInput,
  ParticipationRepository,
} from "@passasorte/application";
import type { Participation as PrismaParticipation } from "@prisma/client";
import { PrismaService } from "../prisma.service.js";

function toDomainParticipation(row: PrismaParticipation): Participation {
  return {
    id: row.id,
    roomId: row.roomId,
    userId: row.userId,
    packageId: row.packageId,
    positions: row.positions.map((position) => ({ participationId: row.id, position })),
    status: row.status,
    movementAllowanceTotal: row.movementAllowanceTotal,
    movementAllowanceUsed: row.movementAllowanceUsed,
    createdAt: row.createdAt,
  };
}

/**
 * "Active" for BR-007-style eligibility counting (countActiveByUserAndRoom)
 * is ASSUMPTION: everything except a fully COMPLETED participation — the
 * concrete participation-limit rule itself is still TBD (CLAUDE.md #56),
 * this method only supplies the raw count a rule would need.
 */
const NON_ACTIVE_STATUSES: ParticipationStatus[] = ["COMPLETED"];

@Injectable()
export class PrismaParticipationRepository implements ParticipationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Participation | null> {
    const row = await this.prisma.participation.findUnique({ where: { id } });
    return row ? toDomainParticipation(row) : null;
  }

  async create(input: CreateParticipationInput): Promise<Participation> {
    const row = await this.prisma.participation.create({
      data: {
        roomId: input.roomId,
        userId: input.userId,
        packageId: input.packageId,
        positions: [...input.positions],
        movementAllowanceTotal: input.movementAllowance,
      },
    });
    return toDomainParticipation(row);
  }

  async transition(id: string, status: ParticipationStatus): Promise<Participation> {
    const row = await this.prisma.participation.update({ where: { id }, data: { status } });
    return toDomainParticipation(row);
  }

  async countActiveByUserAndRoom(userId: string, roomId: string): Promise<number> {
    return this.prisma.participation.count({
      where: { userId, roomId, status: { notIn: NON_ACTIVE_STATUSES } },
    });
  }

  async updateMovementAllocation(id: string, allocation: MovementAllocation): Promise<Participation> {
    const row = await this.prisma.participation.update({
      where: { id },
      data: {
        movementAllowanceTotal: allocation.totalAllowance,
        movementAllowanceUsed: allocation.usedCount,
      },
    });
    return toDomainParticipation(row);
  }

  async listByUserAndRoom(userId: string, roomId: string): Promise<readonly Participation[]> {
    const rows = await this.prisma.participation.findMany({
      where: { userId, roomId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDomainParticipation);
  }
}
