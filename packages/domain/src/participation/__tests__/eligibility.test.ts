import { describe, expect, it } from "vitest";
import { evaluateEligibility, isEligible, type EligibilityRule } from "../eligibility.js";

const MAX_ONE_ACTIVE_PARTICIPATION: EligibilityRule = {
  id: "TEST_MAX_ONE_ACTIVE",
  evaluate(context) {
    return context.existingActiveParticipationCount >= 1
      ? { ruleId: "TEST_MAX_ONE_ACTIVE", message: "Limite de participações ativas atingido." }
      : null;
  },
};

describe("evaluateEligibility (FR-028, rules are configured, never hard-coded)", () => {
  it("passes with no configured rules", () => {
    expect(
      evaluateEligibility([], {
        userId: "u1",
        roomId: "r1",
        requestedPositionCount: 1,
        existingActiveParticipationCount: 5,
      }),
    ).toEqual([]);
  });

  it("collects violations from every configured rule that fails", () => {
    const context = {
      userId: "u1",
      roomId: "r1",
      requestedPositionCount: 1,
      existingActiveParticipationCount: 1,
    };
    const violations = evaluateEligibility([MAX_ONE_ACTIVE_PARTICIPATION], context);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.ruleId).toBe("TEST_MAX_ONE_ACTIVE");
    expect(isEligible([MAX_ONE_ACTIVE_PARTICIPATION], context)).toBe(false);
  });

  it("is eligible when every configured rule passes", () => {
    const context = {
      userId: "u1",
      roomId: "r1",
      requestedPositionCount: 1,
      existingActiveParticipationCount: 0,
    };
    expect(isEligible([MAX_ONE_ACTIVE_PARTICIPATION], context)).toBe(true);
  });
});
