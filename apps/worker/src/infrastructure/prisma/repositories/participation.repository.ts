/**
 * Mirrors apps/api/src/infrastructure/prisma/repositories/participation.repository.ts.
 * See apps/worker/README.md for why this is duplicated rather than shared.
 */
import {
  FinalMovementPlanAlreadyLockedError,
  type FinalMovementPlan,
  type MovementAllocation,
  type MovementCommand,
  type Participation,
  type ParticipationStatus,
} from "@passasorte/domain";
import type { ParticipationRepository } from "@passasorte/application";
import type { Prisma, Participation as PrismaParticipation, PrismaClient } from "@prisma/client";

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

export class PrismaParticipationRepository implements ParticipationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Participation | null> {
    const row = await this.prisma.participation.findUnique({ where: { id } });
    return row ? toDomainParticipation(row) : null;
  }

  create(): Promise<Participation> {
    throw new Error("PrismaParticipationRepository.create não é usado pelo worker.");
  }

  async transition(id: string, status: ParticipationStatus): Promise<Participation> {
    const row = await this.prisma.participation.update({ where: { id }, data: { status } });
    return toDomainParticipation(row);
  }

  countActiveByUserAndRoom(): Promise<number> {
    throw new Error(
      "PrismaParticipationRepository.countActiveByUserAndRoom não é usado pelo worker.",
    );
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
      data: { finalMovementPlan: plan as unknown as Prisma.InputJsonValue, status: "LOCKED" },
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
