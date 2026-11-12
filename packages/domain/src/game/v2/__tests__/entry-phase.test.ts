import { describe, expect, it } from "vitest";
import {
  autoAllocatePositions,
  computeBoardSize,
  createPositionSelection,
  currentPicker,
  freePositions,
  isSelectionComplete,
  pickPositions,
  toParticipantSeats,
} from "../index.js";
import type { EntryDeclaration } from "../index.js";
import { COMMITMENT, engine, expectCode, lcg } from "./helpers.js";

const SEED = "b".repeat(64);

function entry(
  participantId: string,
  entrySequence: number,
  positionCredits: number,
  movementCredits = 2,
): EntryDeclaration {
  return { participantId, entrySequence, positionCredits, movementCredits, autoAction: "NONE" };
}

// Owner's example (DECISION-09): 5 + 3 + 2 + 6 = 16.
const EXAMPLE = [entry("A", 1, 5), entry("B", 2, 3), entry("C", 3, 2), entry("D", 4, 6)];

describe("entry phase and position selection (DECISION-07..11)", () => {
  it("DECISION-09/10: board size is the sum of every acquired position", () => {
    expect(computeBoardSize(EXAMPLE)).toBe(16);
    expect(createPositionSelection(EXAMPLE).size).toBe(16);
  });

  it("DECISION-08: entrySequence must be unique and gapless (transactional assignment)", () => {
    expectCode(() => computeBoardSize([entry("A", 1, 1), entry("B", 1, 1)]), "INVALID_ENTRIES");
    expectCode(() => computeBoardSize([entry("A", 1, 1), entry("B", 3, 1)]), "INVALID_ENTRIES");
    expectCode(() => computeBoardSize([entry("A", 1, 1), entry("A", 2, 1)]), "INVALID_ENTRIES");
    expectCode(() => computeBoardSize([]), "INVALID_ENTRIES");
  });

  it("DECISION-08: whoever entered first picks first; nobody picks out of order", () => {
    const state = createPositionSelection([EXAMPLE[3]!, EXAMPLE[1]!, EXAMPLE[0]!, EXAMPLE[2]!]);
    expect(currentPicker(state)?.participantId).toBe("A");
    expectCode(() => pickPositions(state, "B", [1, 2, 3]), "NOT_YOUR_PICK_TURN");
    const next = pickPositions(state, "A", [1, 2, 3, 4, 5]);
    expect(currentPicker(next)?.participantId).toBe("B");
  });

  it("DECISION-07: the participant chooses exact positions, concentrated or scattered", () => {
    const state = createPositionSelection(EXAMPLE);
    const scattered = pickPositions(state, "A", [7, 16, 2, 9, 11]);
    expect(scattered.picks[0]?.positions).toEqual([7, 16, 2, 9, 11]);
    const next = pickPositions(scattered, "B", [3, 4, 5]);
    expect(next.picks).toHaveLength(2);
  });

  it("requires exactly the purchased number of positions, all valid and distinct", () => {
    const state = createPositionSelection(EXAMPLE);
    expectCode(() => pickPositions(state, "A", [1, 2, 3, 4]), "WRONG_POSITION_COUNT");
    expectCode(() => pickPositions(state, "A", [1, 2, 3, 4, 5, 6]), "WRONG_POSITION_COUNT");
    expectCode(() => pickPositions(state, "A", [1, 2, 3, 4, 17]), "INVALID_POSITION");
    expectCode(() => pickPositions(state, "A", [0, 2, 3, 4, 5]), "INVALID_POSITION");
    expectCode(() => pickPositions(state, "A", [1, 1, 2, 3, 4]), "INVALID_POSITION");
  });

  it("rejects an already taken position (exclusive ownership)", () => {
    let state = createPositionSelection(EXAMPLE);
    state = pickPositions(state, "A", [1, 2, 3, 4, 5]);
    expectCode(() => pickPositions(state, "B", [5, 6, 7]), "POSITION_UNAVAILABLE");
    expect(freePositions(state)).toHaveLength(11);
  });

  it("DECISION-11: the last participant only gets what is left; the bar never grows", () => {
    let state = createPositionSelection(EXAMPLE);
    state = pickPositions(state, "A", [1, 3, 5, 7, 9]);
    state = pickPositions(state, "B", [2, 4, 6]);
    state = pickPositions(state, "C", [8, 10]);
    expect(freePositions(state)).toEqual([11, 12, 13, 14, 15, 16]);
    expectCode(() => pickPositions(state, "D", [11, 12, 13, 14, 15, 17]), "INVALID_POSITION");
    expectCode(() => pickPositions(state, "D", [1, 12, 13, 14, 15, 16]), "POSITION_UNAVAILABLE");
    state = pickPositions(state, "D", [11, 12, 13, 14, 15, 16]);
    expect(state.size).toBe(16);
    expect(freePositions(state)).toEqual([]);
  });

  it("DECISION-09: allocatedPositions == boardSize before the match can start", () => {
    let state = createPositionSelection(EXAMPLE);
    expect(isSelectionComplete(state)).toBe(false);
    expectCode(() => toParticipantSeats(state), "SELECTION_INCOMPLETE");
    state = pickPositions(state, "A", [1, 2, 3, 4, 5]);
    expectCode(() => toParticipantSeats(state), "SELECTION_INCOMPLETE");
    state = pickPositions(state, "B", [6, 7, 8]);
    state = pickPositions(state, "C", [9, 10]);
    state = pickPositions(state, "D", [11, 12, 13, 14, 15, 16]);
    expect(isSelectionComplete(state)).toBe(true);
    const seats = toParticipantSeats(state);
    const game = engine.initialize({
      config: { winningZoneSize: 1, maxMovementsPerRound: null },
      participants: seats,
      randomnessCommitmentHash: COMMITMENT,
      initialSortePosition: 1,
    });
    expect(game.size).toBe(16);
    expect(seats.find((seat) => seat.participantId === "D")?.movementBalance).toBe(2);
  });

  it("CR-012: an absent picker gets a deterministic, valid random allocation", () => {
    const state = createPositionSelection(EXAMPLE);
    const once = autoAllocatePositions(state, "A", SEED);
    const again = autoAllocatePositions(state, "A", SEED);
    expect(once).toEqual(again);
    const positions = once.picks[0]!.positions;
    expect(positions).toHaveLength(5);
    expect(new Set(positions).size).toBe(5);
    expect(positions.every((p) => p >= 1 && p <= 16)).toBe(true);
    expectCode(() => autoAllocatePositions(state, "B", SEED), "NOT_YOUR_PICK_TURN");
  });

  it("completes a whole selection with a mix of choices and auto allocation, never leaving gaps", () => {
    const rand = lcg(11);
    for (let game = 0; game < 100; game += 1) {
      const entries = Array.from({ length: 2 + Math.floor(rand() * 8) }, (_, i) =>
        entry(`P${i}`, i + 1, 1 + Math.floor(rand() * 6), Math.floor(rand() * 5)),
      );
      let state = createPositionSelection(entries);
      for (let picker = currentPicker(state); picker !== null; picker = currentPicker(state)) {
        if (rand() < 0.5) {
          const free = [...freePositions(state)];
          const chosen: number[] = [];
          for (let k = 0; k < picker.positionCredits; k += 1) {
            chosen.push(free.splice(Math.floor(rand() * free.length), 1)[0]!);
          }
          state = pickPositions(state, picker.participantId, chosen);
        } else {
          state = autoAllocatePositions(state, picker.participantId, SEED + game);
        }
      }
      expect(isSelectionComplete(state)).toBe(true);
      const seats = toParticipantSeats(state);
      expect(
        engine.initialize({
          config: { winningZoneSize: 1, maxMovementsPerRound: null },
          participants: seats,
          randomnessCommitmentHash: COMMITMENT,
          initialSortePosition: 1,
        }).size,
      ).toBe(state.size);
    }
  });

  it("skips participants who bought no positions when choosing in order", () => {
    const state = createPositionSelection([entry("A", 1, 0), entry("B", 2, 2)]);
    expect(currentPicker(state)?.participantId).toBe("B");
  });
});
