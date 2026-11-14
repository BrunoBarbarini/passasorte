import { assertRoomTransition, gameV2 } from "@passasorte/domain";
import type { GameRoom } from "@passasorte/domain";
import type { RoomRepository } from "../../ports/room-repository.port.js";
import type { EngineV2StartPort } from "../../ports/engine-v2-room.port.js";
import { DomainError, NotFoundError, ValidationError } from "../../errors.js";

export interface StartRoomV2Input {
  readonly roomId: string;
  /** Chosen by the operator per campaign; no default exists (BR-068, BR-089). */
  readonly config: gameV2.GameConfigV2;
  readonly schedule: readonly gameV2.RoundScheduleEntry[];
}

/**
 * READY -> RUNNING for an Engine V2 room (TASK-106). Freezes the engine config
 * with the mandatory per-round cap (BR-024/BR-089), takes the seed sealed at the start of the
 * selection phase (TASK-075), derives the
 * initial Sorte and creates every round window. The board size N is the total number
 * of positions chosen by the confirmed participations, which must tile 1..N exactly
 * (the engine rejects anything else). Known gap (ADR-025): the seed is sealed when the
 * selection starts, after N is known.
 */
export class StartRoomV2UseCase {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly start: EngineV2StartPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: StartRoomV2Input): Promise<GameRoom> {
    const room = await this.rooms.findById(input.roomId);
    if (!room) throw new NotFoundError("GameRoom", input.roomId);
    if (room.status !== "READY") {
      throw new DomainError(
        "A sala só pode ser iniciada depois que todas as posições da barra tiverem dono (fase de seleção concluída).",
      );
    }
    assertRoomTransition(room.status, "RUNNING");

    const seats = await this.start.listConfirmedSeats(room.id);
    if (seats.length === 0) {
      throw new DomainError("A sala não tem participações confirmadas.");
    }
    const participants: gameV2.ParticipantSeatV2[] = seats.map((seat) => {
      if (seat.entrySequence === null) {
        throw new ValidationError("Há participação confirmada sem ordem de entrada atribuída.", {
          participationId: seat.participationId,
        });
      }
      return {
        participantId: seat.participationId,
        entrySequence: seat.entrySequence,
        positions: seat.positions,
        movementBalance: seat.movementAllowance,
        autoAction: seat.autoAction,
      };
    });

    const now = this.clock();
    const sealed = await this.start.loadSealedSeed(room.id);
    if (!sealed) {
      throw new DomainError(
        "A semente da sala não foi selada; a fase de seleção não foi executada.",
      );
    }
    const seedHex = sealed.seedHex;
    const commitmentHash = sealed.commitmentHash;
    const boardSize = seats.reduce((total, seat) => total + seat.positions.length, 0);

    try {
      gameV2.assertRoundCapDefined(input.config);
      gameV2.assertValidRoundSchedule(input.schedule);
      const initialSorte = gameV2.createInitialSorteRecord({
        gameId: room.id,
        boardSize,
        sealedSeedHex: seedHex,
        randomnessCommitmentHash: commitmentHash,
        generatedAt: now.toISOString(),
      });
      // Dry run: validates config, tiling of positions and balances without persisting.
      gameV2.createGameEngineV2().initialize({
        config: input.config,
        participants,
        randomnessCommitmentHash: commitmentHash,
        initialSortePosition: initialSorte.initialLuckPosition,
      });

      return await this.start.commitStart({
        roomId: room.id,
        startedAt: now,
        config: {
          winningZoneSize: input.config.winningZoneSize,
          maxMovementsPerRound: input.config.maxMovementsPerRound,
        },
        initialSorte,
        schedule: input.schedule,
        participationIds: seats.map((seat) => seat.participationId),
        events: [
          {
            aggregateType: "GameRoom",
            aggregateId: room.id,
            eventType: "room.started",
            payload: { roomId: room.id, boardSize, rounds: input.schedule.length },
          },
        ],
      });
    } catch (error) {
      if (error instanceof gameV2.GameEngineError) {
        throw new ValidationError(error.message, { reason: error.code });
      }
      throw error;
    }
  }
}
