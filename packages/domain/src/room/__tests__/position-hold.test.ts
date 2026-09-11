import { describe, expect, it } from "vitest";
import {
  assertValidHoldPolicy,
  InvalidHoldPolicyError,
  isHoldActive,
  isHoldExpired,
  type PositionHold,
} from "../position-hold.entity.js";

function buildHold(overrides: Partial<PositionHold> = {}): PositionHold {
  return {
    id: "hold-1",
    roomId: "room-1",
    position: 3,
    holderRef: "user-1",
    status: "ACTIVE",
    heldAt: new Date("2026-01-01T00:00:00Z"),
    expiresAt: new Date("2026-01-01T00:05:00Z"),
    ...overrides,
  };
}

describe("hold policy (technical TBD: hold TTL, CLAUDE.md #56)", () => {
  it("accepts a positive integer TTL", () => {
    expect(() => assertValidHoldPolicy({ ttlMs: 60_000 })).not.toThrow();
  });

  it("rejects a non-positive or non-integer TTL", () => {
    expect(() => assertValidHoldPolicy({ ttlMs: 0 })).toThrow(InvalidHoldPolicyError);
    expect(() => assertValidHoldPolicy({ ttlMs: -1 })).toThrow(InvalidHoldPolicyError);
    expect(() => assertValidHoldPolicy({ ttlMs: 1.5 })).toThrow(InvalidHoldPolicyError);
  });
});

describe("hold expiration (FR-025)", () => {
  it("is not expired before its expiresAt", () => {
    const hold = buildHold();
    expect(isHoldExpired(hold, new Date("2026-01-01T00:04:59Z"))).toBe(false);
    expect(isHoldActive(hold, new Date("2026-01-01T00:04:59Z"))).toBe(true);
  });

  it("is expired at/after its expiresAt", () => {
    const hold = buildHold();
    expect(isHoldExpired(hold, new Date("2026-01-01T00:05:00Z"))).toBe(true);
    expect(isHoldActive(hold, new Date("2026-01-01T00:05:00Z"))).toBe(false);
  });

  it("a non-ACTIVE hold is never expired or active (already resolved)", () => {
    const released = buildHold({ status: "RELEASED" });
    expect(isHoldExpired(released, new Date("2026-01-01T00:10:00Z"))).toBe(false);
    expect(isHoldActive(released, new Date("2026-01-01T00:00:00Z"))).toBe(false);
  });
});
