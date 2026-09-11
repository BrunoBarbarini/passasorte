/**
 * Cryptographically committed, reproducible randomness (BR-030/BR-031,
 * ADR-012). A seed is committed (hashed) BEFORE it is used; the outcome
 * is only ever derived by revealing the seed and re-deriving the same
 * hash, so fairness is verifiable rather than merely asserted. Pure/no
 * I/O (NFR-017) - the caller persists the commitment record
 * (RandomnessCommitment, CLAUDE.md #8) and supplies the seed itself
 * (e.g. from a KMS-backed source - out of scope here per ADR-012's "exact
 * commit-reveal scheme and KMS integration ... implementation detail").
 */
import { createHash, randomBytes } from "node:crypto";

export interface RandomnessCommitment {
  readonly commitmentHash: string; // hex sha256
}

function hashSeed(seedHex: string): string {
  return createHash("sha256").update(seedHex, "hex").digest("hex");
}

/** Generates a fresh random seed (hex-encoded) - call once per room/round before any use. */
export function generateRandomSeed(): string {
  return randomBytes(32).toString("hex");
}

/** Commits a seed by hashing it. Store the returned commitment BEFORE revealing/using the seed (BR-030). */
export function commitRandomSeed(seedHex: string): RandomnessCommitment {
  return { commitmentHash: hashSeed(seedHex) };
}

export class RandomnessRevealMismatchError extends Error {
  constructor() {
    super("O seed revelado não corresponde ao compromisso (commitment) registrado.");
    this.name = "RandomnessRevealMismatchError";
  }
}

/** Verifies a revealed seed against its prior commitment (BR-031: an admin cannot swap the seed after the fact). */
export function verifyRevealedSeed(seedHex: string, commitment: RandomnessCommitment): void {
  if (hashSeed(seedHex) !== commitment.commitmentHash) {
    throw new RandomnessRevealMismatchError();
  }
}

/**
 * Derives a deterministic, reproducible unit-interval value ([0, 1)) from
 * a revealed seed - the same seed + index always yields the same value,
 * so any engine strategy consuming these numbers is replayable (FR-044)
 * from the stored commitment alone.
 */
export function deriveRandomUnitInterval(seedHex: string, index: number): number {
  const digest = createHash("sha256").update(`${seedHex}:${index}`).digest();
  // First 6 bytes (~48 bits of entropy) stay safely within Number precision.
  const value = digest.readUIntBE(0, 6);
  return value / 2 ** 48;
}
