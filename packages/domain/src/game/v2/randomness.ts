/**
 * Deterministic randomness for the match setup (DECISION-15, BR-054).
 *
 * The server holds a sealed seed whose hash was published BEFORE the bar size
 * was known (commit-reveal, ADR-012/ADR-025). Every derived value is a pure
 * function of (seed, purpose label, index), so each purpose has its own
 * independent stream and anyone can recompute it once the seed is revealed.
 * No human input and no client input can influence these values.
 *
 * `node:crypto` is used through `sha256Hex`, following the precedent of
 * `randomness-commitment.ts`.
 */
import { createHash } from "node:crypto";
import { assertValidBarSize } from "./circular-bar.js";
import { GameEngineError } from "./errors.js";
import { ENGINE_V2_VERSION } from "./types.js";

const UNIT_BITS = 48;

export const RANDOM_PURPOSE_INITIAL_SORTE = "initial-sorte";
export const RANDOM_PURPOSE_AUTO_ALLOCATION = "auto-allocation";

/** Value in [0, 1) derived from (seed, purpose, index) using 48 bits of a SHA-256 digest. */
export function seededUnit(seedHex: string, purpose: string, index: number): number {
  const digest = createHash("sha256").update(`${seedHex}:${purpose}:${index}`).digest();
  return digest.readUIntBE(0, 6) / 2 ** UNIT_BITS;
}

/**
 * Initial position of the Sorte, uniform on 1..N (BR-054). With N far below
 * 2^48 the modulo-free scaling bias is negligible (< N / 2^48).
 */
export function deriveInitialSortePosition(seedHex: string, size: number): number {
  assertValidBarSize(size);
  return Math.floor(seededUnit(seedHex, RANDOM_PURPOSE_INITIAL_SORTE, 0) * size) + 1;
}

/** Record persisted when the match starts (DECISION-15). */
export interface InitialSorteRecord {
  readonly gameId: string;
  readonly boardSize: number;
  readonly engineVersion: typeof ENGINE_V2_VERSION;
  readonly randomnessCommitmentHash: string;
  readonly initialLuckPosition: number;
  /** UTC ISO-8601, server clock. */
  readonly generatedAt: string;
}

export interface InitialSorteInput {
  readonly gameId: string;
  readonly boardSize: number;
  readonly sealedSeedHex: string;
  readonly randomnessCommitmentHash: string;
  readonly generatedAt: string;
}

/**
 * Derives the initial Sorte from the sealed seed and proves the seed is the
 * one that was committed before N was known (BR-031).
 */
export function createInitialSorteRecord(input: InitialSorteInput): InitialSorteRecord {
  const seedHash = createHash("sha256").update(input.sealedSeedHex, "hex").digest("hex");
  if (seedHash !== input.randomnessCommitmentHash) {
    throw new GameEngineError(
      "COMMITMENT_MISMATCH",
      "O seed não corresponde ao compromisso de aleatoriedade registrado.",
    );
  }
  return {
    gameId: input.gameId,
    boardSize: input.boardSize,
    engineVersion: ENGINE_V2_VERSION,
    randomnessCommitmentHash: input.randomnessCommitmentHash,
    initialLuckPosition: deriveInitialSortePosition(input.sealedSeedHex, input.boardSize),
    generatedAt: input.generatedAt,
  };
}
