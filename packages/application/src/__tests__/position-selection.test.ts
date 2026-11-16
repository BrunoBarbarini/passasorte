/* eslint-disable @typescript-eslint/require-await -- in-memory test fakes intentionally implement async interfaces synchronously */
import { describe, expect, it } from "vitest";
import type { GameRoom, Participation } from "@passasorte/domain";
import { StartPositionSelectionUseCase } from "../use-cases/game/start-position-selection.use-case.js";
import { PickPositionsUseCase } from "../use-cases/game/pick-positions.use-case.js";
import { AutoAllocateExpiredPicksUseCase } from "../use-cases/game/auto-allocate-expired-picks.use-case.js";
import { NotifyPositionSelectionTurnsUseCase } from "../use-cases/game/notify-position-selection-turns.use-case.js";
import { SetPositionSelectionConfigUseCase } from "../use-cases/room/set-position-selection-config.use-case.js";
import type { PublishOutboxEventInput } from "../ports/outbox.port.js";
import type { RecordAuditLogInput } from "../ports/audit-log.port.js";
import type {
  CommitPickInput,
  CommitSelectionStartInput,
  PositionSelectionPort,
  RecordTurnNoticeInput,
  SelectionAssignment,
  SelectionSnapshot,
  SelectionWindowRecord,
} from "../ports/position-selection.port.js";
import type { ParticipationRepository } from "../ports/participation-repository.port.js";
import type { RoomRepository } from "../ports/room-repository.port.js";
import { ConflictError, DomainError, ValidationError } from "../errors.js";

const T0 = new Date("2026-11-14T12:00:00.000Z");
const at = (seconds: number): Date => new Date(T0.getTime() + seconds * 1000);
const SEED = "cd".repeat(32);
const WINDOW_MS = 60_000;

/** a: 2 positions, b: 3, c: 1 -> board of 6; entry order a, b, c. */
class Fixture {
  room = {
    id: "room",
    status: "ENTRY_LOCKED",
    participationPackages: [
      { id: "p2", positionCount: 2, movementAllowance: 4 },
      { id: "p3", positionCount: 3, movementAllowance: 4 },
      { id: "p1", positionCount: 1, movementAllowance: 4 },
    ],
    campaignId: "camp",
    positionSelection: null,
    positionSelectionConfig: {
      selectionWindowSeconds: WINDOW_MS / 1000,
      warningThresholdSeconds: [30, 10],
      upcomingTurnThresholds: [2],
      autoAssignOnTimeout: true,
    },
  } as unknown as GameRoom & { status: string; positionSelection: unknown };
  entries = [
    { participationId: "a", userId: "ua", entrySequence: 1, packageId: "p2" },
    { participationId: "b", userId: "ub", entrySequence: 2, packageId: "p3" },
    { participationId: "c", userId: "uc", entrySequence: 3, packageId: "p1" },
  ];
  assignments: SelectionAssignment[] = [];
  /** DECISION-34: audit rows written by commitPick. */
  windows: SelectionWindowRecord[] = [];
  /** Every outbox event published, in order. */
  events: PublishOutboxEventInput[] = [];
  notices = new Set<string>();
  commits: CommitPickInput[] = [];
  seed: { seedHex: string; commitmentHash: string } | null = null;
  started: CommitSelectionStartInput[] = [];
  staleOnce = false;
  now = at(0);

  rooms = {
    findById: async () => this.room,
  } as unknown as RoomRepository;
  participations = {
    findById: async (id: string) =>
      this.entries.some((e) => e.participationId === id)
        ? ({ id, roomId: "room", status: "CONFIRMED" } as unknown as Participation)
        : null,
  } as unknown as ParticipationRepository;

