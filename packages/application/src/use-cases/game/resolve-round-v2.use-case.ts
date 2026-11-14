import { gameV2 } from "@passasorte/domain";
import type { EngineV2ResolutionPort } from "../../ports/engine-v2-room.port.js";
import type { PublishOutboxEventInput } from "../../ports/outbox.port.js";
import { DomainError, ValidationError } from "../../errors.js";

export type ResolveRoundV2Result =
  | { readonly status: "NOOP" }
  | { readonly status: "RESOLVED"; readonly roundNo: number; readonly completed: boolean };

/**
 * Resolves ONE round once its window has closed (TASK-106): rebuilds the state from the
 * frozen config + previous steps (replay), applies `resolveRound` in ENTRY_SEQUENCE_V1
 * order using the LAST submission per participant (T-33), and, for the last round,
 * completes the game and computes winners. Idempotent: an already-resolved round is a no-op.
 */
export class ResolveRoundV2UseCase {
  constructor(
    private readonly resolution: EngineV2ResolutionPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: { readonly roundId: string }): Promise<ResolveRoundV2Result> {
    const now = this.clock();
    const ctx = await this.resolution.loadResolutionContext(input.roundId);
    if (!ctx) return { status: "NOOP" };
    if (now < ctx.round.windowClosesAt) {
      throw new DomainError("A janela desta rodada ainda está aberta.");
    }

    try {
      const engine = gameV2.createGameEngineV2();
      const replayed = engine.replay({
        init: {
          config: ctx.config,
          participants: ctx.seats.map((seat) => ({
            participantId: seat.participationId,
            entrySequence: seat.entrySequence,
            positions: seat.positions,
            movementBalance: seat.movementAllowanceTotal,
            autoAction: "NONE" as const,
          })),
          randomnessCommitmentHash: ctx.initialSorte.randomnessCommitmentHash,
          initialSortePosition: ctx.initialSorte.initialLuckPosition,
        },
        steps: ctx.priorSteps,
      });

      const resolution = engine.resolveRound(replayed.state, {
        roundId: ctx.round.id,
        roundNumber: ctx.round.roundNo,
        windowOpensAt: ctx.round.windowOpensAt.toISOString(),
        windowClosesAt: ctx.round.windowClosesAt.toISOString(),
        resolutionStartedAt: now.toISOString(),
        submissions: gameV2.selectLatestSubmissions(ctx.submissions),
        resolutionOrder: gameV2.entrySequenceOrder(replayed.state),
        resolutionOrderPolicy: gameV2.ENTRY_SEQUENCE_ORDER_POLICY,
      });

      const events: PublishOutboxEventInput[] = [
        {
          aggregateType: "GameRoom",
          aggregateId: ctx.round.roomId,
          eventType: "round.resolved",
          payload: { roomId: ctx.round.roomId, roundNo: ctx.round.roundNo },
        },
      ];

      let completion = null;
      if (ctx.round.isLast) {
        const completeInput = { serverTime: now.toISOString() };
        const completed = engine.complete(resolution.state, completeInput);
        const result = engine.calculateWinners(completed.state);
        completion = {
          step: { type: "COMPLETE" as const, input: completeInput },
          transition: completed.transition,
          result,
        };
        events.push({
          aggregateType: "GameRoom",
          aggregateId: ctx.round.roomId,
          eventType: "game.completed",
          payload: {
            roomId: ctx.round.roomId,
            winners: result.winners.map((winner) => winner.participantId),
          },
        });
      }

      const committed = await this.resolution.commitResolution({
        roundId: ctx.round.id,
        resolutionStartedAt: now,
        resolution,
        completion,
        events,
      });
      if (committed.alreadyResolved) return { status: "NOOP" };
      return { status: "RESOLVED", roundNo: ctx.round.roundNo, completed: completion !== null };
    } catch (error) {
      if (error instanceof gameV2.GameEngineError) {
        throw new ValidationError(error.message, { reason: error.code });
      }
      throw error;
    }
  }
}
