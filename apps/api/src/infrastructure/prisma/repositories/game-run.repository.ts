import { Inject, Injectable } from "@nestjs/common";
import type { GameResult, RandomnessCommitment } from "@passasorte/domain";
import type { CreateGameRunInput, GameRunRepository } from "@passasorte/application";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service.js";

@Injectable()
export class PrismaGameRunRepository implements GameRunRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateGameRunInput): Promise<void> {
    await this.prisma.gameRun.create({
      data: {
        roomId: input.roomId,
        engineVersion: input.engineVersion,
        commitmentHash: input.commitment.commitmentHash,
        seed: input.seed,
      },
    });
  }

  async findSeedByRoomId(
    roomId: string,
  ): Promise<{ commitment: RandomnessCommitment; seed: string } | null> {
    const row = await this.prisma.gameRun.findUnique({ where: { roomId } });
    if (!row) return null;
    return { commitment: { commitmentHash: row.commitmentHash }, seed: row.seed };
  }

  /** FR-043 Immutable Winner Persistence: a room already resolved rejects a second write. */
  async saveResult(roomId: string, result: GameResult): Promise<void> {
    const existing = await this.prisma.gameRun.findUnique({ where: { roomId } });
    if (!existing) {
      throw new Error(`Nenhum GameRun encontrado para a sala "${roomId}".`);
    }
    if (existing.resolvedAt) {
      throw new Error(`O resultado da sala "${roomId}" já foi persistido e é imutável.`);
    }

    const serializedSteps = result.steps.map((step) => ({
      sequence: step.sequence,
      sorteZone: step.sorteZone,
      participantPositions: step.participantPositions,
      temperatures: Array.from(step.temperatures.entries()),
    }));

    await this.prisma.$transaction([
      this.prisma.gameRun.update({
        where: { roomId },
        data: {
          finalSorteZone: result.finalSorteZone as unknown as Prisma.InputJsonValue,
          steps: serializedSteps as unknown as Prisma.InputJsonValue,
          resolvedAt: new Date(),
        },
      }),
      this.prisma.winner.createMany({
        data: result.winners.map((winner) => ({
          gameRunId: existing.id,
          participationId: winner.participationId,
          winningPosition: winner.winningPosition,
        })),
      }),
    ]);
  }

  async findResultByRoomId(roomId: string): Promise<GameResult | null> {
    const run = await this.prisma.gameRun.findUnique({
      where: { roomId },
      include: { winners: true },
    });
    if (!run || !run.resolvedAt || !run.steps || !run.finalSorteZone) {
      return null;
    }
    const rawSteps = run.steps as unknown as Array<{
      sequence: number;
      sorteZone: { start: number; end: number };
      participantPositions: readonly { participationId: string; positions: readonly number[] }[];
      temperatures: readonly (readonly [string, string])[];
    }>;
    return {
      engineVersion: run.engineVersion,
      finalSorteZone: run.finalSorteZone as unknown,
      winners: run.winners.map((w) => ({
        participationId: w.participationId,
        winningPosition: w.winningPosition,
      })),
      steps: rawSteps.map((step) => ({
        sequence: step.sequence,
        sorteZone: step.sorteZone,
        participantPositions: step.participantPositions,
        temperatures: new Map(step.temperatures) as unknown as ReadonlyMap<string, never>,
      })),
    } as GameResult;
  }
}
