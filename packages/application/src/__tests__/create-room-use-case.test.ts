/* eslint-disable @typescript-eslint/require-await -- in-memory test fakes intentionally implement async interfaces synchronously */
import { describe, expect, it } from "vitest";
import type { GameConfigSnapshot, GameRoom, PilotPolicy, RoomStatus } from "@passasorte/domain";
import { CreateRoomUseCase } from "../use-cases/room/create-room.use-case.js";
import type { CreateRoomInput, RoomRepository } from "../ports/room-repository.port.js";
import type { CampaignRepository } from "../ports/campaign-repository.port.js";
import { ConflictError, NotFoundError } from "../errors.js";

const GAME_CONFIG: GameConfigSnapshot = {
  engineVersion: "SIMULATION_V1",
  board: { size: 10 },
  initialSorteZone: { start: 4, end: 5 },
  temperatureBands: [{ name: "UNICA", maxNormalizedDistance: 1 }],
  movementAllowancePerParticipation: 3,
  finalLock: { finalPhaseStartSequence: 5 },
};

const PACKAGES = [{ id: "pkg-1", positionCount: 1, movementAllowance: 3, eligibilityRules: [] }];

const OPERATIONS_CONFIG = { finalLockGracePeriodMs: 30_000 };

class InMemoryRoomRepository implements RoomRepository {
  public created: CreateRoomInput | undefined;
  public roomsByStatus: Partial<Record<RoomStatus, GameRoom[]>> = {};

  async findById(): Promise<GameRoom | null> {
    return null;
  }

  async create(input: CreateRoomInput): Promise<GameRoom> {
    this.created = input;
    return {
      id: "room-1",
      campaignId: input.campaignId,
      capacity: input.capacity,
      gameConfig: input.gameConfig,
      holdTtlMs: input.holdTtlMs,
      participationPackages: input.participationPackages,
      operationsConfig: input.operationsConfig,
      status: "DRAFT",
      createdAt: new Date(),
      finalLockedAt: null,
      cancelledAt: null,
      cancellationReason: null,
    };
  }

  async transition(): Promise<GameRoom> {
    throw new Error("not needed in this test");
  }

  async listByCampaignId(): Promise<readonly GameRoom[]> {
    return [];
  }

  async listByStatus(status: RoomStatus): Promise<readonly GameRoom[]> {
    return this.roomsByStatus[status] ?? [];
  }
}

function fakeRoom(status: RoomStatus): GameRoom {
  return {
    id: `room-${status}`,
    campaignId: "campaign-1",
    capacity: 10,
    gameConfig: GAME_CONFIG,
    holdTtlMs: 60_000,
    participationPackages: PACKAGES,
    operationsConfig: OPERATIONS_CONFIG,
    status,
    createdAt: new Date(),
    finalLockedAt: null,
    cancelledAt: null,
    cancellationReason: null,
  };
}

class StubCampaignRepository implements Partial<CampaignRepository> {
  constructor(private readonly merchantIdByCampaignId: Record<string, string>) {}

