import { describe, expect, it } from "vitest";
import {
  assertBenefitTransition,
  canTransitionBenefitStatus,
  InvalidBenefitTransitionError,
} from "../benefit-state-machine.js";
import {
  assertValidBenefitAmount,
  deriveBenefitFromLedger,
  InvalidBenefitAmountError,
  isBenefitExpired,
} from "../benefit.entity.js";
import { sumLedgerBalance, type BenefitLedgerEntry } from "../benefit-ledger-entry.entity.js";

function buildGrantEntry(overrides: Partial<BenefitLedgerEntry> = {}): BenefitLedgerEntry {
  return {
    id: "grant-1",
    accountId: "account-1",
    userId: "user-1",
    type: "GRANT",
    amountMinorUnits: 1_000,
    reason: "Campanha de boas-vindas",
    sourceRef: null,
    expiresAt: null,
    grantEntryId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function buildDebitEntry(overrides: Partial<BenefitLedgerEntry> = {}): BenefitLedgerEntry {
  return {
    id: "debit-1",
    accountId: "account-1",
    userId: "user-1",
    type: "REDEMPTION",
    amountMinorUnits: -1_000,
    reason: null,
    sourceRef: null,
    expiresAt: null,
    grantEntryId: "grant-1",
    createdAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  };
}

describe("benefit state machine (CLAUDE.md #7)", () => {
  it("allows GRANTED -> AVAILABLE and AVAILABLE -> REDEEMED/EXPIRED/REVERSED", () => {
    expect(canTransitionBenefitStatus("GRANTED", "AVAILABLE")).toBe(true);
    expect(canTransitionBenefitStatus("AVAILABLE", "REDEEMED")).toBe(true);
    expect(canTransitionBenefitStatus("AVAILABLE", "EXPIRED")).toBe(true);
    expect(canTransitionBenefitStatus("AVAILABLE", "REVERSED")).toBe(true);
  });

  it("rejects any transition out of a terminal status", () => {
    expect(canTransitionBenefitStatus("REDEEMED", "AVAILABLE")).toBe(false);
    expect(() => assertBenefitTransition("EXPIRED", "REDEEMED")).toThrow(
      InvalidBenefitTransitionError,
    );
  });
});

describe("benefit amount (CLAUDE.md #58: never a hardcoded percentage/default)", () => {
  it("accepts a positive integer", () => {
    expect(() => assertValidBenefitAmount(500)).not.toThrow();
  });

  it("rejects zero, negative or non-integer amounts", () => {
    expect(() => assertValidBenefitAmount(0)).toThrow(InvalidBenefitAmountError);
    expect(() => assertValidBenefitAmount(-10)).toThrow(InvalidBenefitAmountError);
    expect(() => assertValidBenefitAmount(1.5)).toThrow(InvalidBenefitAmountError);
  });
});

describe("isBenefitExpired", () => {
  it("is never expired when expiresAt is null (granter chose 'never expires')", () => {
    expect(isBenefitExpired({ expiresAt: null }, new Date("2099-01-01T00:00:00Z"))).toBe(false);
  });

  it("is expired at/after its expiresAt", () => {
    const expiresAt = new Date("2026-01-05T00:00:00Z");
    expect(isBenefitExpired({ expiresAt }, new Date("2026-01-04T23:59:59Z"))).toBe(false);
    expect(isBenefitExpired({ expiresAt }, expiresAt)).toBe(true);
  });
});

describe("deriveBenefitFromLedger (BR-039: derived from the ledger, no separate mutable row)", () => {
  it("is AVAILABLE when no debit entry exists yet", () => {
    const benefit = deriveBenefitFromLedger(buildGrantEntry(), null);
    expect(benefit.status).toBe("AVAILABLE");
    expect(benefit.amountMinorUnits).toBe(1_000);
    expect(benefit.redeemedAt).toBeNull();
  });

  it("is REDEEMED when the debit entry is a REDEMPTION", () => {
    const grant = buildGrantEntry();
    const debit = buildDebitEntry({ type: "REDEMPTION" });
    const benefit = deriveBenefitFromLedger(grant, debit);
    expect(benefit.status).toBe("REDEEMED");
    expect(benefit.redeemedAt).toEqual(debit.createdAt);
  });

  it("is EXPIRED when the debit entry is an EXPIRATION", () => {
    const benefit = deriveBenefitFromLedger(
      buildGrantEntry(),
      buildDebitEntry({ type: "EXPIRATION" }),
    );
    expect(benefit.status).toBe("EXPIRED");
  });

  it("is REVERSED when the debit entry is a REVERSAL", () => {
    const benefit = deriveBenefitFromLedger(
      buildGrantEntry(),
      buildDebitEntry({ type: "REVERSAL" }),
    );
    expect(benefit.status).toBe("REVERSED");
  });

  it("throws if given a non-GRANT entry as the grant entry", () => {
    expect(() => deriveBenefitFromLedger(buildDebitEntry(), null)).toThrow();
  });
});

describe("sumLedgerBalance", () => {
  it("sums signed amounts across an account's entries", () => {
    const entries = [
      buildGrantEntry({ amountMinorUnits: 1_000 }),
      buildDebitEntry({ amountMinorUnits: -400 }),
    ];
    expect(sumLedgerBalance(entries)).toBe(600);
  });

  it("is zero for no entries", () => {
    expect(sumLedgerBalance([])).toBe(0);
  });
});
