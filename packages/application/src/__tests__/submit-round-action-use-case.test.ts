/* eslint-disable @typescript-eslint/require-await -- in-memory test fakes intentionally implement async interfaces synchronously */
import { describe, expect, it } from "vitest";
import type { GameRoom, Participation, RoomStatus, gameV2 } from "@passasorte/domain";
import { SubmitRoundActionUseCase } from "../use-cases/participation/submit-round-action.use-case.js";
import type { ParticipationRepository } from "../ports/participation-repository.port.js";
import type { RoomRepository } from "../ports/room-repository.port.js";
import type { OutboxPort, PublishOutboxEventInput } from "../ports/outbox.port.js";
import type {
  AppendRoundActionSubmissionInput,
  AppendRoundActionSubmissionResult,
  OpenRound,
  RoundActionRepository,
  RoundActionSubmissionRecord,
} from "../ports/round-action-repository.port.js";
import { DomainError, NotFoundError, ValidationError } from "../errors.js";

const T0 = new Date("2026-11-13T13:00:00.000Z");
const OPENS = new Date("2026-11-13T13:00:00.000Z");
const CLOSES = new Date("2026-11-13T13:01:00.000Z");

function participation(overrides: Partial<Participation> = {}): Participation {
  return {
    id: "p1",
    roomId: "room1",
    userId: "u1",
    packageId: "pkg",
    positions: [],
    status: "ACTIVE",
    movementAllowanceTotal: 10,
    movementAllowanceUsed: 2,
    createdAt: T0,
    ...overrides,
  };
}

class Fixture {
  participations = new Map<string, Participation>([["p1", participation()]]);
  roomStatus: RoomStatus = "RUNNING";
  roomExists = true;
  config: gameV2.GameConfigV2 | null = { winningZoneSize: 1, maxMovementsPerRound: 3 };
  round: OpenRound | null = {
    id: "round1",
    roomId: "room1",
    roundNo: 4,
    windowOpensAt: OPENS,
    windowClosesAt: CLOSES,
  };
  stored: RoundActionSubmissionRecord[] = [];
  events: PublishOutboxEventInput[] = [];
  now = new Date("2026-11-13T13:00:30.000Z");

  private readonly participationRepo = {
    findById: async (id: string) => this.participations.get(id) ?? null,
  } as unknown as ParticipationRepository;

  private readonly roomRepo = {
    findById: async (id: string) =>
      this.roomExists ? ({ id, status: this.roomStatus } as unknown as GameRoom) : null,
  } as unknown as RoomRepository;

  private readonly roundRepo: RoundActionRepository = {
    findOpenRound: async (_roomId: string, at: Date) =>
      this.round && at >= this.round.windowOpensAt && at < this.round.windowClosesAt
        ? this.round
        : null,
    findEngineConfig: async () => this.config,
    appendSubmission: async (
      input: AppendRoundActionSubmissionInput,
    ): Promise<AppendRoundActionSubmissionResult> => {
      const replay = this.stored.find(
        (s) =>
          s.participationId === input.participationId &&
          s.roundId === input.roundId &&
          s.idempotencyKey === input.idempotencyKey,
      );
      if (replay) return { submission: replay, idempotentReplay: true };
      const sequence =
        this.stored.filter(
          (s) => s.participationId === input.participationId && s.roundId === input.roundId,
        ).length + 1;
      const submission: RoundActionSubmissionRecord = {
        id: `s${this.stored.length + 1}`,
        roundId: input.roundId,
        participationId: input.participationId,
        submissionSequence: sequence,
        kind: input.kind,
        credits: input.credits,
        submittedAt: input.submittedAt,
        idempotencyKey: input.idempotencyKey,
      };
      this.stored.push(submission);
      return { submission, idempotentReplay: false };
    },
  };

  private readonly outbox: OutboxPort = {
    publish: async (event: PublishOutboxEventInput) => {
      this.events.push(event);
    },
  };

  useCase(): SubmitRoundActionUseCase {
    return new SubmitRoundActionUseCase(
      this.participationRepo,
      this.roomRepo,
      this.roundRepo,
      this.outbox,
      () => this.now,
    );
  }
}

const input = (overrides = {}) => ({
  participationId: "p1",
  kind: "RIGHT" as const,
  credits: 2,
  idempotencyKey: "k1",
  ...overrides,
});

