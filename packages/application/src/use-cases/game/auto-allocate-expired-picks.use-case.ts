import { gameV2 } from "@passasorte/domain";
import type { RoomRepository } from "../../ports/room-repository.port.js";
import type { PositionSelectionPort } from "../../ports/position-selection.port.js";
import { NotFoundError } from "../../errors.js";
import {
  buildSelectionState,
  currentPickDeadline,
  toValidationError,
} from "./position-selection.shared.js";

/**
 * Absent picker (BR-053): when a turn expires the server allocates free positions at random
 * from the sealed seed (uniform among the free ones: ASSUMPTION, T-14). Never runs while the
 * turn is still open (DECISION-07). Safe to call repeatedly and from several workers: the
 * database transaction rejects a stale decision with a ConflictError.
 */
export class AutoAllocateExpiredPicksUseCase {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly selection: PositionSelectionPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Returns how many participations were allocated by the server in this call. */
  async execute(input: { readonly roomId: string }): Promise<number> {
    const room = await this.rooms.findById(input.roomId);
    if (!room) throw new NotFoundError("GameRoom", input.roomId);
    if (room.status !== "POSITION_SELECTION") return 0;

    let allocated = 0;
    // At most one iteration per participant; each new turn starts now, so it is not expired.
    for (;;) {
      const snapshot = await this.selection.loadSnapshot(room.id);
      const now = this.clock();
      if (now < currentPickDeadline(room, snapshot)) return allocated;
      const seed = await this.selection.loadSealedSeed(room.id);
      if (!seed) throw new NotFoundError("Seed", room.id);

      try {
        const state = buildSelectionState(room, snapshot);
        const picker = gameV2.currentPicker(state);
        if (!picker) return allocated;
        const next = gameV2.autoAllocatePositions(state, picker.participantId, seed.seedHex);
        const pick = next.picks[next.picks.length - 1];
        if (!pick) return allocated;
        const result = await this.selection.commitPick({
          roomId: room.id,
          participationId: pick.participantId,
          positions: pick.positions,
          kind: "AUTOMATIC",
          pickedAt: now,
          expectedPickCount: snapshot.assignments.length,
          events: [
            {
              aggregateType: "Participation",
              aggregateId: pick.participantId,
              eventType: "positions.auto_allocated",
              payload: { roomId: room.id, participationId: pick.participantId },
            },
          ],
        });
        allocated += 1;
        if (result.completed) return allocated;
      } catch (error) {
        throw toValidationError(error);
      }
    }
  }
}
