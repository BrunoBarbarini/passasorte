import { describe, expect, it } from "vitest";
import {
  PILOT_DISABLED_POLICY,
  hasActiveRoomCapacity,
  isMerchantAllowedInPilot,
  type PilotPolicy,
} from "../pilot-policy.js";

describe("pilot policy (Phase 9)", () => {
  it("is a no-op for merchant allow-listing when disabled, even for an unlisted merchant", () => {
    expect(isMerchantAllowedInPilot(PILOT_DISABLED_POLICY, "merchant-not-in-any-list")).toBe(true);
  });

  it("is a no-op for room capacity when disabled, even at a huge count", () => {
    expect(hasActiveRoomCapacity(PILOT_DISABLED_POLICY, 1_000_000)).toBe(true);
  });

  it("allows only merchants explicitly on the allow-list when enabled", () => {
    const policy: PilotPolicy = {
      enabled: true,
      allowedMerchantIds: ["merchant-1", "merchant-2"],
      maxActiveRooms: null,
    };
    expect(isMerchantAllowedInPilot(policy, "merchant-1")).toBe(true);
    expect(isMerchantAllowedInPilot(policy, "merchant-3")).toBe(false);
  });

  it("allows no merchant when enabled with an empty allow-list (safe default, never 'allow all')", () => {
    const policy: PilotPolicy = { enabled: true, allowedMerchantIds: [], maxActiveRooms: null };
    expect(isMerchantAllowedInPilot(policy, "merchant-1")).toBe(false);
  });

  it("enforces the active-room cap when enabled and configured", () => {
    const policy: PilotPolicy = { enabled: true, allowedMerchantIds: [], maxActiveRooms: 3 };
    expect(hasActiveRoomCapacity(policy, 2)).toBe(true);
    expect(hasActiveRoomCapacity(policy, 3)).toBe(false);
    expect(hasActiveRoomCapacity(policy, 4)).toBe(false);
  });

  it("has no cap when enabled but maxActiveRooms is null (never invents a number)", () => {
    const policy: PilotPolicy = { enabled: true, allowedMerchantIds: [], maxActiveRooms: null };
    expect(hasActiveRoomCapacity(policy, 999)).toBe(true);
  });
});
