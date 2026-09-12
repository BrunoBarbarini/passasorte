import type {
  FinalMovementPlan,
  MovementAllocation,
  MovementCommand,
  Participation,
  ParticipationStatus,
  Position,
} from "@passasorte/domain";

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
  /** TASK-031 Game Result Engine: every participation in a room, regardless of owner — needed to assemble GameEngineRunInput.initialPositions at resolution time. */
  listByRoomId(roomId: string): Promise<readonly Participation[]>;
  /**
   * TASK-030 Final Movement Plan / BR-026: appends one accepted movement
   * command to the room's replayable command log (FR-044) — separate
   * from `updateMovementAllocation`, which only tracks the spend counter.
   */
  appendMovementCommand(roomId: string, command: MovementCommand): Promise<void>;
  /** Every accepted movement command for a room, ordered by sequence ascending — grouped into GameEngine "rounds" by the caller. */
  listMovementCommandsForRoom(roomId: string): Promise<readonly MovementCommand[]>;
  /**
   * BR-028: locks a participation's final movement plan and moves it to
   * LOCKED in one write. Implementations must reject (throw) if a plan
   * is already locked for this participation — see
   * FinalMovementPlanAlreadyLockedError in @passasorte/domain — rather
   * than silently overwriting it.
   */
  lockFinalMovementPlan(participationId: string, plan: FinalMovementPlan): Promise<Participation>;
  /** The locked final plan for a participation, or null if none was locked yet. */
  findFinalMovementPlan(participationId: string): Promise<FinalMovementPlan | null>;
}