  port: PositionSelectionPort = {
    loadSnapshot: async (): Promise<SelectionSnapshot> => ({
      entries: this.entries,
      assignments: [...this.assignments],
    }),
    commitSelectionStart: async (input) => {
      this.started.push(input);
      this.seed = { seedHex: input.seedHex, commitmentHash: input.commitmentHash };
      (this.room as { status: string }).status = "POSITION_SELECTION";
      (this.room as { positionSelection: unknown }).positionSelection = {
        pickWindowMs: input.pickWindowMs,
        warningThresholdSeconds: input.warningThresholdSeconds,
        upcomingTurnThresholds: input.upcomingTurnThresholds,
        startedAt: input.startedAt.toISOString(),
        boardSize: input.boardSize,
      };
      this.events.push(...input.events);
      return this.room;
    },
    loadSealedSeed: async () => this.seed,
    commitPick: async (input: CommitPickInput) => {
      if (this.staleOnce) {
        this.staleOnce = false;
        throw new ConflictError("Outra escolha foi registrada primeiro.");
      }
      if (input.expectedPickCount !== this.assignments.length) throw new ConflictError("stale");
      this.commits.push(input);
      this.events.push(...input.events);
      this.windows.push({
        participationId: input.participationId,
        entrySequence: input.window.entrySequence,
        windowOpenedAt: input.window.openedAt,
        windowClosesAt: input.window.closesAt,
        selectionType: input.kind,
        selectedPositions: input.positions,
        automaticSelectionReason: input.kind === "AUTOMATIC" ? "TIMEOUT" : null,
        selectionCompletedAt: input.pickedAt,
      });
      this.assignments.push({
        participationId: input.participationId,
        positions: input.positions,
        pickedAt: input.pickedAt,
        kind: input.kind,
      });
      const completed = this.assignments.length === this.entries.length;
      if (completed) (this.room as { status: string }).status = "READY";
      return { completed };
    },
    listRoomIdsInSelection: async () => ["room"],
    recordTurnNotice: async (input: RecordTurnNoticeInput) => {
      const key = `${input.participationId}:${input.kind}:${input.threshold}`;
      if (this.notices.has(key)) return false;
      this.notices.add(key);
      if (input.event) this.events.push(input.event);
      return true;
    },
    loadWindowRecord: async (id: string) =>
      this.windows.find((window) => window.participationId === id) ?? null,
  };

  start = () =>
    new StartPositionSelectionUseCase(
      this.rooms,
      this.port,
      () => this.now,
      () => SEED,
    );
  pick = () => new PickPositionsUseCase(this.participations, this.rooms, this.port, () => this.now);
  auto = (clock: () => Date = () => this.now) =>
    new AutoAllocateExpiredPicksUseCase(this.rooms, this.port, clock);
  notify = () => new NotifyPositionSelectionTurnsUseCase(this.rooms, this.port, () => this.now);

  async begin(): Promise<void> {
    await this.start().execute({ roomId: "room" });
  }

  eventsOfType(type: string): PublishOutboxEventInput[] {
    return this.events.filter((event) => event.eventType === type);
  }
}

