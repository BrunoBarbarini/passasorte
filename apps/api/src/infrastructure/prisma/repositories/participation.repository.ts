import { Injectable } from "@nestjs/common";
import {
  FinalMovementPlanAlreadyLockedError,
  type FinalMovementPlan,
  type MovementAllocation,
  type MovementCommand,
  type Participation,
  type ParticipationStatus,
} from "@passasorte/domain";
import type { CreateParticipationInput, ParticipationRepository } from "@passasorte/application";
import type { Prisma, Participation as PrismaParticipation } from "@prisma/client";
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

  async updateMovementAllocation(
    id: string,
    allocation: MovementAllocation,
  ): Promise<Participation> {
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

  async listByRoomId(roomId: string): Promise<readonly Participation[]> {
    const rows = await this.prisma.participation.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDomainParticipation);
  }

  async appendMovementCommand(roomId: string, command: MovementCommand): Promise<void> {
    await this.prisma.movementCommandLog.create({
      data: {
        roomId,
        participationId: command.participationId,
        positionIndex: command.positionIndex,
        direction: command.direction,
        sequence: command.sequence,
      },
    });
  }

  async listMovementCommandsForRoom(roomId: string): Promise<readonly MovementCommand[]> {
    const rows = await this.prisma.movementCommandLog.findMany({
      where: { roomId },
      orderBy: { sequence: "asc" },
    });
    return rows.map((row) => ({
      participationId: row.participationId,
      positionIndex: row.positionIndex,
      direction: row.direction as MovementCommand["direction"],
      sequence: row.sequence,
    }));
  }

  async lockFinalMovementPlan(
    participationId: string,
    plan: FinalMovementPlan,
  ): Promise<Participation> {
    const existing = await this.prisma.participation.findUnique({ where: { id: participationId } });
    if (!existing) {
      throw new Error(`Participation "${participationId}" não encontrada.`);
    }
    if (existing.finalMovementPlan !== null) {
      throw new FinalMovementPlanAlreadyLockedError(participationId);
    }
    const row = await this.prisma.participation.update({
      where: { id: participationId },
      data: {
        finalMovementPlan: plan as unknown as Prisma.InputJsonValue,
        status: "LOCKED",
      },
    });
    return toDomainParticipation(row);
  }

  async findFinalMovementPlan(participationId: string): Promise<FinalMovementPlan | null> {
    const row = await this.prisma.participation.findUnique({ where: { id: participationId } });
    if (!row?.finalMovementPlan) {
      return null;
    }
    return row.finalMovementPlan as unknown as FinalMovementPlan;
  }
}
