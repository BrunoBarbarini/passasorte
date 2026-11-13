import type { gameV2 } from "@passasorte/domain";

/** The round whose action window is open at a given server time. */
export interface OpenRound {
  readonly id: string;
  readonly roomId: string;
  readonly roundNo: number;
  readonly windowOpensAt: Date;
  readonly windowClosesAt: Date;
}

export interface RoundActionSubmissionRecord {
  readonly id: string;
  readonly roundId: string;
  readonly participationId: string;
  /** 1-based, per (round, participation). The highest one wins (T-33). */
  readonly submissionSequence: number;
  readonly kind: gameV2.SorteDirection;
  readonly credits: number;
  readonly submittedAt: Date;
  readonly idempotencyKey: string;
}

export interface AppendRoundActionSubmissionInput {
  readonly roundId: string;
  readonly participationId: string;
  readonly kind: gameV2.SorteDirection;
  readonly credits: number;
  readonly idempotencyKey: string;
  /** Server clock (BR-025), never client-supplied. */
  readonly submittedAt: Date;
}

export interface AppendRoundActionSubmissionResult {
  readonly submission: RoundActionSubmissionRecord;
  /** True when the same (participation, round, idempotencyKey) had already been stored: nothing new was written. */
  readonly idempotentReplay: boolean;
}

/**
 * Persistence for collective-round submissions (DECISION-16, T-33).
 * Submissions are append-only; a replacement is a new row with the next
 * `submissionSequence`, so the history stays auditable (DECISION-21).
 */
export interface RoundActionRepository {
  /** The round whose window contains `now` (opens <= now < closes) and that has not started resolving, or null. */
  findOpenRound(roomId: string, now: Date): Promise<OpenRound | null>;
  /** The Engine V2 config frozen for the room, or null when none was frozen (room predates V2). */
  findEngineConfig(roomId: string): Promise<gameV2.GameConfigV2 | null>;
  /**
   * Atomically stores a submission. Must (a) return the existing row with
   * `idempotentReplay: true` for a repeated key, and (b) assign the next
   * `submissionSequence` without gaps or duplicates under concurrent calls.
   */
  appendSubmission(
    input: AppendRoundActionSubmissionInput,
  ): Promise<AppendRoundActionSubmissionResult>;
}
