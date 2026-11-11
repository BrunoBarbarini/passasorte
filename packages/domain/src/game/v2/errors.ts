/**
 * Errors of GameEngine V2. Messages are user-facing and therefore pt-BR
 * (BR-048); `code` is the stable identifier for APIs, logs and tests.
 */
export type GameEngineErrorCode =
  | "INVALID_BAR_SIZE"
  | "INVALID_POSITION"
  | "INVALID_CONFIG"
  | "INVALID_SEATS"
  | "UNSUPPORTED_WINNING_ZONE"
  | "GAME_NOT_RUNNING"
  | "GAME_NOT_COMPLETED"
  | "UNKNOWN_PARTICIPANT"
  | "TURN_ALREADY_CONSUMED"
  | "INVALID_CREDITS"
  | "EXCEEDS_TURN_CAP"
  | "INSUFFICIENT_MOVEMENTS"
  | "AUTOMATIC_MISMATCH"
  | "SKIP_NOT_APPLICABLE"
  | "NON_CANONICAL_VALUE"
  | "REPLAY_MISMATCH"
  | "CREDIT_LIMIT_EXCEEDED"
  | "INVALID_CREDIT_SPLIT";

export class GameEngineError extends Error {
  readonly code: GameEngineErrorCode;

  constructor(code: GameEngineErrorCode, message: string) {
    super(message);
    this.name = "GameEngineError";
    this.code = code;
  }
}
