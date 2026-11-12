import { describe, expect, it } from "vitest";
import { describeSkipReasonPtBr, verifyHashChain } from "../index.js";
import type { GameInitInput, ReplayStep, Transition } from "../index.js";
import {
  BAR_200,
  COMMITMENT,
  T0,
  engine,
  expectCode,
  initInput,
  manual,
  startGame,
} from "./helpers.js";

describe("GameEngine V2 - movement on the circular bar", () => {
  it("G-01/G-04 through the engine: 198 + RIGHT x4 -> 2, balance consumed, positions untouched", () => {
    const state = startGame(BAR_200, 198);
    const { state: next, transition } = engine.applyMovement(state, manual("A", "RIGHT", 4));
    expect(next.sortePosition).toBe(2);
    expect(transition.sorteBefore).toBe(198);
    expect(transition.sorteAfter).toBe(2);
    expect(transition.creditsConsumed).toBe(4);
    expect(next.seats[0]?.movementBalance).toBe(6);
    expect(next.seats.map((s) => s.positions)).toEqual(state.seats.map((s) => s.positions));
    expect(next.size).toBe(200);
  });

  it("the shared Sorte passes to the next participant where it was left", () => {
    let state = startGame(BAR_200, 100);
    state = engine.applyMovement(state, manual("A", "RIGHT", 3)).state;
    state = engine.applyMovement(state, manual("B", "LEFT", 1)).state;
    expect(state.sortePosition).toBe(102);
  });

  it("G-14: maxMovementsPerRound caps MANUAL commands; null means no limit (explicit choice)", () => {
    const capped = startGame(BAR_200, 10, 3);
    expect(engine.applyMovement(capped, manual("A", "RIGHT", 3)).state.sortePosition).toBe(13);
    expectCode(() => engine.applyMovement(capped, manual("A", "RIGHT", 4)), "EXCEEDS_ROUND_CAP");
    const unlimited = startGame(BAR_200, 10, null);
    expect(engine.applyMovement(unlimited, manual("A", "RIGHT", 10)).state.sortePosition).toBe(20);
  });

  it("requires an explicit maxMovementsPerRound (no default, BR-068)", () => {
    const input = initInput(BAR_200, 10);
    const missing = { ...input, config: { winningZoneSize: 1 } } as unknown as GameInitInput;
    expectCode(() => engine.initialize(missing), "INVALID_CONFIG");
    const zero = { ...input, config: { winningZoneSize: 1, maxMovementsPerRound: 0 } };
    expectCode(() => engine.initialize(zero), "INVALID_CONFIG");
  });

  it("G-15: a manual STAY consumes exactly 1 movement and never displaces", () => {
    const state = startGame(BAR_200, 50);
    const { state: next, transition } = engine.applyMovement(state, manual("A", "STAY", 1));
    expect(next.sortePosition).toBe(50);
    expect(transition.creditsConsumed).toBe(1);
    expect(next.seats[0]?.movementBalance).toBe(9);
    expectCode(() => engine.applyMovement(state, manual("A", "STAY", 2)), "INVALID_CREDITS");
  });

  it("never lets the balance go negative (BR-020)", () => {
    const state = startGame(BAR_200, 50);
    expectCode(
      () => engine.applyMovement(state, manual("A", "RIGHT", 11)),
      "INSUFFICIENT_MOVEMENTS",
    );
    expectCode(() => engine.applyMovement(state, manual("A", "RIGHT", 0)), "INVALID_CREDITS");
  });

  it("G-16: a round action can be consumed only once", () => {
    const state = startGame(BAR_200, 50);
    const first = engine.applyMovement(state, manual("A", "RIGHT", 1, "action-x"));
    expectCode(
      () => engine.applyMovement(first.state, manual("B", "RIGHT", 1, "action-x")),
      "ROUND_ACTION_ALREADY_CONSUMED",
    );
  });

  it("rejects unknown participants and moves after completion", () => {
    const state = startGame(BAR_200, 50);
    expectCode(() => engine.applyMovement(state, manual("Z", "RIGHT", 1)), "UNKNOWN_PARTICIPANT");
    const done = engine.complete(state, { serverTime: T0 }).state;
    expectCode(() => engine.applyMovement(done, manual("A", "RIGHT", 1)), "GAME_NOT_RUNNING");
  });
});

