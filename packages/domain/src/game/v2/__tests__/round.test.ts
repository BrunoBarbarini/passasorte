import { describe, expect, it } from "vitest";
import {
  entrySequenceOrder,
  ENTRY_SEQUENCE_ORDER_POLICY,
  selectLatestSubmissions,
} from "../index.js";
import type { RoundInput } from "../index.js";
import { engine, expectCode, lcg, startGame } from "./helpers.js";

const OPEN = "2026-11-11T19:00:00.000Z";
const CLOSE = "2026-11-11T19:01:00.000Z";
const RESOLVE = "2026-11-11T19:01:01.000Z";

function round(
  state: ReturnType<typeof startGame>,
  overrides: Partial<RoundInput> = {},
): RoundInput {
  return {
    roundId: "r1",
    roundNumber: 1,
    windowOpensAt: OPEN,
    windowClosesAt: CLOSE,
    resolutionStartedAt: RESOLVE,
    submissions: [],
    resolutionOrder: entrySequenceOrder(state),
    resolutionOrderPolicy: ENTRY_SEQUENCE_ORDER_POLICY,
    ...overrides,
  };
}

const FOUR = [
  { id: "A", count: 4, balance: 10 },
  { id: "B", count: 4, balance: 10, auto: "RIGHT" as const },
  { id: "C", count: 4, balance: 0, auto: "LEFT" as const },
  { id: "D", count: 4, balance: 10 },
];