describe("SubmitRoundActionUseCase (DECISION-16, T-33)", () => {
  it("stores the action as submission 1 and publishes movement.accepted", async () => {
    const f = new Fixture();
    const result = await f.useCase().execute(input());
    expect(result.submission.submissionSequence).toBe(1);
    expect(result.replaced).toBe(false);
    expect(result.idempotentReplay).toBe(false);
    expect(result.round.roundNo).toBe(4);
    expect(result.submission.submittedAt).toEqual(f.now);
    expect(f.events.map((e) => e.eventType)).toEqual(["movement.accepted"]);
  });

  it("replaces the previous action: the new one gets the next sequence (T-33, last wins)", async () => {
    const f = new Fixture();
    await f.useCase().execute(input({ idempotencyKey: "k1", credits: 2 }));
    const second = await f
      .useCase()
      .execute(input({ idempotencyKey: "k2", kind: "LEFT", credits: 1 }));
    expect(second.submission.submissionSequence).toBe(2);
    expect(second.replaced).toBe(true);
    expect(f.stored).toHaveLength(2);
  });

  it("is idempotent: the same key returns the stored submission and writes nothing new", async () => {
    const f = new Fixture();
    await f.useCase().execute(input());
    const again = await f.useCase().execute(input());
    expect(again.idempotentReplay).toBe(true);
    expect(f.stored).toHaveLength(1);
    expect(f.events).toHaveLength(1);
  });

  it("rejects before the window opens and from the instant it closes (server clock, BR-025)", async () => {
    const f = new Fixture();
    f.now = new Date(OPENS.getTime() - 1);
    await expect(f.useCase().execute(input())).rejects.toBeInstanceOf(DomainError);
    f.now = CLOSES;
    await expect(f.useCase().execute(input())).rejects.toBeInstanceOf(DomainError);
    f.now = OPENS;
    await expect(f.useCase().execute(input())).resolves.toBeDefined();
    expect(f.stored).toHaveLength(1);
  });

  it("enforces the per-round cap (BR-068/BR-089) and tells the participant the limit", async () => {
    const f = new Fixture();
    const error = await f
      .useCase()
      .execute(input({ credits: 4 }))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details).toEqual({ reason: "EXCEEDS_ROUND_CAP" });
    expect((error as ValidationError).message).toContain("3");
    expect(f.events.map((e) => e.eventType)).toEqual(["movement.rejected"]);
    expect(f.stored).toHaveLength(0);
  });

  it("rejects a room whose cap is null or undefined: the cap is mandatory per campaign (BR-089)", async () => {
    const f = new Fixture();
    for (const cap of [null, undefined]) {
      f.config = { winningZoneSize: 1, maxMovementsPerRound: cap as unknown as number };
      const error = await f
        .useCase()
        .execute(input())
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details).toEqual({ reason: "ROUND_CAP_REQUIRED" });
    }
    expect(f.stored).toHaveLength(0);
  });

  it("checks the remaining balance (total - used), not the cap alone", async () => {
    const f = new Fixture();
    f.config = { winningZoneSize: 1, maxMovementsPerRound: 20 };
    const error = await f
      .useCase()
      .execute(input({ credits: 9 }))
      .catch((e: unknown) => e);
    expect((error as ValidationError).details).toEqual({ reason: "INSUFFICIENT_MOVEMENTS" });
    await expect(
      f.useCase().execute(input({ credits: 8, idempotencyKey: "k8" })),
    ).resolves.toBeDefined();
  });

  it("STAY costs exactly 1 and credits must be >= 1", async () => {
    const f = new Fixture();
    await expect(f.useCase().execute(input({ kind: "STAY", credits: 2 }))).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(f.useCase().execute(input({ credits: 0 }))).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      f.useCase().execute(input({ kind: "STAY", credits: 1, idempotencyKey: "k9" })),
    ).resolves.toBeDefined();
  });

  it("rejects when the room has no frozen Engine V2 config", async () => {
    const f = new Fixture();
    f.config = null;
    await expect(f.useCase().execute(input())).rejects.toBeInstanceOf(DomainError);
  });

  it("rejects an inactive participation, a room that is not RUNNING, and unknown ids", async () => {
    const f = new Fixture();
    f.participations.set("p1", participation({ status: "LOCKED" }));
    await expect(f.useCase().execute(input())).rejects.toBeInstanceOf(DomainError);
    f.participations.set("p1", participation());
    f.roomStatus = "ENTRY_LOCKED";
    await expect(f.useCase().execute(input())).rejects.toBeInstanceOf(DomainError);
    f.roomStatus = "RUNNING";
    await expect(f.useCase().execute(input({ participationId: "nope" }))).rejects.toBeInstanceOf(
      NotFoundError,
    );
    f.roomExists = false;
    await expect(f.useCase().execute(input())).rejects.toBeInstanceOf(NotFoundError);
  });
});
