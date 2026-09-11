import type { GameConfigSnapshot, GameRoom, ParticipationPackage, RoomStatus } from "@passasorte/domain";

export interface CreateRoomInput {
  campaignId: string;
  capacity: number;
  gameConfig: GameConfigSnapshot;
  holdTtlMs: number;
  participationPackages: readonly ParticipationPackage[];
}

export interface RoomRepository {
  findById(id: string): Promise<GameRoom | null>;
  create(input: CreateRoomInput): Promise<GameRoom>;
  transition(id: string, status: RoomStatus, at: Date): Promise<GameRoom>;
  listByCampaignId(campaignId: string): Promise<readonly GameRoom[]>;
}
