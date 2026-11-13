import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { gameV2 } from "@passasorte/domain";
import type {
  AppendRoundActionSubmissionInput,
  AppendRoundActionSubmissionResult,
  OpenRound,
  RoundActionRepository,
  RoundActionSubmissionRecord,
} from "@passasorte/application";
import { PrismaService } from "../prisma.service.js";

interface SubmissionRow {
  id: string;
  roundId: string;
  participationId: string;
  submissionSequence: number;
  kind: string;
  credits: number;
  submittedAt: Date;
  idempotencyKey: string;
}

function toRecord(row: SubmissionRow): RoundActionSubmissionRecord {
  return {
    id: row.id,
    roundId: row.roundId,
    participationId: row.participationId,
    submissionSequence: row.submissionSequence,
    kind: row.kind as gameV2.SorteDirection,
    credits: row.credits,
    submittedAt: row.submittedAt,
    idempotencyKey: row.idempotencyKey,
  };
}

/**
 * Collective-round submissions (DECISION-16, T-33). The window is judged on
 * the SERVER clock passed in by the use case (BR-025). A round that already
 * started resolving is never open, even if its window time has not elapsed.
 */
@Injectable()
export class PrismaRoundActionRepository implements RoundActionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findOpenRound(roomId: string, now: Date): Promise<OpenRound | null> {
    const row = await this.prisma.gameRound.findFirst({
      where: {
        roomId,
        status: { in: ["SCHEDULED", "WINDOW_OPEN"] },
        actionWindowOpensAt: { lte: now },
        actionWindowClosesAt: { gt: now },
      },
      orderBy: { roundNo: "asc" },
    });
    if (!row) return null;
    return {
      id: row.id,
      roomId: row.roomId,
      roundNo: row.roundNo,
      windowOpensAt: row.actionWindowOpensAt,
      windowClosesAt: row.actionWindowClosesAt,
    };
  }

  async findEngineConfig(roomId: string): Promise<gameV2.GameConfigV2 | null> {
    const room = await this.prisma.gameRoom.findUnique({
      where: { id: roomId },
      select: { engineV2Config: true },
    });
    const raw = room?.engineV2Config;
    if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
      return null;
    }
    const { winningZoneSize, maxMovementsPerRound } = raw as Record<string, unknown>;
    // A missing key is not a config; the use case also rejects a null/non-positive cap (BR-089).
    if (typeof winningZoneSize !== "number" || maxMovementsPerRound === undefined) return null;
    return {
      winningZoneSize,
      maxMovementsPerRound: maxMovementsPerRound as number | null,
    };
  }

  async appendSubmission(
    input: AppendRoundActionSubmissionInput,
  ): Promise<AppendRoundActionSubmissionResult> {
    return this.prisma.$transaction(
      async (tx) => {
        // Serialize concurrent submissions of the same participation: the row lock makes
        // "max(sequence) + 1" safe without retry loops. Other participants are unaffected.
        await tx.$queryRaw`select id from participations where id = ${input.participationId}::uuid for update`;

        const existing = await tx.roundActionSubmission.findUnique({
          where: {
            participationId_roundId_idempotencyKey: {
              participationId: input.participationId,
              roundId: input.roundId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (existing) {
          return { submission: toRecord(existing), idempotentReplay: true };
        }

        const last = await tx.roundActionSubmission.aggregate({
          where: { roundId: input.roundId, participationId: input.participationId },
          _max: { submissionSequence: true },
        });
        const created = await tx.roundActionSubmission.create({
          data: {
            roundId: input.roundId,
            participationId: input.participationId,
            submissionSequence: (last._max.submissionSequence ?? 0) + 1,
            kind: input.kind,
            credits: input.credits,
            submittedAt: input.submittedAt,
            idempotencyKey: input.idempotencyKey,
          },
        });
        return { submission: toRecord(created), idempotentReplay: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}
