/**
 * Round resolution adapter (TASK-106). Worker-only: the API never resolves rounds.
 * `commitResolution` is one transaction that locks the round row, so two workers
 * can never resolve the same round twice.
 */
import { gameV2 } from "@passasorte/domain";
import type {
  CommitRoundResolutionInput,
  DueRound,
  EngineV2ResolutionPort,
  RoundResolutionContext,
} from "@passasorte/application";
import { Prisma, type PrismaClient } from "@prisma/client";

export class PrismaEngineV2ResolutionRepository implements EngineV2ResolutionPort {
  constructor(private readonly prisma: PrismaClient) {}

  async findDueRounds(now: Date, limit: number): Promise<readonly DueRound[]> {
    const rows = await this.prisma.gameRound.findMany({
      where: {
        status: { in: ["SCHEDULED", "WINDOW_OPEN"] },
        actionWindowClosesAt: { lte: now },
        room: { status: "RUNNING", engineV2Config: { not: Prisma.DbNull } },
      },
      orderBy: [{ roomId: "asc" }, { roundNo: "asc" }],
    });
    // Rounds of one room are resolved strictly in order: only its earliest due round.
    const seen = new Set<string>();
    const due: DueRound[] = [];
    for (const row of rows) {
      if (seen.has(row.roomId)) continue;
      seen.add(row.roomId);
      due.push({ roundId: row.id, roomId: row.roomId, roundNo: row.roundNo });
      if (due.length >= limit) break;
    }
    return due;
  }

  async loadResolutionContext(roundId: string): Promise<RoundResolutionContext | null> {
    const round = await this.prisma.gameRound.findUnique({
      where: { id: roundId },
      include: { room: true },
    });
    if (!round || round.status === "RESOLVED" || round.room.status !== "RUNNING") return null;
    const raw = round.room.engineV2Config as Record<string, unknown> | null;
    if (raw === null || typeof raw.winningZoneSize !== "number") return null;
    const config: gameV2.GameConfigV2 = {
      winningZoneSize: raw.winningZoneSize,
      maxMovementsPerRound: (raw.maxMovementsPerRound ?? null) as number | null,
    };

    const initial = await this.prisma.initialSorteRecord.findUnique({
      where: { roomId: round.roomId },
    });
    if (!initial) return null;

    const rounds = await this.prisma.gameRound.findMany({
      where: { roomId: round.roomId },
      orderBy: { roundNo: "asc" },
    });
    const previous = rounds.filter((candidate) => candidate.roundNo < round.roundNo);
    // A gap means an earlier round is unresolved: wait for it instead of resolving out of order.
    if (previous.some((candidate) => candidate.status !== "RESOLVED")) return null;
    const priorSteps = previous.flatMap(
      (candidate) => (candidate.resolutionSteps ?? []) as unknown as gameV2.ReplayStep[],
    );

    const participations = await this.prisma.participation.findMany({
      where: { roomId: round.roomId, status: "ACTIVE" },
      orderBy: { entrySequence: "asc" },
    });
    const seats = participations.map((row) => {
      if (row.entrySequence === null) {
        throw new Error(`Participação ${row.id} está ativa sem ordem de entrada.`);
      }
      return {
        participationId: row.id,
        entrySequence: row.entrySequence,
        positions: row.positions,
        movementAllowanceTotal: row.movementAllowanceTotal,
        autoAction: row.autoAction as gameV2.AutoAction,
      };
    });

    const submissions = await this.prisma.roundActionSubmission.findMany({
      where: { roundId },
      orderBy: { submissionSequence: "asc" },
    });

    return {
      round: {
        id: round.id,
        roomId: round.roomId,
        roundNo: round.roundNo,
        windowOpensAt: round.actionWindowOpensAt,
        windowClosesAt: round.actionWindowClosesAt,
        isLast: rounds.every((candidate) => candidate.roundNo <= round.roundNo),
      },
      config,
      initialSorte: {
        gameId: initial.gameId,
        boardSize: initial.boardSize,
        engineVersion: gameV2.ENGINE_V2_VERSION,
        randomnessCommitmentHash: initial.randomnessCommitmentHash,
        initialLuckPosition: initial.initialLuckPosition,
        generatedAt: initial.generatedAt.toISOString(),
      },
      seats,
      priorSteps,
      submissions: submissions.map((row) => ({
        participantId: row.participationId,
        kind: row.kind as gameV2.SorteDirection,
        credits: row.credits,
        submittedAt: row.submittedAt.toISOString(),
        submissionSequence: row.submissionSequence,
      })),
    };
  }

