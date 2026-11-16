import { gameV2 } from "@passasorte/domain";
import type { RoomRepository } from "../../ports/room-repository.port.js";
import type { PositionSelectionPort } from "../../ports/position-selection.port.js";
import { NotFoundError } from "../../errors.js";
import {
  buildSelectionState,
  currentPickWindow,
  toValidationError,
  windowClosedPayload,
  windowOpenedEvents,
} from "./position-selection.shared.js";

/**
 * Absent picker (DECISION-27..30, BR-053): when a window expires the server allocates, at
 * random among the positions still free, exactly the positions the participant bought, from the
 * sealed seed. Never runs while the window is open, never creates positions or takes another
 * participant's (DECISION-28), never moves the participant in the queue (DECISION-33).
 * Idempotent and safe from several workers: the transaction locks the room and rejects a stale
 * decision with a ConflictError, so a manual confirmation and the timeout can never both win.
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
      const window = currentPickWindow(room, snapshot);
      if (now < window.closesAt) return allocated;
      const seed = await this.selection.loadSealedSeed(room.id);
      if (!seed) throw new NotFoundError("Seed", room.id);

      try {
        const state = buildSelectionState(room, snapshot);
        const picker = gameV2.currentPicker(state);
        if (!picker) return allocated;
        const entry = snapshot.entries.find(
          (candidate) => candidate.participationId === picker.participantId,
        );
        if (!entry) return allocated;
        const next = gameV2.autoAllocatePositions(state, picker.participantId, seed.seedHex);
        const pick = next.picks[next.picks.length - 1];
        if (!pick) return allocated;
        const result = await this.selection.commitPick({
          roomId: room.id,
          participationId: pick.participantId,
          positions: pick.positions,
          kind: "AUTOMATIC",
          pickedAt: now,
          window: {
            entrySequence: picker.entrySequence,
            openedAt: window.openedAt,
            closesAt: window.closesAt,
          },
          expectedPickCount: snapshot.assignments.length,
          events: [
            {
              aggregateType: "Participation",
              aggregateId: pick.participantId,
              eventType: "position_selection.timed_out",
              payload: {
                userId: entry.userId,
                roomId: room.id,
                campaignId: room.campaignId,
                participationId: pick.participantId,
                entrySequence: picker.entrySequence,
              },
            },
            {
              aggregateType: "Participation",
              aggregateId: pick.participantId,
              eventType: "positions.auto_allocated",
              payload: {
                ...windowClosedPayload({
                  room,
                  userId: entry.userId,
                  participationId: pick.participantId,
                  entrySequence: picker.entrySequence,
                  positions: pick.positions,
                  selectionType: "AUTOMATIC",
                  window,
                  completedAt: now,
                }),
                automaticSelectionReason: "TIMEOUT",
              },
            },
            ...windowOpenedEvents(room, snapshot, next, now),
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
