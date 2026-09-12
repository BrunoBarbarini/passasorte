import type {
  GameConfigSnapshot,
  GameRoom,
  ParticipationPackage,
  RoomOperationsConfig,
  RoomStatus,
} from "@passasorte/domain";

export interface CreateRoomInput {
  campaignId: string;
  capacity: number;
  gameConfig: GameConfigSnapshot;
  holdTtlMs: number;
  participationPackages: readonly ParticipationPackage[];
  operationsConfig: RoomOperationsConfig;
}

export interface RoomRepository {
  findById(id: string): Promise<GameRoom | null>;
  create(input: CreateRoomInput): Promise<GameRoom>;
  transition(id: string, status: RoomStatus, at: Date): Promise<GameRoom>;
  listByCampaignId(campaignId: string): Promise<readonly GameRoom[]>;
  /** TASK-034 Scheduler: rooms currently in a given status, across every campaign. */
  listByStatus(status: RoomStatus): Promise<readonly GameRoom[]>;
}
