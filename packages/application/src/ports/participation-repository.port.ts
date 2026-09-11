import type { Participation, ParticipationStatus, Position } from "@passasorte/domain";

export interface CreateParticipationInput {
  roomId: string;
  userId: string;
  packageId: string;
  positions: readonly Position[];
}

export interface ParticipationRepository {
  findById(id: string): Promise<Participation | null>;
  create(input: CreateParticipationInput): Promise<Participation>;
  transition(id: string, status: ParticipationStatus): Promise<Participation>;
  countActiveByUserAndRoom(userId: string, roomId: string): Promise<number>;
}