  async commitResolution(
    input: CommitRoundResolutionInput,
  ): Promise<{ readonly alreadyResolved: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ status: string; room_id: string }[]>`
        select status, room_id from game_rounds where id = ${input.roundId}::uuid for update`;
      const row = locked[0];
      if (!row) throw new Error(`Rodada ${input.roundId} não encontrada.`);
      if (row.status === "RESOLVED") return { alreadyResolved: true };
      const roomId = row.room_id;
      const { resolution } = input;

      const submissions = await tx.roundActionSubmission.findMany({
        where: { roundId: input.roundId },
        orderBy: { submissionSequence: "asc" },
      });
      const latest = new Map<string, string>();
      for (const submission of submissions) latest.set(submission.participationId, submission.id);

      await tx.roundAction.createMany({
        data: resolution.audit.map((audit) => ({
          roundId: input.roundId,
          participationId: audit.participantId,
          entrySequence: audit.entrySequence,
          kind: audit.action,
          credits: audit.movementsConsumed,
          executionType: audit.executionType,
          outcome: audit.outcome,
          skipReason: audit.skipReason,
          submissionId:
            audit.executionType === "MANUAL" ? (latest.get(audit.participantId) ?? null) : null,
          submittedAt: audit.actionSubmittedAt === null ? null : new Date(audit.actionSubmittedAt),
          resolutionSequence: audit.resolutionSequence,
          luckPositionBefore: audit.luckPositionBefore,
          luckPositionAfter: audit.luckPositionAfter,
        })),
      });

      for (const audit of resolution.audit) {
        if (audit.movementsConsumed > 0) {
          await tx.participation.update({
            where: { id: audit.participantId },
            data: { movementAllowanceUsed: { increment: audit.movementsConsumed } },
          });
        }
      }

      const lastTransition = resolution.transitions[resolution.transitions.length - 1];
      await tx.gameRound.update({
        where: { id: input.roundId },
        data: {
          status: "RESOLVED",
          resolutionStartedAt: input.resolutionStartedAt,
          resolutionCompletedAt: new Date(),
          resolutionOrderPolicy: resolution.resolutionOrderPolicy,
          luckPositionBefore: resolution.luckPositionBeforeRound,
          luckPositionAfter: resolution.luckPositionAfterRound,
          resolutionSteps: resolution.steps as unknown as Prisma.InputJsonValue,
          stateHashAfter: lastTransition?.currentStateHash ?? null,
        },
      });

      if (input.completion) {
        const { result, step, transition } = input.completion;
        const run = await tx.gameRun.findUniqueOrThrow({ where: { roomId } });
        await tx.gameRun.update({
          where: { roomId },
          data: {
            finalSorteZone: {
              sortePosition: result.sortePosition,
              winningPositions: result.winningPositions,
            },
            steps: { completeStep: step, transition } as unknown as Prisma.InputJsonValue,
            resolvedAt: new Date(),
          },
        });
        const winnerRows = result.winners.flatMap((winner) =>
          winner.winningPositions.map((position) => ({
            gameRunId: run.id,
            participationId: winner.participantId,
            winningPosition: position,
          })),
        );
        if (winnerRows.length > 0) await tx.winner.createMany({ data: winnerRows });

        const winnerIds = result.winners.map((winner) => winner.participantId);
        // V2 has no final lock (BR-067): ACTIVE goes straight to its outcome.
        await tx.participation.updateMany({
          where: { roomId, status: "ACTIVE", id: { in: winnerIds } },
          data: { status: "WON" },
        });
        await tx.participation.updateMany({
          where: { roomId, status: "ACTIVE", id: { notIn: winnerIds } },
          data: { status: "NOT_WON" },
        });
        await tx.gameRoom.update({ where: { id: roomId }, data: { status: "RESOLVING" } });
        await tx.gameRoom.update({ where: { id: roomId }, data: { status: "COMPLETED" } });
      }

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
      return { alreadyResolved: false };
    });
  }
}
