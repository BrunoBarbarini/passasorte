import type { GameResult, RandomnessCommitment } from "@passasorte/domain";

/**
 * TASK-031 Game Result Engine / TASK-032 Winner Model. One row per room:
 * the committed+revealed randomness (BR-030/BR-031) and, once resolved,
 * the immutable GameResult (steps + winners, FR-043/FR-044). This port
 * only persists what the pure GameEngine already produces — it invents
 * no winner/movement/Sorte semantics of its own.
 */
export interface CreateGameRunInput {
  roomId: string;
  engineVersion: string;
  commitment: RandomnessCommitment;
  /** The seed itself (BR-030) — stored alongside its commitment so a server-side resolution can later verify+reveal it (BR-031) without an external party. */
  seed: string;
}

export interface GameRunRepository {
  create(input: CreateGameRunInput): Promise<void>;
  findSeedByRoomId(
    roomId: string,
  ): Promise<{ readonly commitment: RandomnessCommitment; readonly seed: string } | null>;
  /** FR-043 Immutable Winner Persistence: writes the final result once — implementations should reject a second write for the same room. */
  saveResult(roomId: string, result: GameResult): Promise<void>;
  findResultByRoomId(roomId: string): Promise<GameResult | null>;
}
