import { describe, expect, it } from "vitest";
import { SIMULATION_ONLY_INSIDE_ZONE_V1 } from "../winner-selection.js";

const ZONE = { start: 10, end: 12 };

describe("SIMULATION_ONLY_INSIDE_ZONE_V1 (BR-033, simulation-only)", () => {
  it("returns zero winners when nobody landed inside the zone (ADR-019 cardinality)", () => {
    const winners = SIMULATION_ONLY_INSIDE_ZONE_V1.selectWinners({
      finalStates: [{ participationId: "p1", finalPositions: [0, 5] }],
      sorteZone: ZONE,
    });
    expect(winners).toEqual([]);
  });

  it("returns exactly one winner when one position lands inside the zone", () => {
    const winners = SIMULATION_ONLY_INSIDE_ZONE_V1.selectWinners({
      finalStates: [
        { participationId: "p1", finalPositions: [0] },
        { participationId: "p2", finalPositions: [11] },
      ],
      sorteZone: ZONE,
    });
    expect(winners).toEqual([{ participationId: "p2", winningPosition: 11 }]);
  });

  it("returns multiple winners when several positions land inside the zone", () => {
    const winners = SIMULATION_ONLY_INSIDE_ZONE_V1.selectWinners({
      finalStates: [
        { participationId: "p1", finalPositions: [10] },
        { participationId: "p2", finalPositions: [12] },
      ],
      sorteZone: ZONE,
    });
    expect(winners).toHaveLength(2);
  });

  it("can report multiple winning positions for the same participant", () => {
    const winners = SIMULATION_ONLY_INSIDE_ZONE_V1.selectWinners({
      finalStates: [{ participationId: "p1", finalPositions: [10, 11] }],
      sorteZone: ZONE,
    });
    expect(winners).toHaveLength(2);
    expect(winners.every((w) => w.participationId === "p1")).toBe(true);
  });
});