  async findById(id: string) {
    const merchantId = this.merchantIdByCampaignId[id];
    if (!merchantId) return null;
    return {
      id,
      merchantId,
      experienceId: "experience-1",
      title: "Campanha",
      status: "SCHEDULED" as const,
      timezone: "America/Sao_Paulo",
      experienceSnapshot: null,
      scheduledStartAt: null,
      scheduledEndAt: null,
      publishedAt: null,
      endedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

describe("CreateRoomUseCase (TASK-024)", () => {
  it("creates a room when every value is valid", async () => {
    const repository = new InMemoryRoomRepository();
    const useCase = new CreateRoomUseCase(repository);
    const room = await useCase.execute({
      campaignId: "campaign-1",
      capacity: 10,
      gameConfig: GAME_CONFIG,
      holdTtlMs: 60_000,
      participationPackages: PACKAGES,
      operationsConfig: OPERATIONS_CONFIG,
    });
    expect(room.capacity).toBe(10);
    expect(repository.created?.holdTtlMs).toBe(60_000);
  });

  it("rejects a non-positive capacity (BR-004) without ever reaching the repository", async () => {
    const repository = new InMemoryRoomRepository();
    const useCase = new CreateRoomUseCase(repository);
    await expect(
      useCase.execute({
        campaignId: "campaign-1",
        capacity: 0,
        gameConfig: GAME_CONFIG,
        holdTtlMs: 60_000,
        participationPackages: PACKAGES,
        operationsConfig: OPERATIONS_CONFIG,
      }),
    ).rejects.toThrow();
    expect(repository.created).toBeUndefined();
  });

  it("rejects an empty participation package list", async () => {
    const repository = new InMemoryRoomRepository();
    const useCase = new CreateRoomUseCase(repository);
    await expect(
      useCase.execute({
        campaignId: "campaign-1",
        capacity: 10,
        gameConfig: GAME_CONFIG,
        holdTtlMs: 60_000,
        participationPackages: [],
        operationsConfig: OPERATIONS_CONFIG,
      }),
    ).rejects.toThrow();
  });

  describe("Phase 9 pilot policy gate", () => {
    it("never restricts creation when the pilot policy is left at its default (disabled)", async () => {
      const repository = new InMemoryRoomRepository();
      const useCase = new CreateRoomUseCase(repository);
      const room = await useCase.execute({
        campaignId: "campaign-1",
        capacity: 10,
        gameConfig: GAME_CONFIG,
        holdTtlMs: 60_000,
        participationPackages: PACKAGES,
        operationsConfig: OPERATIONS_CONFIG,
      });
      expect(room.status).toBe("DRAFT");
    });

    it("blocks room creation for a campaign whose merchant is not on the pilot allow-list", async () => {
      const repository = new InMemoryRoomRepository();
      const campaignRepository = new StubCampaignRepository({
        "campaign-1": "merchant-not-allowed",
      }) as unknown as CampaignRepository;
      const pilotPolicy: PilotPolicy = {
        enabled: true,
        allowedMerchantIds: ["merchant-allowed"],
        maxActiveRooms: null,
      };
      const useCase = new CreateRoomUseCase(repository, campaignRepository, pilotPolicy);

      await expect(
        useCase.execute({
          campaignId: "campaign-1",
          capacity: 10,
          gameConfig: GAME_CONFIG,
          holdTtlMs: 60_000,
          participationPackages: PACKAGES,
          operationsConfig: OPERATIONS_CONFIG,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(repository.created).toBeUndefined();
    });

    it("allows room creation for a campaign whose merchant is on the pilot allow-list", async () => {
      const repository = new InMemoryRoomRepository();
      const campaignRepository = new StubCampaignRepository({
        "campaign-1": "merchant-allowed",
      }) as unknown as CampaignRepository;
      const pilotPolicy: PilotPolicy = {
        enabled: true,
        allowedMerchantIds: ["merchant-allowed"],
        maxActiveRooms: null,
      };
      const useCase = new CreateRoomUseCase(repository, campaignRepository, pilotPolicy);

      const room = await useCase.execute({
        campaignId: "campaign-1",
        capacity: 10,
        gameConfig: GAME_CONFIG,
        holdTtlMs: 60_000,
        participationPackages: PACKAGES,
        operationsConfig: OPERATIONS_CONFIG,
      });
      expect(room.status).toBe("DRAFT");
    });

    it("blocks room creation once the pilot's active-room cap is reached", async () => {
      const repository = new InMemoryRoomRepository();
      repository.roomsByStatus.OPEN = [fakeRoom("OPEN"), fakeRoom("OPEN")];
      const campaignRepository = new StubCampaignRepository({
        "campaign-1": "merchant-allowed",
      }) as unknown as CampaignRepository;
      const pilotPolicy: PilotPolicy = {
        enabled: true,
        allowedMerchantIds: ["merchant-allowed"],
        maxActiveRooms: 2,
      };
      const useCase = new CreateRoomUseCase(repository, campaignRepository, pilotPolicy);

      await expect(
        useCase.execute({
          campaignId: "campaign-1",
          capacity: 10,
          gameConfig: GAME_CONFIG,
          holdTtlMs: 60_000,
          participationPackages: PACKAGES,
          operationsConfig: OPERATIONS_CONFIG,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("raises NotFoundError when the campaign referenced by campaignId does not exist", async () => {
      const repository = new InMemoryRoomRepository();
      const campaignRepository = new StubCampaignRepository({}) as unknown as CampaignRepository;
      const pilotPolicy: PilotPolicy = {
        enabled: true,
        allowedMerchantIds: ["merchant-allowed"],
        maxActiveRooms: null,
      };
      const useCase = new CreateRoomUseCase(repository, campaignRepository, pilotPolicy);

      await expect(
        useCase.execute({
          campaignId: "campaign-does-not-exist",
          capacity: 10,
          gameConfig: GAME_CONFIG,
          holdTtlMs: 60_000,
          participationPackages: PACKAGES,
          operationsConfig: OPERATIONS_CONFIG,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