describe("StartPositionSelectionUseCase", () => {
  it("computes the board as the sum of position credits and seals the seed", async () => {
    const fx = new Fixture();
    await fx.begin();
    const started = fx.started[0] as CommitSelectionStartInput;
    expect(started.boardSize).toBe(6);
    expect(started.pickWindowMs).toBe(WINDOW_MS);
    expect(started.commitmentHash).toHaveLength(64);
    expect(started.events[0]?.eventType).toBe("selection.started");
  });

  it("takes the window from the room config and freezes the UX marks (DECISION-23)", async () => {
    const fx = new Fixture();
    (fx.room as { positionSelectionConfig: unknown }).positionSelectionConfig = {
      selectionWindowSeconds: 120,
      warningThresholdSeconds: [60, 20],
      autoAssignOnTimeout: true,
    };
    await fx.begin();
    const started = fx.started[0] as CommitSelectionStartInput;
    expect(started.pickWindowMs).toBe(120_000);
    expect(started.warningThresholdSeconds).toEqual([60, 20]);
    expect(started.upcomingTurnThresholds).toBeUndefined();
  });

  it("different rooms/campaigns may use different windows (DECISION-36)", async () => {
    const fast = new Fixture();
    (
      fast.room as { positionSelectionConfig: { selectionWindowSeconds: number } }
    ).positionSelectionConfig.selectionWindowSeconds = 30;
    (
      fast.room as unknown as { positionSelectionConfig: { warningThresholdSeconds: number[] } }
    ).positionSelectionConfig.warningThresholdSeconds = [10];
    await fast.begin();
    const slow = new Fixture();
    await slow.begin();
    expect(fast.started[0]?.pickWindowMs).toBe(30_000);
    expect(slow.started[0]?.pickWindowMs).toBe(60_000);
  });

  it("opens the first participant's window with an event for them (DECISION-24)", async () => {
    const fx = new Fixture();
    await fx.begin();
    const opened = fx.eventsOfType("position_selection.window_opened");
    expect(opened).toHaveLength(1);
    expect(opened[0]?.payload).toMatchObject({
      userId: "ua",
      participationId: "a",
      entrySequence: 1,
      positionCount: 2,
      opensAt: T0.toISOString(),
      closesAt: at(60).toISOString(),
    });
  });

  it("requires ENTRY_LOCKED, a configured window and entry order for every seat", async () => {
    const wrongState = new Fixture();
    (wrongState.room as { status: string }).status = "OPEN";
    await expect(wrongState.begin()).rejects.toBeInstanceOf(DomainError);

    // No default exists (DECISION-23, BR-068).
    const noConfig = new Fixture();
    (noConfig.room as { positionSelectionConfig: unknown }).positionSelectionConfig = null;
    await expect(noConfig.begin()).rejects.toMatchObject({
      details: { field: "positionSelectionConfig" },
    });
    expect(noConfig.started).toHaveLength(0);

    const noOrder = new Fixture();
    noOrder.entries = [
      {
        participationId: "a",
        userId: "ua",
        entrySequence: null as unknown as number,
        packageId: "p2",
      },
    ];
    await expect(noOrder.begin()).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("PickPositionsUseCase", () => {
  it("lets each participant pick exactly their count, in entry order, until READY", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(5);
    await expect(
      fx.pick().execute({ participationId: "b", positions: [1, 2, 3] }),
    ).rejects.toMatchObject({
      details: { reason: "NOT_YOUR_PICK_TURN" },
    });
    expect(await fx.pick().execute({ participationId: "a", positions: [6, 1] })).toMatchObject({
      positions: [1, 6],
      completed: false,
    });
    await expect(
      fx.pick().execute({ participationId: "b", positions: [1, 2, 3] }),
    ).rejects.toMatchObject({
      details: { reason: "POSITION_UNAVAILABLE" },
    });
    await expect(
      fx.pick().execute({ participationId: "b", positions: [2, 3] }),
    ).rejects.toMatchObject({
      details: { reason: "WRONG_POSITION_COUNT" },
    });
    await fx.pick().execute({ participationId: "b", positions: [2, 3, 4] });
    const last = await fx.pick().execute({ participationId: "c", positions: [5] });
    expect(last.completed).toBe(true);
    expect(fx.room.status).toBe("READY");
  });

  it("is idempotent for the same choice and rejects changing it", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(5);
    await fx.pick().execute({ participationId: "a", positions: [1, 2] });
    expect(await fx.pick().execute({ participationId: "a", positions: [2, 1] })).toMatchObject({
      idempotentReplay: true,
    });
    await expect(
      fx.pick().execute({ participationId: "a", positions: [3, 4] }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(fx.assignments).toHaveLength(1);
  });

  it("rejects a manual pick after the turn expired and outside the selection phase", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(61);
    await expect(
      fx.pick().execute({ participationId: "a", positions: [1, 2] }),
    ).rejects.toBeInstanceOf(DomainError);
    (fx.room as { status: string }).status = "READY";
    fx.now = at(5);
    await expect(
      fx.pick().execute({ participationId: "a", positions: [1, 2] }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("the next turn starts when the previous participant picked", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(50);
    await fx.pick().execute({ participationId: "a", positions: [1, 2] });
    fx.now = at(100); // 50s after a's pick: still inside b's 60s turn
    await fx.pick().execute({ participationId: "b", positions: [3, 4, 5] });
    fx.now = at(161); // 61s after b's pick: c is late
    await expect(
      fx.pick().execute({ participationId: "c", positions: [6] }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("AutoAllocateExpiredPicksUseCase", () => {
  it("does nothing while the turn is open", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(30);
    expect(await fx.auto().execute({ roomId: "room" })).toBe(0);
    expect(fx.assignments).toHaveLength(0);
  });

  it("allocates only the expired turn, then waits for the next one", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(61);
    expect(await fx.auto().execute({ roomId: "room" })).toBe(1);
    expect(fx.assignments[0]).toMatchObject({ participationId: "a", kind: "AUTOMATIC" });
    expect(fx.assignments[0]?.positions).toHaveLength(2);
    expect(await fx.auto().execute({ roomId: "room" })).toBe(0);
  });

  it("finishes the selection with no empty position, deterministically", async () => {
    const run = async (): Promise<string> => {
      const fx = new Fixture();
      await fx.begin();
      fx.now = at(61);
      await fx.auto().execute({ roomId: "room" });
      fx.now = at(200);
      await fx.auto().execute({ roomId: "room" });
      fx.now = at(400);
      await fx.auto().execute({ roomId: "room" });
      expect(fx.room.status).toBe("READY");
      const all = fx.assignments.flatMap((a) => a.positions).sort((x, y) => x - y);
      expect(all).toEqual([1, 2, 3, 4, 5, 6]);
      return JSON.stringify(fx.assignments.map((a) => [a.participationId, a.positions]));
    };
    expect(await run()).toBe(await run());
  });

  it("surfaces a stale decision as a conflict instead of overwriting", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(61);
    fx.staleOnce = true;
    await expect(fx.auto().execute({ roomId: "room" })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("DECISION-34: audit of every selection window", () => {
  it("records a MANUAL window with open/close/completion times and the chosen positions", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(20);
    await fx.pick().execute({ participationId: "a", positions: [2, 1] });
    const commit = fx.commits[0] as CommitPickInput;
    expect(commit.kind).toBe("MANUAL");
    expect(commit.window).toEqual({ entrySequence: 1, openedAt: at(0), closesAt: at(60) });
    expect(fx.windows[0]).toMatchObject({
      participationId: "a",
      selectionType: "MANUAL",
      selectedPositions: [1, 2],
      automaticSelectionReason: null,
      selectionCompletedAt: at(20),
    });
    const picked = fx.eventsOfType("positions.picked")[0];
    expect(picked?.payload).toMatchObject({
      userId: "ua",
      campaignId: "camp",
      participationId: "a",
      entrySequence: 1,
      positionCount: 2,
      selectionType: "MANUAL",
      selectionDurationMs: 20_000,
    });
    // the next window (DECISION-24) opens when this one closes
    expect(fx.eventsOfType("position_selection.window_opened").at(-1)?.payload).toMatchObject({
      participationId: "b",
      opensAt: at(20).toISOString(),
      closesAt: at(80).toISOString(),
    });
  });

  it("records an AUTOMATIC window with reason TIMEOUT and the timed-out/auto events", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(61);
    await fx.auto().execute({ roomId: "room" });
    expect(fx.windows[0]).toMatchObject({
      participationId: "a",
      selectionType: "AUTOMATIC",
      automaticSelectionReason: "TIMEOUT",
      windowOpenedAt: at(0),
      windowClosesAt: at(60),
      selectionCompletedAt: at(61),
    });
    expect(fx.eventsOfType("position_selection.timed_out")[0]?.payload).toMatchObject({
      userId: "ua",
      participationId: "a",
      entrySequence: 1,
    });
    const auto = fx.eventsOfType("positions.auto_allocated")[0];
    expect(auto?.payload).toMatchObject({
      userId: "ua",
      selectionType: "AUTOMATIC",
      automaticSelectionReason: "TIMEOUT",
      positionCount: 2,
    });
    expect(auto?.payload.positions).toEqual(fx.assignments[0]?.positions);
  });
});

describe("DECISION-27..33: absent participant", () => {
  it("1. a manual selection inside the window succeeds", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(59);
    await expect(
      fx.pick().execute({ participationId: "a", positions: [1, 2] }),
    ).resolves.toMatchObject({ completed: false });
  });

  it("2. a manual request after the deadline is rejected, also after the server already chose", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(60);
    await expect(
      fx.pick().execute({ participationId: "a", positions: [1, 2] }),
    ).rejects.toBeInstanceOf(DomainError);
    await fx.auto().execute({ roomId: "room" });
    const chosen = [...(fx.assignments[0]?.positions ?? [])];
    // neither a different choice nor the very same one can turn the automatic pick into a manual one
    for (const positions of [[5, 6], chosen]) {
      await expect(fx.pick().execute({ participationId: "a", positions })).rejects.toBeInstanceOf(
        DomainError,
      );
    }
    expect(fx.assignments).toHaveLength(1);
    expect(fx.assignments[0]?.kind).toBe("AUTOMATIC");
  });

  it("3 + 4. an absent participant gets automatic positions, exactly the bought count", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(61);
    await fx.auto().execute({ roomId: "room" });
    expect(fx.assignments[0]).toMatchObject({ participationId: "a", kind: "AUTOMATIC" });
    expect(fx.assignments[0]?.positions).toHaveLength(2); // package p2 = 2 position credits
  });

  it("5. never takes a position that belongs to someone else, nor creates new ones", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(5);
    await fx.pick().execute({ participationId: "a", positions: [1, 6] });
    fx.now = at(100); // b's window (opened at 5) is over
    await fx.auto().execute({ roomId: "room" });
    const b = fx.assignments.find((assignment) => assignment.participationId === "b");
    expect(b?.positions).toHaveLength(3);
    expect(b?.positions.every((position) => position >= 1 && position <= 6)).toBe(true);
    expect(b?.positions.some((position) => position === 1 || position === 6)).toBe(false);
    expect(new Set(b?.positions).size).toBe(3);
  });

  it("6. running the timeout job several times produces one single allocation", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(61);
    const results = [
      await fx.auto().execute({ roomId: "room" }),
      await fx.auto().execute({ roomId: "room" }),
      await fx.auto().execute({ roomId: "room" }),
    ];
    expect(results).toEqual([1, 0, 0]);
    expect(fx.assignments).toHaveLength(1);
    expect(fx.windows).toHaveLength(1);
    expect(fx.eventsOfType("positions.auto_allocated")).toHaveLength(1);
  });

  it("6b. two workers running at the same instant: exactly one wins, the other conflicts", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(61);
    const settled = await Promise.allSettled([
      fx.auto().execute({ roomId: "room" }),
      fx.auto().execute({ roomId: "room" }),
    ]);
    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = settled.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
    expect(fx.assignments).toHaveLength(1);
  });

  it("7. race between the confirmation and the timeout: exactly one of them wins", async () => {
    const fx = new Fixture();
    await fx.begin();
    // 00:59.950 the user confirms; 01:00.000 the timeout job starts; both read the same snapshot.
    const manual = new PickPositionsUseCase(
      fx.participations,
      fx.rooms,
      fx.port,
      () => new Date(T0.getTime() + 59_950),
    );
    const settled = await Promise.allSettled([
      manual.execute({ participationId: "a", positions: [3, 4] }),
      fx.auto(() => at(60)).execute({ roomId: "room" }),
    ]);
    expect(fx.assignments).toHaveLength(1); // never MANUAL + AUTOMATIC
    expect(fx.windows).toHaveLength(1);
    expect(settled.filter((result) => result.status === "rejected")).toHaveLength(1);
    const loser = settled.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(loser.reason).toBeInstanceOf(ConflictError);
  });

  it("8. the last participant gets exactly the remaining positions, no randomness needed", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(5);
    await fx.pick().execute({ participationId: "a", positions: [1, 2] });
    await fx.pick().execute({ participationId: "b", positions: [3, 4, 6] });
    fx.now = at(100);
    await fx.auto().execute({ roomId: "room" });
    expect(fx.assignments.find((a) => a.participationId === "c")?.positions).toEqual([5]);
    expect(fx.room.status).toBe("READY");
  });

  it("DECISION-33: a timeout does not move the participant, nor block the ones behind", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(61); // a is absent
    await fx.auto().execute({ roomId: "room" });
    // b is now the current picker with a fresh window opened at the timeout (not at the start)
    fx.now = at(100);
    const free = [1, 2, 3, 4, 5, 6].filter(
      (position) => !fx.assignments.some((a) => a.positions.includes(position)),
    );
    await expect(
      fx.pick().execute({ participationId: "b", positions: free.slice(0, 3) }),
    ).resolves.toBeDefined();
    expect(fx.assignments.filter((a) => a.participationId === "a")).toHaveLength(1);
    expect(fx.windows.map((w) => w.participationId)).toEqual(["a", "b"]);
  });
});

describe("DECISION-25/35: notices before the window ends and before the turn", () => {
  const warnings = (fx: Fixture) => fx.eventsOfType("position_selection.turn_warning");
  const approaching = (fx: Fixture) => fx.eventsOfType("position_selection.turn_approaching");

  it("warns the current picker once per mark, never twice", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(20); // 40s left: no mark crossed yet (marks 30s and 10s)
    expect(await fx.notify().execute({ roomId: "room" })).toBe(2); // only the approaching ones
    expect(warnings(fx)).toHaveLength(0);
    fx.now = at(31); // 29s left
    await fx.notify().execute({ roomId: "room" });
    await fx.notify().execute({ roomId: "room" });
    expect(warnings(fx)).toHaveLength(1);
    expect(warnings(fx)[0]?.payload).toMatchObject({ userId: "ua", thresholdSeconds: 30 });
    fx.now = at(52); // 8s left
    await fx.notify().execute({ roomId: "room" });
    expect(warnings(fx).map((e) => e.payload.thresholdSeconds)).toEqual([30, 10]);
  });

  it("a late run sends only the tightest crossed mark (no burst of alerts)", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(55); // 5s left: both marks crossed at once
    await fx.notify().execute({ roomId: "room" });
    expect(warnings(fx).map((e) => e.payload.thresholdSeconds)).toEqual([10]);
    await fx.notify().execute({ roomId: "room" });
    expect(warnings(fx)).toHaveLength(1);
  });

  it("does not warn a window that is already over (the server allocates instead)", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(61);
    await fx.notify().execute({ roomId: "room" });
    expect(warnings(fx)).toHaveLength(0);
  });

  it("tells waiting participants how many are ahead of them", async () => {
    const fx = new Fixture();
    (fx.room as { positionSelectionConfig: unknown }).positionSelectionConfig = {
      selectionWindowSeconds: 60,
      upcomingTurnThresholds: [1],
      autoAssignOnTimeout: true,
    };
    await fx.begin();
    await fx.notify().execute({ roomId: "room" });
    // only b has exactly 1 participant ahead; c has 2 (beyond the mark)
    expect(
      approaching(fx).map((e) => [e.payload.participationId, e.payload.participantsAhead]),
    ).toEqual([["b", 1]]);
    fx.now = at(10);
    await fx.pick().execute({ participationId: "a", positions: [1, 2] });
    await fx.notify().execute({ roomId: "room" });
    expect(approaching(fx).map((e) => e.payload.participationId)).toEqual(["b", "c"]);
  });

  it("does nothing outside the selection phase", async () => {
    const fx = new Fixture();
    expect(await fx.notify().execute({ roomId: "room" })).toBe(0);
  });
});

describe("SetPositionSelectionConfigUseCase (DECISION-23/36)", () => {
  const setup = () => {
    const fx = new Fixture();
    (fx.room as { status: string }).status = "OPEN";
    const saved: unknown[] = [];
    const audits: RecordAuditLogInput[] = [];
    const useCase = new SetPositionSelectionConfigUseCase(
      fx.rooms,
      {
        save: async (_id, config) => {
          saved.push(config);
          return fx.room;
        },
      },
      {
        record: async (input) => {
          audits.push(input);
        },
      },
    );
    return { fx, useCase, saved, audits };
  };
  const valid = {
    selectionWindowSeconds: 45,
    warningThresholdSeconds: [20],
    autoAssignOnTimeout: true as const,
  };

  it("stores the per-room window and audits who set it", async () => {
    const { useCase, saved, audits } = setup();
    await useCase.execute({ roomId: "room", config: valid, actorUserId: "op" });
    expect(saved).toEqual([valid]);
    expect(audits[0]).toMatchObject({
      actorUserId: "op",
      action: "room.position_selection_config_set",
      entityId: "room",
      metadata: { selectionWindowSeconds: 45 },
    });
  });

  it("rejects invalid settings: no zero window, warnings inside the window, auto-assign mandatory", async () => {
    const { useCase, saved } = setup();
    for (const config of [
      { ...valid, selectionWindowSeconds: 0 },
      { ...valid, selectionWindowSeconds: 1.5 },
      { ...valid, warningThresholdSeconds: [45] },
      { ...valid, warningThresholdSeconds: [10, 10] },
      { ...valid, upcomingTurnThresholds: [0] },
      { ...valid, autoAssignOnTimeout: false as unknown as true },
    ]) {
      await expect(
        useCase.execute({ roomId: "room", config, actorUserId: "op" }),
      ).rejects.toBeInstanceOf(ValidationError);
    }
    expect(saved).toHaveLength(0);
  });

  it("cannot change once the selection started", async () => {
    const { fx, useCase } = setup();
    (fx.room as { status: string }).status = "POSITION_SELECTION";
    await expect(
      useCase.execute({ roomId: "room", config: valid, actorUserId: "op" }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
