/**
 * Position holds (FR-022..FR-026, BR-010/BR-011). A hold is a temporary,
 * NOT-ownership reservation (BR-011) on a board position while a
 * participant completes entry. Concurrency-safety of *acquiring* a hold
 * (BR-010: the position race must be atomic) is an infrastructure
 * concern — see the PositionHoldRepository port in @passasorte/application
 * — this module only models the hold's shape and its expiration.
 *
 * The hold TTL itself is an explicitly open technical question
 * (CLAUDE.md #56 Technical - HIGH: "hold TTL") — HoldPolicy.ttlMs is
 * always caller-supplied, never a hard-coded default.
 */
import type { Position } from "../game/board.js";

export interface HoldPolicy {
  readonly ttlMs: number;
}

export class InvalidHoldPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidHoldPolicyError";
  }
}

export function assertValidHoldPolicy(policy: HoldPolicy): void {
  if (!Number.isInteger(policy.ttlMs) || policy.ttlMs <= 0) {
    throw new InvalidHoldPolicyError(
      "O tempo de expiração da reserva (TTL) deve ser um inteiro positivo em milissegundos.",
    );
  }
}

export type PositionHoldStatus = "ACTIVE" | "RELEASED" | "COMMITTED" | "EXPIRED";

export interface PositionHold {
  readonly id: string;
  readonly roomId: string;
  readonly position: Position;
  /** Opaque reference to whoever is holding the position (e.g. a user/session id). */
  readonly holderRef: string;
  readonly status: PositionHoldStatus;
  readonly heldAt: Date;
  readonly expiresAt: Date;
}

/** FR-025: an ACTIVE hold past its expiration is no longer valid, regardless of stored status. */
export function isHoldExpired(hold: PositionHold, now: Date): boolean {
  return hold.status === "ACTIVE" && now.getTime() >= hold.expiresAt.getTime();
}

/** True only for a hold that is currently blocking the position (BR-010/BR-011). */
export function isHoldActive(hold: PositionHold, now: Date): boolean {
  return hold.status === "ACTIVE" && !isHoldExpired(hold, now);
}
