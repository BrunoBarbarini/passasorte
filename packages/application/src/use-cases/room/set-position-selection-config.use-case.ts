import type { GameRoom, PositionSelectionRoomConfig } from "@passasorte/domain";
import type { AuditLogPort } from "../../ports/audit-log.port.js";
import type {
  RoomRepository,
  RoomSelectionConfigRepository,
} from "../../ports/room-repository.port.js";
import { DomainError, NotFoundError } from "../../errors.js";
import { validatePositionSelectionConfig } from "./validate-position-selection-config.js";

export interface SetPositionSelectionConfigCommand {
  readonly roomId: string;
  readonly config: PositionSelectionRoomConfig;
  readonly actorUserId: string;
}

/**
 * DECISION-23/36: the time each participant has to choose positions is set per room by the
 * operator (no default). It can change until the selection starts; from then on it is frozen in
 * `positionSelection` (BR-024 spirit: an active room's rules do not move). Audited (CLAUDE.md 34).
 */
export class SetPositionSelectionConfigUseCase {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly store: RoomSelectionConfigRepository,
    private readonly auditLog: AuditLogPort,
  ) {}

  async execute(command: SetPositionSelectionConfigCommand): Promise<GameRoom> {
    validatePositionSelectionConfig(command.config);
    const room = await this.rooms.findById(command.roomId);
    if (!room) throw new NotFoundError("GameRoom", command.roomId);
    if (room.status !== "DRAFT" && room.status !== "OPEN" && room.status !== "ENTRY_LOCKED") {
      throw new DomainError(
        "O tempo de escolha das posições só pode mudar antes de a escolha começar.",
      );
    }
    const saved = await this.store.save(room.id, command.config);
    await this.auditLog.record({
      actorUserId: command.actorUserId,
      action: "room.position_selection_config_set",
      entityType: "GameRoom",
      entityId: room.id,
      metadata: {
        selectionWindowSeconds: command.config.selectionWindowSeconds,
        warningThresholdSeconds: command.config.warningThresholdSeconds ?? [],
        upcomingTurnThresholds: command.config.upcomingTurnThresholds ?? [],
      },
    });
    return saved;
  }
}
