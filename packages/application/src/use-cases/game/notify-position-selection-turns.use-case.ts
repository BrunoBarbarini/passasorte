import type { RoomRepository } from "../../ports/room-repository.port.js";
import type { PositionSelectionPort } from "../../ports/position-selection.port.js";
import { NotFoundError } from "../../errors.js";
import { currentPickWindow } from "./position-selection.shared.js";

/**
 * DECISION-25 (warn before the window ends) and DECISION-35 (warn that the turn is approaching,
 * SHOULD HAVE). The marks are per-room UX settings frozen when the selection starts. Each notice
 * is recorded with a unique key together with its outbox event, so retries, a late worker or two
 * workers in parallel never send the same notice twice. When several marks were crossed between
 * two runs only the tightest one is notified; the wider ones are recorded without an event, to
 * avoid a burst of alerts (DECISION-25: no excess of alerts).
 */
export class NotifyPositionSelectionTurnsUseCase {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly selection: PositionSelectionPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Returns how many notice events were published in this call. */
  async execute(input: { readonly roomId: string }): Promise<number> {
    const room = await this.rooms.findById(input.roomId);
    if (!room) throw new NotFoundError("GameRoom", input.roomId);
    const config = room.positionSelection;
    if (room.status !== "POSITION_SELECTION" || !config) return 0;

    const snapshot = await this.selection.loadSnapshot(room.id);
    const picked = new Set(snapshot.assignments.map((assignment) => assignment.participationId));
    const pending = snapshot.entries
      .filter((entry) => !picked.has(entry.participationId))
      .sort((a, b) => (a.entrySequence ?? 0) - (b.entrySequence ?? 0));
    const current = pending[0];
    if (!current) return 0;

    let published = 0;
    const window = currentPickWindow(room, snapshot);
    const remainingMs = window.closesAt.getTime() - this.clock().getTime();

    if (remainingMs > 0) {
      const crossed = (config.warningThresholdSeconds ?? [])
        .filter((seconds) => seconds * 1000 >= remainingMs)
        .sort((a, b) => a - b);
      for (const [index, seconds] of crossed.entries()) {
        const created = await this.selection.recordTurnNotice({
          roomId: room.id,
          participationId: current.participationId,
          kind: "TURN_WARNING",
          threshold: seconds,
          event:
            index === 0
              ? {
                  aggregateType: "Participation",
                  aggregateId: current.participationId,
                  eventType: "position_selection.turn_warning",
                  payload: {
                    userId: current.userId,
                    roomId: room.id,
                    campaignId: room.campaignId,
                    participationId: current.participationId,
                    thresholdSeconds: seconds,
                    closesAt: window.closesAt.toISOString(),
                  },
                }
              : null,
        });
        if (created && index === 0) published += 1;
      }
    }

    const marks = [...(config.upcomingTurnThresholds ?? [])].sort((a, b) => a - b);
    const widest = marks[marks.length - 1] ?? 0;
    for (let ahead = 1; ahead <= Math.min(widest, pending.length - 1); ahead += 1) {
      const entry = pending[ahead];
      if (!entry) break;
      const crossed = marks.filter((mark) => ahead <= mark);
      for (const [index, mark] of crossed.entries()) {
        const created = await this.selection.recordTurnNotice({
          roomId: room.id,
          participationId: entry.participationId,
          kind: "TURN_APPROACHING",
          threshold: mark,
          event:
            index === 0
              ? {
                  aggregateType: "Participation",
                  aggregateId: entry.participationId,
                  eventType: "position_selection.turn_approaching",
                  payload: {
                    userId: entry.userId,
                    roomId: room.id,
                    campaignId: room.campaignId,
                    participationId: entry.participationId,
                    participantsAhead: ahead,
                  },
                }
              : null,
        });
        if (created && index === 0) published += 1;
      }
    }
    return published;
  }
}
