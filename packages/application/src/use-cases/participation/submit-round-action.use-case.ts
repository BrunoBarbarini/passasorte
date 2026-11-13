import { gameV2 } from "@passasorte/domain";
import type { ParticipationRepository } from "../../ports/participation-repository.port.js";
import type { RoomRepository } from "../../ports/room-repository.port.js";
import type {
  OpenRound,
  RoundActionRepository,
  RoundActionSubmissionRecord,
} from "../../ports/round-action-repository.port.js";
import { NOOP_OUTBOX_PORT, type OutboxPort } from "../../ports/outbox.port.js";
import { DomainError, NotFoundError, ValidationError } from "../../errors.js";

export interface SubmitRoundActionInput {
  readonly participationId: string;
  readonly kind: gameV2.SorteDirection;
  readonly credits: number;
  /** Caller-supplied key so a retried request is a no-op (FR-038, BR-037). */
  readonly idempotencyKey: string;
}

export interface SubmitRoundActionResult {
  readonly submission: RoundActionSubmissionRecord;
  readonly round: Pick<OpenRound, "id" | "roundNo" | "windowOpensAt" | "windowClosesAt">;
  /** True when an earlier submission of this participant in this round was replaced (T-33). */
  readonly replaced: boolean;
  /** True when this exact request (same key) was already stored; nothing new was written. */
  readonly idempotentReplay: boolean;
}

/**
 * FR-036..FR-038 + DECISION-16 + T-33: a participant sends (or replaces) their
 * action for the round whose collective window is open. Nothing is resolved
 * here: the Sorte only moves when the window closes and the round is resolved
 * (`resolveRound`, order ENTRY_SEQUENCE_V1). Credits are NOT reserved by a
 * submission; the balance is only spent at resolution, so only the last
 * submission is checked against the full remaining balance.
 *
 * Rules checked here, in this order:
 *  1. participation exists and is ACTIVE;
 *  2. the room is RUNNING and has a frozen Engine V2 config with an explicit
 *     per-round cap (BR-024, BR-089);
 *  3. a round window is open on the SERVER clock (BR-025);
 *  4. the action itself is legal (`assertManualSubmissionAllowed`: direction,
 *     credits >= 1, STAY = 1, cap per round, balance).
 */
export class SubmitRoundActionUseCase {
  constructor(
    private readonly participations: ParticipationRepository,
    private readonly rooms: RoomRepository,
    private readonly rounds: RoundActionRepository,
    private readonly outbox: OutboxPort = NOOP_OUTBOX_PORT,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: SubmitRoundActionInput): Promise<SubmitRoundActionResult> {
    const participation = await this.participations.findById(input.participationId);
    if (!participation) {
      throw new NotFoundError("Participation", input.participationId);
    }
    if (participation.status !== "ACTIVE") {
      throw new DomainError("A participação não está ativa para enviar jogadas.");
    }

    const room = await this.rooms.findById(participation.roomId);
    if (!room) {
      throw new NotFoundError("GameRoom", participation.roomId);
    }
    if (room.status !== "RUNNING") {
      throw new DomainError("A sala não está em andamento; não é possível enviar jogadas agora.");
    }

    const config = await this.rounds.findEngineConfig(room.id);
    if (!config) {
      throw new DomainError(
        "Esta sala ainda não tem a configuração do motor V2 congelada; as jogadas por rodada não estão disponíveis.",
      );
    }
    try {
      gameV2.assertRoundCapDefined(config);
    } catch (error) {
      throw this.translate(error);
    }

    const now = this.clock();
    const round = await this.rounds.findOpenRound(room.id, now);
    if (!round) {
      throw new DomainError("Não há uma janela de jogadas aberta nesta sala neste momento.");
    }

    const remaining = participation.movementAllowanceTotal - participation.movementAllowanceUsed;
    try {
      gameV2.assertManualSubmissionAllowed(config, remaining, {
        kind: input.kind,
        credits: input.credits,
      });
    } catch (error) {
      await this.outbox.publish({
        aggregateType: "Participation",
        aggregateId: participation.id,
        eventType: "movement.rejected",
        payload: {
          userId: participation.userId,
          participationId: participation.id,
          roundNo: round.roundNo,
          reason: error instanceof gameV2.GameEngineError ? error.code : "unknown",
        },
      });
      throw this.translate(error);
    }

    const stored = await this.rounds.appendSubmission({
      roundId: round.id,
      participationId: participation.id,
      kind: input.kind,
      credits: input.credits,
      idempotencyKey: input.idempotencyKey,
      submittedAt: now,
    });

    if (!stored.idempotentReplay) {
      await this.outbox.publish({
        aggregateType: "Participation",
        aggregateId: participation.id,
        eventType: "movement.accepted",
        payload: {
          userId: participation.userId,
          participationId: participation.id,
          roundNo: round.roundNo,
          direction: input.kind,
          credits: input.credits,
          submissionSequence: stored.submission.submissionSequence,
        },
      });
    }

    return {
      submission: stored.submission,
      round: {
        id: round.id,
        roundNo: round.roundNo,
        windowOpensAt: round.windowOpensAt,
        windowClosesAt: round.windowClosesAt,
      },
      replaced: stored.submission.submissionSequence > 1,
      idempotentReplay: stored.idempotentReplay,
    };
  }

  /** Engine rule violations are the participant's input problem (pt-BR message, stable code in details). */
  private translate(error: unknown): unknown {
    if (error instanceof gameV2.GameEngineError) {
      return new ValidationError(error.message, { reason: error.code });
    }
    return error;
  }
}