describe("collective round resolution (DECISION-16..21)", () => {
  it("gives every participant exactly one outcome: manual, automatic, skipped", () => {
    const state = startGame(FOUR, 8);
    const resolution = engine.resolveRound(
      state,
      round(state, {
        submissions: [{ participantId: "A", kind: "RIGHT", credits: 3, submittedAt: OPEN }],
      }),
    );
    expect(resolution.audit.map((row) => [row.participantId, row.outcome])).toEqual([
      ["A", "APPLIED"],
      ["B", "APPLIED"],
      ["C", "SKIPPED"],
      ["D", "SKIPPED"],
    ]);
    const [a, b, c, d] = resolution.audit;
    expect(a).toMatchObject({ executionType: "MANUAL", action: "RIGHT", movementsConsumed: 3 });
    expect(b).toMatchObject({ executionType: "AUTOMATIC", action: "RIGHT", movementsConsumed: 1 });
    expect(c).toMatchObject({ skipReason: "NO_MOVEMENTS_LEFT", movementsConsumed: 0 });
    expect(d).toMatchObject({ skipReason: "ABSENT_NO_AUTO_ACTION", movementsConsumed: 0 });
    expect(resolution.luckPositionBeforeRound).toBe(8);
    expect(resolution.luckPositionAfterRound).toBe(12);
  });

  it("records the audit fields required by DECISION-21", () => {
    const state = startGame(FOUR, 1);
    const resolution = engine.resolveRound(
      state,
      round(state, {
        submissions: [
          {
            participantId: "D",
            kind: "LEFT",
            credits: 2,
            submittedAt: CLOSE.replace("01:00", "00:30"),
          },
        ],
      }),
    );
    const row = resolution.audit.find((r) => r.participantId === "D");
    expect(row).toMatchObject({
      roundNumber: 1,
      windowOpensAt: OPEN,
      windowClosesAt: CLOSE,
      entrySequence: 4,
      resolutionSequence: 3,
      actionSubmittedAt: "2026-11-11T19:00:30.000Z",
      executionType: "MANUAL",
      movementsConsumed: 2,
    });
    expect(resolution.resolutionOrderPolicy).toBe(ENTRY_SEQUENCE_ORDER_POLICY);
    // before/after chain from one action to the next
    for (let i = 1; i < resolution.audit.length; i += 1) {
      expect(resolution.audit[i]?.luckPositionBefore).toBe(
        resolution.audit[i - 1]?.luckPositionAfter,
      );
    }
  });

  it("does not depend on the resolution order for the end-of-round Sorte", () => {
    const rand = lcg(7);
    for (let game = 0; game < 50; game += 1) {
      const state = startGame(FOUR, 1 + Math.floor(rand() * 16));
      const submissions = (["A", "D"] as const).map((participantId) => ({
        participantId,
        kind: rand() < 0.5 ? ("LEFT" as const) : ("RIGHT" as const),
        credits: 1 + Math.floor(rand() * 9),
        submittedAt: OPEN,
      }));
      const ids = entrySequenceOrder(state);
      const shuffled = [...ids].sort(() => rand() - 0.5);
      const a = engine.resolveRound(state, round(state, { submissions }));
      const b = engine.resolveRound(
        state,
        round(state, { submissions, resolutionOrder: shuffled }),
      );
      expect(b.luckPositionAfterRound).toBe(a.luckPositionAfterRound);
      expect(b.state.seats.map((s) => s.movementBalance)).toEqual(
        a.state.seats.map((s) => s.movementBalance),
      );
    }
  });

  it("rebuilds the same hash chain from the returned steps (replay)", () => {
    const state = startGame(FOUR, 5);
    const resolution = engine.resolveRound(
      state,
      round(state, {
        submissions: [{ participantId: "A", kind: "LEFT", credits: 6, submittedAt: OPEN }],
      }),
    );
    const replayed = engine.replay({
      init: {
        config: state.config,
        participants: state.seats,
        randomnessCommitmentHash: "a".repeat(64),
        initialSortePosition: 5,
      },
      steps: resolution.steps,
      expectedTransitions: resolution.transitions,
    });
    expect(replayed.state.stateHash).toBe(resolution.state.stateHash);
  });

  it("closes the window at serverTime >= windowClosesAt and rejects early submissions", () => {
    const state = startGame(FOUR, 1);
    const at = (submittedAt: string) => () =>
      engine.resolveRound(
        state,
        round(state, {
          submissions: [{ participantId: "A", kind: "RIGHT", credits: 1, submittedAt }],
        }),
      );
    expectCode(at(CLOSE), "SUBMISSION_OUTSIDE_WINDOW");
    expectCode(at("2026-11-11T18:59:59.999Z"), "SUBMISSION_OUTSIDE_WINDOW");
    expect(at("2026-11-11T19:00:59.999Z")).not.toThrow();
  });

  it("accepts at most one action per participant per round", () => {
    const state = startGame(FOUR, 1);
    expectCode(
      () =>
        engine.resolveRound(
          state,
          round(state, {
            submissions: [
              { participantId: "A", kind: "RIGHT", credits: 1, submittedAt: OPEN },
              { participantId: "A", kind: "LEFT", credits: 1, submittedAt: OPEN },
            ],
          }),
        ),
      "DUPLICATE_ROUND_ACTION",
    );
  });

  it("does not resolve before the window closes", () => {
    const state = startGame(FOUR, 1);
    expectCode(
      () => engine.resolveRound(state, round(state, { resolutionStartedAt: OPEN })),
      "ROUND_NOT_CLOSED",
    );
  });

  it("requires the order to contain every participant exactly once", () => {
    const state = startGame(FOUR, 1);
    expectCode(
      () => engine.resolveRound(state, round(state, { resolutionOrder: ["A", "B", "C"] })),
      "INVALID_ROUND",
    );
    expectCode(
      () => engine.resolveRound(state, round(state, { resolutionOrder: ["A", "A", "B", "C"] })),
      "INVALID_ROUND",
    );
  });

  it("rejects an invalid manual action at submission time (cap, balance)", () => {
    const state = startGame(FOUR, 1, 2);
    expectCode(
      () => engine.validateSubmission(state, { participantId: "A", kind: "RIGHT", credits: 3 }),
      "EXCEEDS_ROUND_CAP",
    );
    expectCode(
      () => engine.validateSubmission(state, { participantId: "C", kind: "RIGHT", credits: 1 }),
      "INSUFFICIENT_MOVEMENTS",
    );
    expect(() =>
      engine.validateSubmission(state, { participantId: "A", kind: "RIGHT", credits: 2 }),
    ).not.toThrow();
  });

  it("cannot resolve the same round twice", () => {
    const state = startGame(FOUR, 1);
    const first = engine.resolveRound(state, round(state));
    expectCode(
      () => engine.resolveRound(first.state, round(first.state)),
      "ROUND_ACTION_ALREADY_CONSUMED",
    );
  });

  it("keeps resolving later rounds against the new state", () => {
    const state = startGame(FOUR, 1);
    const first = engine.resolveRound(state, round(state));
    const second = engine.resolveRound(
      first.state,
      round(first.state, { roundId: "r2", roundNumber: 2 }),
    );
    expect(second.luckPositionBeforeRound).toBe(first.luckPositionAfterRound);
    expect(second.state.sequence).toBe(8);
  });

  it("uses the last replaced submission and applies it in entrySequence order (T-32, T-33)", () => {
    const state = startGame(FOUR, 8);
    const submissions = selectLatestSubmissions([
      {
        participantId: "A",
        kind: "LEFT",
        credits: 5,
        submittedAt: "2026-11-11T19:00:10.000Z",
        submissionSequence: 1,
      },
      {
        participantId: "D",
        kind: "RIGHT",
        credits: 1,
        submittedAt: "2026-11-11T19:00:12.000Z",
        submissionSequence: 1,
      },
      {
        participantId: "A",
        kind: "RIGHT",
        credits: 2,
        submittedAt: "2026-11-11T19:00:40.000Z",
        submissionSequence: 2,
      },
    ]);
    expect(submissions).toHaveLength(2);
    const resolution = engine.resolveRound(state, round(state, { submissions }));
    const a = resolution.audit.find((r) => r.participantId === "A");
    expect(a).toMatchObject({ movementsConsumed: 2, executionType: "MANUAL" });
    expect(a?.actionSubmittedAt).toBe("2026-11-11T19:00:40.000Z");
    expect(resolution.audit.map((r) => r.entrySequence)).toEqual([1, 2, 3, 4]);
    expect(resolution.audit.map((r) => r.resolutionSequence)).toEqual([0, 1, 2, 3]);
  });

  it("selectLatestSubmissions is independent of storage order and rejects equal sequences", () => {
    const one = { participantId: "A", kind: "LEFT" as const, credits: 1, submittedAt: OPEN };
    const two = { ...one, kind: "RIGHT" as const, credits: 3, submissionSequence: 2 };
    const first = { ...one, submissionSequence: 1 };
    expect(selectLatestSubmissions([two, first])).toEqual(selectLatestSubmissions([first, two]));
    expect(selectLatestSubmissions([first, two])[0]).toMatchObject({ kind: "RIGHT", credits: 3 });
    expectCode(
      () => selectLatestSubmissions([first, { ...two, submissionSequence: 1 }]),
      "DUPLICATE_ROUND_ACTION",
    );
  });
});