describe("GameEngine V2 - absent participants (DECISION-03/04, BR-070)", () => {
  const specs = [
    { id: "A", count: 100, balance: 5, auto: "RIGHT" as const },
    { id: "B", count: 100, balance: 5, auto: "NONE" as const },
    { id: "C", count: 0, balance: 0, auto: "LEFT" as const },
  ];

  it("G-06: absent + autoAction RIGHT executes exactly 1 movement, recorded AUTOMATIC", () => {
    const state = startGame(specs, 40);
    const plan = engine.planAbsentAction(state, "A");
    expect(plan).toEqual({ action: "AUTOMATIC", kind: "RIGHT", credits: 1 });
    const { state: next, transition } = engine.applyMovement(state, {
      ...manual("A", "RIGHT", 1),
      executionType: "AUTOMATIC",
    });
    expect(next.sortePosition).toBe(41);
    expect(next.seats[0]?.movementBalance).toBe(4);
    expect(transition.command.executionType).toBe("AUTOMATIC");
    expect(transition.creditsConsumed).toBe(1);
  });

  it("G-07: absent + autoAction NONE skips the round action at no cost, still hash-chained", () => {
    const state = startGame(specs, 40);
    expect(engine.planAbsentAction(state, "B")).toEqual({
      action: "SKIP",
      reason: "ABSENT_NO_AUTO_ACTION",
    });
    const { state: next, transition } = engine.skipAction(state, {
      participantId: "B",
      actionId: "action-skip-1",
      round: 1,
      resolutionSequence: 1,
      serverTime: T0,
    });
    expect(transition.outcome).toBe("SKIPPED");
    expect(transition.skipReason).toBe("ABSENT_NO_AUTO_ACTION");
    expect(transition.creditsConsumed).toBe(0);
    expect(next.seats[1]?.movementBalance).toBe(5);
    expect(next.sortePosition).toBe(40);
    expect(next.sequence).toBe(1);
    expect(next.stateHash).not.toBe(state.stateHash);
    expect(transition.previousStateHash).toBe(state.stateHash);
    expect(describeSkipReasonPtBr(transition.skipReason)).toContain("Você perdeu sua vez");
  });

  it("G-13: auto action with zero balance becomes a skip with reason NO_MOVEMENTS_LEFT", () => {
    const state = startGame(specs, 40);
    expect(engine.planAbsentAction(state, "C")).toEqual({
      action: "SKIP",
      reason: "NO_MOVEMENTS_LEFT",
    });
    const { transition } = engine.skipAction(state, {
      participantId: "C",
      actionId: "action-c",
      round: 1,
      resolutionSequence: 2,
      serverTime: T0,
    });
    expect(transition.skipReason).toBe("NO_MOVEMENTS_LEFT");
    expect(describeSkipReasonPtBr("NO_MOVEMENTS_LEFT")).not.toContain("ausente");
  });

  it("rejects an AUTOMATIC command that does not match the configured action or is not 1 movement", () => {
    const state = startGame(specs, 40);
    expectCode(
      () => engine.applyMovement(state, { ...manual("A", "LEFT", 1), executionType: "AUTOMATIC" }),
      "AUTOMATIC_MISMATCH",
    );
    expectCode(
      () => engine.applyMovement(state, { ...manual("A", "RIGHT", 2), executionType: "AUTOMATIC" }),
      "AUTOMATIC_MISMATCH",
    );
    expectCode(
      () => engine.applyMovement(state, { ...manual("B", "RIGHT", 1), executionType: "AUTOMATIC" }),
      "AUTOMATIC_MISMATCH",
    );
  });

  it("refuses to skip a round action that must execute the configured auto action", () => {
    const state = startGame(specs, 40);
    expectCode(
      () =>
        engine.skipAction(state, {
          participantId: "A",
          actionId: "t",
          round: 1,
          resolutionSequence: 0,
          serverTime: T0,
        }),
      "SKIP_NOT_APPLICABLE",
    );
  });
});

describe("GameEngine V2 - completion, expiry and winner (DECISION-04/06)", () => {
  it("G-08: unused movements EXPIRE at completion; nothing is converted or carried over", () => {
    const specs = [
      { id: "A", count: 50, balance: 3 },
      { id: "B", count: 50, balance: 0 },
    ];
    let state = startGame(specs, 10);
    state = engine.applyMovement(state, manual("A", "RIGHT", 1)).state;
    const { state: done, transition } = engine.complete(state, { serverTime: T0 });
    expect(transition.expired).toEqual([{ participantId: "A", movements: 2 }]);
    expect(done.status).toBe("COMPLETED");
    expect(done.seats.map((s) => s.movementBalance)).toEqual([0, 0]);
    expect(done.seats.map((s) => s.movementsExpired)).toEqual([2, 0]);
    expectCode(() => engine.complete(done, { serverTime: T0 }), "GAME_NOT_RUNNING");
  });

  it("G-09: winningZoneSize 1, N=300, final Sorte 187 -> position 187 wins; its owner is the only winner", () => {
    const specs = [
      { id: "A", count: 150, balance: 2 },
      { id: "B", count: 150, balance: 2 },
    ];
    const done = engine.complete(startGame(specs, 187), { serverTime: T0 }).state;
    const result = engine.calculateWinners(done);
    expect(result.winningPositions).toEqual([187]);
    expect(result.winners).toEqual([{ participantId: "B", winningPositions: [187] }]);
    expect(result.finalStateHash).toBe(done.stateHash);
  });

  it("the winner follows the final Sorte position after wrapping", () => {
    const specs = [
      { id: "A", count: 100, balance: 10 },
      { id: "B", count: 100, balance: 10 },
    ];
    let state = startGame(specs, 198);
    state = engine.applyMovement(state, manual("B", "RIGHT", 4)).state; // 198 -> 2
    const result = engine.calculateWinners(engine.complete(state, { serverTime: T0 }).state);
    expect(result.winners[0]?.participantId).toBe("A");
  });

  it("the result only exists after completion", () => {
    expectCode(() => engine.calculateWinners(startGame(BAR_200, 5)), "GAME_NOT_COMPLETED");
  });

  it("G-10: winningZoneSize greater than 1 is rejected for real rooms", () => {
    const input = initInput(BAR_200, 5);
    expectCode(
      () =>
        engine.initialize({ ...input, config: { winningZoneSize: 3, maxMovementsPerRound: null } }),
      "UNSUPPORTED_WINNING_ZONE",
    );
  });

  it("every position must have exactly one owner and the Sorte must start inside the bar", () => {
    const input = initInput(BAR_200, 5);
    const hole = {
      ...input,
      participants: [{ ...input.participants[0]!, positions: [1, 3] }],
    };
    expectCode(() => engine.initialize(hole), "INVALID_SEATS");
    expectCode(() => engine.initialize(initInput(BAR_200, 201)), "INVALID_POSITION");
    expectCode(() => engine.initialize(initInput(BAR_200, 0)), "INVALID_POSITION");
  });
});

