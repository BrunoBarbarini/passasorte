import type {
  GameConfigSnapshot,
  GameRoom,
  ParticipationPackage,
  RoomOperationsConfig,
  RoomStatus,
  PositionSelectionRoomConfig,
} from "@passasorte/domain";

export interface CreateRoomInput {
  campaignId: string;
  capacity: number;
  gameConfig: GameConfigSnapshot;
  holdTtlMs: number;
  participationPackages: readonly ParticipationPackage[];
  operationsConfig: RoomOperationsConfig;
  /** DECISION-23: optional at creation; must exist before the selection starts. */
  positionSelectionConfig?: PositionSelectionRoomConfig;
}

export interface RoomRepository {
  findById(id: string): Promise<GameRoom | null>;
  create(input: CreateRoomInput): Promise<GameRoom>;
  transition(id: string, status: RoomStatus, at: Date): Promise<GameRoom>;
  listByCampaignId(campaignId: string): Promise<readonly GameRoom[]>;
  /** TASK-034 Scheduler: rooms currently in a given status, across every campaign. */
  listByStatus(status: RoomStatus): Promise<readonly GameRoom[]>;
}

/** DECISION-23/36: stores the per-room position-selection settings (API side only). */
export interface RoomSelectionConfigRepository {
  save(roomId: string, config: PositionSelectionRoomConfig): Promise<GameRoom>;
}
