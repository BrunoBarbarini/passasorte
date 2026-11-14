import { gameV2 } from "@passasorte/domain";
import type { ParticipationRepository } from "../../ports/participation-repository.port.js";
import type { RoomRepository } from "../../ports/room-repository.port.js";
import type { ParticipantGameStatePort } from "../../ports/participant-game-state.port.js";
import { NotFoundError } from "../../errors.js";

export interface ParticipantGameStateView {
  /** Server clock, so the app can run a countdown without trusting the device clock (BR-025). */
  readonly serverTime: string;
  readonly participationId: string;
  readonly roomId: string;
  readonly roomStatus: string;
  readonly participationStatus: string;
  readonly positions: readonly number[];
  readonly autoAction: string;
  readonly movements: { readonly total: number; readonly used: number; readonly remaining: number };
  /** Level + pt-BR label only (BR-090). Null when the game is not running for this participant. */
  readonly temperature: gameV2.ParticipantTemperature | null;
  readonly maxMovementsPerRound: number | null;
  readonly round: {
    readonly roundNo: number;
    readonly totalRounds: number;
    readonly windowOpensAt: string;
    readonly windowClosesAt: string;
    readonly phase: "UPCOMING" | "OPEN" | "RESOLVING";
  } | null;
  /** The action currently counted for the open round (the last one sent, T-33). */
  readonly myAction: { readonly kind: string; readonly credits: number } | null;
  /** Only after the game completed. */
  readonly result: { readonly won: boolean; readonly winningPositions: readonly number[] } | null;
}

/**
 * What the participant may see of a live room: own positions, temperature LEVEL, balance,
 * current round window, own last action and, only once finished, the result.
 * Never the Sorte position, the exact distance or other participants' state (BR-018, BR-090).
 */
export class GetParticipantGameStateUseCase {
  constructor(
    private readonly participations: ParticipationRepository,
    private readonly rooms: RoomRepository,
    private readonly game: ParticipantGameStatePort,
    private readonly clock: () => Date = () => new Date(),
    private readonly bands: gameV2.TemperatureBands = gameV2.INITIAL_TEMPERATURE_BANDS,
  ) {}

  async execute(input: { readonly participationId: string }): Promise<ParticipantGameStateView> {
    const participation = await this.participations.findById(input.participationId);
    if (!participation) throw new NotFoundError("Participation", input.participationId);
    const room = await this.rooms.findById(participation.roomId);
    if (!room) throw new NotFoundError("GameRoom", participation.roomId);

    const base = {
      serverTime: this.clock().toISOString(),
      participationId: participation.id,
      roomId: room.id,
      roomStatus: room.status,
      participationStatus: participation.status,
      positions: participation.positions.map((p) => p.position).sort((a, b) => a - b),
      autoAction: participation.autoAction ?? "NONE",
      movements: {
        total: participation.movementAllowanceTotal,
        used: participation.movementAllowanceUsed,
        remaining: participation.movementAllowanceTotal - participation.movementAllowanceUsed,
      },
      temperature: null,
      maxMovementsPerRound: null as number | null,
      round: null,
      myAction: null,
      result: null,
    } satisfies ParticipantGameStateView;

    const data = await this.game.loadRoomGameData(room.id);
    if (!data) return base;
    const withConfig = { ...base, maxMovementsPerRound: data.config.maxMovementsPerRound };

    if (participation.status === "WON" || participation.status === "NOT_WON") {
      const final = await this.game.loadFinalResult(room.id);
      return {
        ...withConfig,
        result: {
          won: participation.status === "WON",
          winningPositions: final?.winningPositions ?? [],
        },
      };
    }
    if (room.status !== "RUNNING" || participation.status !== "ACTIVE") return withConfig;

    const engine = gameV2.createGameEngineV2();
    const replayed = engine.replay({
      init: {
        config: data.config,
        participants: data.seats.map((seat) => ({
          participantId: seat.participationId,
          entrySequence: seat.entrySequence,
          positions: seat.positions,
          movementBalance: seat.movementAllowanceTotal,
          autoAction: seat.autoAction,
        })),
        randomnessCommitmentHash: data.initialSorte.randomnessCommitmentHash,
        initialSortePosition: data.initialSorte.initialLuckPosition,
      },
      steps: data.steps,
    });
    const temperature = gameV2.participantTemperature(replayed.state, participation.id, this.bands);

    const now = this.clock();
    const current = data.rounds.find((round) => !round.resolved);
    let round: ParticipantGameStateView["round"] = null;
    let myAction: ParticipantGameStateView["myAction"] = null;
    if (current) {
      const phase =
        now < current.windowOpensAt
          ? "UPCOMING"
          : now < current.windowClosesAt
            ? "OPEN"
            : "RESOLVING";
      round = {
        roundNo: current.roundNo,
        totalRounds: data.rounds.length,
        windowOpensAt: current.windowOpensAt.toISOString(),
        windowClosesAt: current.windowClosesAt.toISOString(),
        phase,
      };
      const latest = await this.game.loadLatestSubmission(
        room.id,
        current.roundNo,
        participation.id,
      );
      if (latest) myAction = { kind: latest.kind, credits: latest.credits };
    }
    return { ...withConfig, temperature, round, myAction };
  }
}
