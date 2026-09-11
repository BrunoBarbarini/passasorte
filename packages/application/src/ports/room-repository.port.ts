import type { GameConfigSnapshot, GameRoom, RoomStatus } from "@passasorte/domain";

export interface CreateRoomInput {
  campaignId: string;
  capacity: number;
  gameConfig: GameConfigSnapshot;
}

export interface RoomRepository {
  findById(id: string): Promise<GameRoom | null>;
  create(input: CreateRoomInput): Promise<GameRoom>;
  transition(id: string, status: RoomStatus, at: Date): Promise<GameRoom>;
}
