import {
  assertValidGameConfigSnapshot,
  assertValidHoldPolicy,
  assertValidParticipationPackages,
  assertValidRoomCapacity,
  assertValidRoomOperationsConfig,
  hasActiveRoomCapacity,
  isMerchantAllowedInPilot,
  PILOT_ACTIVE_ROOM_STATUSES,
  PILOT_DISABLED_POLICY,
  type GameConfigSnapshot,
  type GameRoom,
  type ParticipationPackage,
  type PilotPolicy,
  type RoomOperationsConfig,
} from "@passasorte/domain";
import type { CampaignRepository } from "../../ports/campaign-repository.port.js";
import type { RoomRepository } from "../../ports/room-repository.port.js";
import { ConflictError, NotFoundError } from "../../errors.js";

export interface CreateRoomCommand {
  campaignId: string;
  capacity: number;
  gameConfig: GameConfigSnapshot;
  holdTtlMs: number;
  participationPackages: readonly ParticipationPackage[];
  operationsConfig: RoomOperationsConfig;
}

/**
 * TASK-024 Room Domain, operational side: opens a new room under a
 * campaign. Every business-sensitive value here (capacity, hold TTL,
 * game config, packages, operations pacing) is validated structurally
 * but never defaulted — the caller (an operator via the backoffice) must
 * supply all of it, per CLAUDE.md #58.
 *
 * `campaignRepository` and `pilotPolicy` are optional and default to a
 * no-op (undefined repository is never dereferenced when the policy is
 * disabled, see `PILOT_DISABLED_POLICY`) so every existing call site and
 * test that only ever passed a `RoomRepository` keeps compiling and
 * behaving identically. When Phase 9's pilot mode is enabled, this use
 * case additionally checks that the campaign's merchant is on the pilot
 * allow-list and that opening this room would not exceed the pilot's
 * platform-wide active-room cap (see @passasorte/domain's pilot-policy).
 */
export class CreateRoomUseCase {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly campaignRepository?: CampaignRepository,
    private readonly pilotPolicy: PilotPolicy = PILOT_DISABLED_POLICY,
  ) {}

  async execute(command: CreateRoomCommand): Promise<GameRoom> {
    assertValidRoomCapacity(command.capacity);
    assertValidGameConfigSnapshot(command.gameConfig);
    assertValidHoldPolicy({ ttlMs: command.holdTtlMs });
    assertValidParticipationPackages(command.participationPackages);
    assertValidRoomOperationsConfig(command.operationsConfig);

    if (this.pilotPolicy.enabled) {
      await this.assertPilotAllowsThisRoom(command.campaignId);
    }

    return this.roomRepository.create({
      campaignId: command.campaignId,
      capacity: command.capacity,
      gameConfig: command.gameConfig,
      holdTtlMs: command.holdTtlMs,
      participationPackages: command.participationPackages,
      operationsConfig: command.operationsConfig,
    });
  }

  private async assertPilotAllowsThisRoom(campaignId: string): Promise<void> {
    if (!this.campaignRepository) {
      // Defensive: real wiring always provides a CampaignRepository
      // whenever pilot mode is turned on (see apps/api's PILOT_POLICY
      // provider) — this only guards against a misconfigured caller.
      throw new ConflictError(
        "O modo piloto está habilitado, mas nenhum CampaignRepository foi fornecido para validar o merchant.",
      );
    }

    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundError("Campaign", campaignId);
    }

    if (!isMerchantAllowedInPilot(this.pilotPolicy, campaign.merchantId)) {
      throw new ConflictError(
        `Merchant "${campaign.merchantId}" não está habilitado para o piloto (Fase 9).`,
      );
    }

    const activeRoomLists = await Promise.all(
      PILOT_ACTIVE_ROOM_STATUSES.map((status) => this.roomRepository.listByStatus(status)),
    );
    const activeRoomCount = activeRoomLists.reduce((sum, list) => sum + list.length, 0);

    if (!hasActiveRoomCapacity(this.pilotPolicy, activeRoomCount)) {
      throw new ConflictError(
        `Limite de salas ativas do piloto (${String(this.pilotPolicy.maxActiveRooms)}) foi atingido.`,
      );
    }
  }
}
