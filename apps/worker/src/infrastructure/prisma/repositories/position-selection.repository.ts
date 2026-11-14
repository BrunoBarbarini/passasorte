import { gameV2, type GameRoom } from "@passasorte/domain";
import {
  ConflictError,
  type CommitPickInput,
  type CommitSelectionStartInput,
  type PositionSelectionPort,
  type SelectionSnapshot,
} from "@passasorte/application";
import type { Prisma, PrismaClient } from "@prisma/client";
import { toDomainRoom } from "./room.repository.js";

/**
 * Position selection storage (TASK-075), worker mirror of the API adapter (see README on the duplication). Every write locks the room row first; the
 * UNIQUE(room_id, position) constraint is the last line of defense for BR-010.
 */
export class PrismaPositionSelectionRepository implements PositionSelectionPort {
  constructor(private readonly prisma: PrismaClient) {}

  async loadSnapshot(roomId: string): Promise<SelectionSnapshot> {
    const [participations, assignments] = await Promise.all([
      this.prisma.participation.findMany({
        where: { roomId, status: "CONFIRMED" },
        orderBy: { entrySequence: "asc" },
      }),
      this.prisma.roomPositionAssignment.findMany({
        where: { roomId },
        orderBy: [{ pickedAt: "asc" }, { position: "asc" }],
      }),
    ]);
    const byParticipation = new Map<
      string,
      { positions: number[]; pickedAt: Date; kind: "MANUAL" | "AUTOMATIC" }
    >();
    for (const row of assignments) {
      const current = byParticipation.get(row.participationId);
      if (current) current.positions.push(row.position);
      else
        byParticipation.set(row.participationId, {
          positions: [row.position],
          pickedAt: row.pickedAt,
          kind: row.pickKind as "MANUAL" | "AUTOMATIC",
        });
    }
    return {
      entries: participations.map((row) => ({
        participationId: row.id,
        entrySequence: row.entrySequence,
        packageId: row.packageId,
      })),
      assignments: [...byParticipation.entries()].map(([participationId, value]) => ({
        participationId,
        positions: value.positions.sort((a, b) => a - b),
        pickedAt: value.pickedAt,
        kind: value.kind,
      })),
    };
  }

  async commitSelectionStart(input: CommitSelectionStartInput): Promise<GameRoom> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ status: string }[]>`
        select status::text as status from game_rooms where id = ${input.roomId}::uuid for update`;
      if (locked[0]?.status !== "ENTRY_LOCKED") {
        throw new ConflictError("A sala não está mais com as entradas travadas.");
      }
      const pending = await tx.participation.count({
        where: { roomId: input.roomId, status: "CONFIRMED", entrySequence: null },
      });
      if (pending !== 0) {
        throw new ConflictError("Há participações confirmadas sem ordem de entrada atribuída.");
      }
      await tx.gameRun.create({
        data: {
          roomId: input.roomId,
          engineVersion: gameV2.ENGINE_V2_VERSION,
          commitmentHash: input.commitmentHash,
          seed: input.seedHex,
        },
      });
      const room = await tx.gameRoom.update({
        where: { id: input.roomId },
        data: {
          status: "POSITION_SELECTION",
          positionSelection: {
            pickWindowMs: input.pickWindowMs,
            startedAt: input.startedAt.toISOString(),
            boardSize: input.boardSize,
          },
        },
      });
      await this.publish(tx, input.events);
      return toDomainRoom(room);
    });
  }

  async loadSealedSeed(roomId: string) {
    const run = await this.prisma.gameRun.findUnique({ where: { roomId } });
    return run ? { seedHex: run.seed, commitmentHash: run.commitmentHash } : null;
  }

  async commitPick(input: CommitPickInput): Promise<{ readonly completed: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ status: string }[]>`
        select status::text as status from game_rooms where id = ${input.roomId}::uuid for update`;
      if (locked[0]?.status !== "POSITION_SELECTION") {
        throw new ConflictError("A sala não está mais na fase de escolha de posições.");
      }
      const picked = await tx.roomPositionAssignment.groupBy({
        by: ["participationId"],
        where: { roomId: input.roomId },
      });
      if (picked.length !== input.expectedPickCount) {
        throw new ConflictError("Outra escolha foi registrada primeiro; tente novamente.");
      }
      await tx.roomPositionAssignment.createMany({
        data: input.positions.map((position) => ({
          roomId: input.roomId,
          participationId: input.participationId,
          position,
          pickKind: input.kind,
          pickedAt: input.pickedAt,
        })),
      });
      await tx.participation.update({
        where: { id: input.participationId },
        data: { positions: [...input.positions] },
      });
      const total = await tx.participation.count({
        where: { roomId: input.roomId, status: "CONFIRMED" },
      });
      const completed = picked.length + 1 === total;
      if (completed) {
        await tx.gameRoom.update({ where: { id: input.roomId }, data: { status: "READY" } });
      }
      await this.publish(tx, input.events);
      return { completed };
    });
  }

  async listRoomIdsInSelection(): Promise<readonly string[]> {
    const rooms = await this.prisma.gameRoom.findMany({
      where: { status: "POSITION_SELECTION" },
      select: { id: true },
    });
    return rooms.map((room) => room.id);
  }

  private async publish(
    tx: Prisma.TransactionClient,
    events: CommitPickInput["events"],
  ): Promise<void> {
    if (events.length === 0) return;
    await tx.outboxEvent.createMany({
      data: events.map((event) => ({
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload as Prisma.InputJsonValue,
      })),
    });
  }
}
