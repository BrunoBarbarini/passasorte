import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Position, PositionHold } from "@passasorte/domain";
import type { PositionHoldRepository, TryHoldInput } from "@passasorte/application";
import type { PositionHold as PrismaPositionHold } from "@prisma/client";
import { PrismaService } from "../prisma.service.js";

function toDomainHold(row: PrismaPositionHold): PositionHold {
  return {
    id: row.id,
    roomId: row.roomId,
    position: row.position,
    holderRef: row.holderRef,
    status: row.status,
    heldAt: row.heldAt,
    expiresAt: row.expiresAt,
  };
}

/**
 * BR-010: `tryHold` runs its check-then-write inside a SERIALIZABLE
 * transaction, which Postgres guarantees behaves as if it ran alone —
 * two concurrent callers racing for the same room+position can never
 * both observe "free" and both write; one of them gets a serialization
 * failure (Prisma error code P2034), which this adapter treats exactly
 * like "position unavailable" (returns null) rather than surfacing a
 * transient-retry error to the use case. The (roomId, position) unique
 * constraint is the second, defense-in-depth guarantee for the same
 * invariant.
 */
@Injectable()
export class PrismaPositionHoldRepository implements PositionHoldRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async tryHold(input: TryHoldInput): Promise<PositionHold | null> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.positionHold.findUnique({
            where: { roomId_position: { roomId: input.roomId, position: input.position } },
          });

          const isFree =
            !existing ||
            existing.status === "RELEASED" ||
            existing.status === "EXPIRED" ||
            (existing.status === "ACTIVE" && existing.expiresAt.getTime() <= input.now.getTime());

          if (!isFree) {
            return null;
          }

          const row = existing
            ? await tx.positionHold.update({
                where: { id: existing.id },
                data: {
                  holderRef: input.holderRef,
                  status: "ACTIVE",
                  heldAt: input.now,
                  expiresAt: input.expiresAt,
                },
              })
            : await tx.positionHold.create({
                data: {
                  roomId: input.roomId,
                  position: input.position,
                  holderRef: input.holderRef,
                  status: "ACTIVE",
                  heldAt: input.now,
                  expiresAt: input.expiresAt,
                },
              });
          return toDomainHold(row);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      // P2034: transaction failed due to a write conflict/serialization
      // failure — a concurrent caller won the race for this exact
      // position. Treat it the same as "not acquired", not as an
      // infrastructure error.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        return null;
      }
      throw error;
    }
  }

  async release(holdId: string): Promise<void> {
    await this.prisma.positionHold.update({ where: { id: holdId }, data: { status: "RELEASED" } });
  }

  async findActiveHold(
    roomId: string,
    position: Position,
    now: Date,
  ): Promise<PositionHold | null> {
    const row = await this.prisma.positionHold.findUnique({
      where: { roomId_position: { roomId, position } },
    });
    if (!row || row.status !== "ACTIVE" || row.expiresAt.getTime() <= now.getTime()) {
      return null;
    }
    return toDomainHold(row);
  }

  async commitHold(roomId: string, position: Position): Promise<void> {
    await this.prisma.positionHold.updateMany({
      where: { roomId, position, status: "ACTIVE" },
      data: { status: "COMMITTED" },
    });
  }

  async listForRoom(roomId: string): Promise<readonly PositionHold[]> {
    const rows = await this.prisma.positionHold.findMany({ where: { roomId } });
    return rows.map(toDomainHold);
  }

  /**
   * TASK-034 Scheduler. Reads the overdue set then updates it — safe
   * without a serializable transaction because expiring an already-
   * expired hold is idempotent (updating a RELEASED/EXPIRED/COMMITTED
   * row back to EXPIRED would be a bug, so the WHERE clause re-checks
   * status=ACTIVE at write time too, closing the small window between
   * the two calls).
   */
  async expireOverdue(now: Date): Promise<readonly PositionHold[]> {
    const overdue = await this.prisma.positionHold.findMany({
      where: { status: "ACTIVE", expiresAt: { lte: now } },
    });
    if (overdue.length === 0) {
      return [];
    }
    await this.prisma.positionHold.updateMany({
      where: { id: { in: overdue.map((r) => r.id) }, status: "ACTIVE", expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    });
    return overdue.map((row) => toDomainHold({ ...row, status: "EXPIRED" }));
  }
}
