import { Inject, Injectable } from "@nestjs/common";
import { gameV2, type GameRoom } from "@passasorte/domain";
import {
  ConflictError,
  type CommitRoomStartInput,
  type EngineV2StartPort,
  type RoomStartSeat,
} from "@passasorte/application";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service.js";
import { toDomainRoom } from "./room.repository.js";

/** Atomic start of an Engine V2 room (TASK-106). One transaction, room row locked. */
@Injectable()
export class PrismaEngineV2StartRepository implements EngineV2StartPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listConfirmedSeats(roomId: string): Promise<readonly RoomStartSeat[]> {
    const rows = await this.prisma.participation.findMany({
      where: { roomId, status: "CONFIRMED" },
      orderBy: { entrySequence: "asc" },
    });
    return rows.map((row) => ({
      participationId: row.id,
      entrySequence: row.entrySequence,
      positions: row.positions,
      movementAllowance: row.movementAllowanceTotal,
    }));
  }

  async commitStart(input: CommitRoomStartInput): Promise<GameRoom> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ status: string }[]>`
        select status::text as status from game_rooms where id = ${input.roomId}::uuid for update`;
      if (locked[0]?.status !== "ENTRY_LOCKED") {
        throw new ConflictError("A sala não está mais com as entradas travadas.");
      }

      const activated = await tx.participation.updateMany({
        where: {
          id: { in: [...input.participationIds] },
          roomId: input.roomId,
          status: "CONFIRMED",
        },
        data: { status: "ACTIVE" },
      });
      const stillConfirmed = await tx.participation.count({
        where: { roomId: input.roomId, status: "CONFIRMED" },
      });
      if (activated.count !== input.participationIds.length || stillConfirmed !== 0) {
        throw new ConflictError("As participações confirmadas mudaram durante o início da sala.");
      }

      await tx.gameRun.create({
        data: {
          roomId: input.roomId,
          engineVersion: gameV2.ENGINE_V2_VERSION,
          commitmentHash: input.initialSorte.randomnessCommitmentHash,
          seed: input.seedHex,
        },
      });
      await tx.initialSorteRecord.create({
        data: {
          roomId: input.roomId,
          gameId: input.initialSorte.gameId,
          boardSize: input.initialSorte.boardSize,
          engineVersion: input.initialSorte.engineVersion,
          randomnessCommitmentHash: input.initialSorte.randomnessCommitmentHash,
          initialLuckPosition: input.initialSorte.initialLuckPosition,
          generatedAt: new Date(input.initialSorte.generatedAt),
        },
      });
      await tx.gameRound.createMany({
        data: input.schedule.map((entry) => ({
          roomId: input.roomId,
          roundNo: entry.roundNo,
          actionWindowOpensAt: entry.windowOpensAt,
          actionWindowClosesAt: entry.windowClosesAt,
        })),
      });
      const room = await tx.gameRoom.update({
        where: { id: input.roomId },
        data: { status: "RUNNING", engineV2Config: { ...input.config } },
      });
      if (input.events.length > 0) {
        await tx.outboxEvent.createMany({
          data: input.events.map((event) => ({
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            eventType: event.eventType,
            payload: event.payload as Prisma.InputJsonValue,
          })),
        });
      }
      return toDomainRoom(room);
    });
  }
}
