import { Inject, Injectable } from "@nestjs/common";
import { gameV2 } from "@passasorte/domain";
import type {
  LatestSubmission,
  ParticipantGameStatePort,
  RoomGameData,
} from "@passasorte/application";
import { PrismaService } from "../prisma.service.js";

/** Read-only view of a running Engine V2 room for the participant app. */
@Injectable()
export class PrismaParticipantGameStateRepository implements ParticipantGameStatePort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async loadRoomGameData(roomId: string): Promise<RoomGameData | null> {
    const room = await this.prisma.gameRoom.findUnique({ where: { id: roomId } });
    const raw = room?.engineV2Config as Record<string, unknown> | null | undefined;
    if (!room || !raw || typeof raw.winningZoneSize !== "number") return null;
    const initial = await this.prisma.initialSorteRecord.findUnique({ where: { roomId } });
    if (!initial) return null;

    const rounds = await this.prisma.gameRound.findMany({
      where: { roomId },
      orderBy: { roundNo: "asc" },
    });
    const participations = await this.prisma.participation.findMany({
      where: { roomId, status: "ACTIVE" },
      orderBy: { entrySequence: "asc" },
    });
    return {
      config: {
        winningZoneSize: raw.winningZoneSize,
        maxMovementsPerRound: (raw.maxMovementsPerRound ?? null) as number | null,
      },
      initialSorte: {
        gameId: initial.gameId,
        boardSize: initial.boardSize,
        engineVersion: gameV2.ENGINE_V2_VERSION,
        randomnessCommitmentHash: initial.randomnessCommitmentHash,
        initialLuckPosition: initial.initialLuckPosition,
        generatedAt: initial.generatedAt.toISOString(),
      },
      seats: participations.flatMap((row) =>
        row.entrySequence === null
          ? []
          : [
              {
                participationId: row.id,
                entrySequence: row.entrySequence,
                positions: row.positions,
                movementAllowanceTotal: row.movementAllowanceTotal,
                autoAction: row.autoAction as gameV2.AutoAction,
              },
            ],
      ),
      steps: rounds
        .filter((round) => round.status === "RESOLVED")
        .flatMap((round) => (round.resolutionSteps ?? []) as unknown as gameV2.ReplayStep[]),
      rounds: rounds.map((round) => ({
        roundNo: round.roundNo,
        windowOpensAt: round.actionWindowOpensAt,
        windowClosesAt: round.actionWindowClosesAt,
        resolved: round.status === "RESOLVED",
      })),
    };
  }

  async loadLatestSubmission(
    roomId: string,
    roundNo: number,
    participationId: string,
  ): Promise<LatestSubmission | null> {
    const row = await this.prisma.roundActionSubmission.findFirst({
      where: { participationId, round: { roomId, roundNo } },
      orderBy: { submissionSequence: "desc" },
    });
    return row ? { kind: row.kind as gameV2.SorteDirection, credits: row.credits, roundNo } : null;
  }

  async loadFinalResult(
    roomId: string,
  ): Promise<{ readonly winningPositions: readonly number[] } | null> {
    const run = await this.prisma.gameRun.findUnique({ where: { roomId } });
    const zone = run?.finalSorteZone as { winningPositions?: number[] } | null | undefined;
    return zone?.winningPositions ? { winningPositions: zone.winningPositions } : null;
  }
}
