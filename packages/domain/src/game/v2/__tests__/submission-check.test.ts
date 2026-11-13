import { describe, expect, it } from "vitest";
import { assertManualSubmissionAllowed } from "../index.js";
import { expectCode } from "./helpers.js";

const CONFIG = { winningZoneSize: 1, maxMovementsPerRound: 3 } as const;

describe("assertManualSubmissionAllowed (same rules as validateSubmission, no full state)", () => {
  it("accepts a legal action within cap and balance", () => {
    expect(() =>
      assertManualSubmissionAllowed(CONFIG, 5, { kind: "LEFT", credits: 3 }),
    ).not.toThrow();
    expect(() =>
      assertManualSubmissionAllowed(CONFIG, 1, { kind: "STAY", credits: 1 }),
    ).not.toThrow();
  });

  it("rejects over the per-round cap, over the balance, STAY != 1 and credits < 1", () => {
    expectCode(
      () => assertManualSubmissionAllowed(CONFIG, 10, { kind: "RIGHT", credits: 4 }),
      "EXCEEDS_ROUND_CAP",
    );
    expectCode(
      () => assertManualSubmissionAllowed(CONFIG, 2, { kind: "RIGHT", credits: 3 }),
      "INSUFFICIENT_MOVEMENTS",
    );
    expectCode(
      () => assertManualSubmissionAllowed(CONFIG, 10, { kind: "STAY", credits: 2 }),
      "INVALID_CREDITS",
    );
    expectCode(
      () => assertManualSubmissionAllowed(CONFIG, 10, { kind: "LEFT", credits: 0 }),
      "INVALID_CREDITS",
    );
  });
});
