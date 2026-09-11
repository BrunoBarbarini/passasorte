import type { MovementAllocation, Participation, ParticipationStatus, Position } from "@passasorte/domain";

export interface CreateParticipationInput {
  roomId: string;
  userId: string;
  packageId: string;
  positions: readonly Position[];
  /** BR-020: the movement budget granted by the package, persisted with the participation. */
  movementAllowance: number;
}

export interface ParticipationRepository {
  findById(id: string): Promise<Participation | null>;
  create(input: CreateParticipationInput): Promise<Participation>;
  transition(id: string, status: ParticipationStatus): Promise<Participation>;
  countActiveByUserAndRoom(userId: string, roomId: string): Promise<number>;
  updateMovementAllocation(id: string, allocation: MovementAllocation): Promise<Participation>;
  listByUserAndRoom(userId: string, roomId: string): Promise<readonly Participation[]>;
}
