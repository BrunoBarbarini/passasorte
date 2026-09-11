import { describe, expect, it } from "vitest";
import {
  assertCampaignTransition,
  canTransitionCampaignStatus,
  InvalidCampaignTransitionError,
  isTerminalCampaignStatus,
  type CampaignStatus,
} from "../campaign-state-machine.js";

const HAPPY_PATH: CampaignStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "ENDED",
];

describe("campaign state machine", () => {
  it("allows the full happy path in order", () => {
    for (let i = 0; i < HAPPY_PATH.length - 1; i++) {
      expect(canTransitionCampaignStatus(HAPPY_PATH[i]!, HAPPY_PATH[i + 1]!)).toBe(true);
    }
  });

  it("allows cancellation from every non-terminal status", () => {
    const nonTerminal: CampaignStatus[] = ["DRAFT", "IN_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED"];
    for (const status of nonTerminal) {
      expect(canTransitionCampaignStatus(status, "CANCELLED")).toBe(true);
    }
  });

  it("rejects skipping states (e.g. DRAFT straight to PUBLISHED)", () => {
    expect(canTransitionCampaignStatus("DRAFT", "PUBLISHED")).toBe(false);
  });

  it("rejects any transition out of a terminal status", () => {
    expect(canTransitionCampaignStatus("ENDED", "PUBLISHED")).toBe(false);
    expect(canTransitionCampaignStatus("CANCELLED", "DRAFT")).toBe(false);
  });

  it("rejects moving backwards", () => {
    expect(canTransitionCampaignStatus("APPROVED", "IN_REVIEW")).toBe(false);
  });

  it("throws InvalidCampaignTransitionError with a pt-BR message on an illegal move", () => {
    expect(() => assertCampaignTransition("DRAFT", "PUBLISHED")).toThrow(
      InvalidCampaignTransitionError,
    );
    try {
      assertCampaignTransition("DRAFT", "PUBLISHED");
    } catch (error) {
      expect((error as Error).message).toContain("DRAFT");
      expect((error as Error).message).toContain("PUBLISHED");
    }
  });

  it("identifies ENDED and CANCELLED as terminal", () => {
    expect(isTerminalCampaignStatus("ENDED")).toBe(true);
    expect(isTerminalCampaignStatus("CANCELLED")).toBe(true);
    expect(isTerminalCampaignStatus("PUBLISHED")).toBe(false);
  });
});