describe("GameEngine V2 - replay and hash chain (NFR-005, G-12)", () => {
  function playSomeGame(): {
    init: GameInitInput;
    steps: ReplayStep[];
    transitions: Transition[];
    genesis: string;
  } {
    const specs = [
      { id: "A", count: 100, balance: 5, auto: "RIGHT" as const },
      { id: "B", count: 100, balance: 5, auto: "NONE" as const },
    ];
    const init = initInput(specs, 198, 3);
    let state = engine.initialize(init);
    const genesis = state.stateHash;
    const steps: ReplayStep[] = [];
    const transitions: Transition[] = [];
    const run = (step: ReplayStep): void => {
      const result =
        step.type === "MOVEMENT"
          ? engine.applyMovement(state, step.command)
          : step.type === "SKIP"
            ? engine.skipAction(state, step.input)
            : engine.complete(state, step.input);
      steps.push(step);
      transitions.push(result.transition);
      state = result.state;
    };
    run({ type: "MOVEMENT", command: manual("A", "RIGHT", 3, "g-1") });
    run({
      type: "SKIP",
      input: {
        participantId: "B",
        actionId: "g-2",
        round: 1,
        resolutionSequence: 1,
        serverTime: T0,
      },
    });
    run({
      type: "MOVEMENT",
      command: { ...manual("A", "RIGHT", 1, "g-3"), executionType: "AUTOMATIC" },
    });
    run({ type: "COMPLETE", input: { serverTime: T0 } });
    return { init, steps, transitions, genesis };
  }

  it("replaying the immutable history reproduces identical states and hash chain", () => {
    const { init, steps, transitions, genesis } = playSomeGame();
    const replayed = engine.replay({ init, steps, expectedTransitions: transitions });
    expect(replayed.transitions).toEqual(transitions);
    expect(replayed.state.status).toBe("COMPLETED");
    expect(replayed.result?.winningPositions).toEqual([replayed.state.sortePosition]);
    expect(() => verifyHashChain(genesis, transitions)).not.toThrow();
    expect(genesis).toHaveLength(64);
    expect(COMMITMENT).toHaveLength(64);
  });

  it("is deterministic: replaying twice gives byte-identical results", () => {
    const { init, steps } = playSomeGame();
    expect(engine.replay({ init, steps })).toEqual(engine.replay({ init, steps }));
  });

  it("detects a tampered stored transition", () => {
    const { init, steps, transitions, genesis } = playSomeGame();
    const forged = transitions.map((t, i) => (i === 0 ? { ...t, sorteAfter: 7 } : t));
    expectCode(() => verifyHashChain(genesis, forged), "REPLAY_MISMATCH");
    const forgedHash = transitions.map((t, i) =>
      i === 2 ? { ...t, currentStateHash: "0".repeat(64) } : t,
    );
    expectCode(
      () => engine.replay({ init, steps, expectedTransitions: forgedHash }),
      "REPLAY_MISMATCH",
    );
    expectCode(
      () => engine.replay({ init, steps, expectedTransitions: transitions.slice(1) }),
      "REPLAY_MISMATCH",
    );
  });

  it("detects a swapped commitment hash in the genesis (different chain)", () => {
    const { init, steps, transitions } = playSomeGame();
    const other = { ...init, randomnessCommitmentHash: "b".repeat(64) };
    expectCode(
      () => engine.replay({ init: other, steps, expectedTransitions: transitions }),
      "REPLAY_MISMATCH",
    );
  });
});
