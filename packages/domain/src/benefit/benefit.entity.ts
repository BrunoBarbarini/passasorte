import type { BenefitStatus } from "./benefit-state-machine.js";
import type { BenefitLedgerEntry } from "./benefit-ledger-entry.entity.js";

/**
 * FR-054 Promotional Benefit Grant. A read model, not its own storage
 * row — `id` is the GRANT ledger entry's id. `amountMinorUnits`,
 * `reason`, `sourceRef` and `expiresAt` are always supplied by whoever
 * grants the benefit (an OPERATOR/ADMIN/FINANCE action, see
 * GrantBenefitUseCase); CLAUDE.md #58 forbids inventing a benefit
 * percentage/expiration/funding rule, so nothing here computes a default
 * amount or a default expiry. `expiresAt: null` means "does not expire"
 * — also the granter's explicit choice, never assumed. `reason` is an
 * opaque, granter-supplied label (e.g. which promotion/campaign it came
 * from) — never a hardcoded enum of promotion types, since CLAUDE.md
 * never enumerates what those are.
 */
export interface Benefit {
  readonly id: string;
  readonly accountId: string;
  readonly userId: string;
  readonly amountMinorUnits: number;
  readonly reason: string;
  readonly sourceRef: string | null;
  readonly expiresAt: Date | null;
  readonly status: BenefitStatus;
  readonly grantedAt: Date;
  readonly redeemedAt: Date | null;
  readonly expiredAt: Date | null;
  readonly reversedAt: Date | null;
}

export class InvalidBenefitAmountError extends Error {
  constructor() {
    super("O valor do benefício precisa ser um número inteiro positivo.");
    this.name = "InvalidBenefitAmountError";
  }
}

export function assertValidBenefitAmount(amountMinorUnits: number): void {
  if (!Number.isInteger(amountMinorUnits) || amountMinorUnits <= 0) {
    throw new InvalidBenefitAmountError();
  }
}

export function isBenefitExpired(benefit: Pick<Benefit, "expiresAt">, now: Date): boolean {
  return benefit.expiresAt !== null && benefit.expiresAt.getTime() <= now.getTime();
}

/**
 * Derives a Benefit read model from its GRANT ledger entry plus,
 * once it exists, the single debit entry (REDEMPTION/EXPIRATION/
 * REVERSAL) that closed it out (`debitEntry` must reference
 * `grantEntry` via `grantEntryId`, or be null). There is deliberately no
 * separately persisted "status" column to keep out of sync with the
 * ledger (BR-039).
 */
export function deriveBenefitFromLedger(
  grantEntry: BenefitLedgerEntry,
  debitEntry: BenefitLedgerEntry | null,
): Benefit {
  if (grantEntry.type !== "GRANT" || grantEntry.reason === null) {
    throw new Error("A entrada de ledger informada não é uma concessão (GRANT).");
  }

  const base = {
    id: grantEntry.id,
    accountId: grantEntry.accountId,
    userId: grantEntry.userId,
    amountMinorUnits: grantEntry.amountMinorUnits,
    reason: grantEntry.reason,
    sourceRef: grantEntry.sourceRef,
    expiresAt: grantEntry.expiresAt,
    grantedAt: grantEntry.createdAt,
    redeemedAt: null as Date | null,
    expiredAt: null as Date | null,
    reversedAt: null as Date | null,
  };

  if (!debitEntry) {
    return { ...base, status: "AVAILABLE" };
  }
  if (debitEntry.type === "REDEMPTION") {
    return { ...base, status: "REDEEMED", redeemedAt: debitEntry.createdAt };
  }
  if (debitEntry.type === "EXPIRATION") {
    return { ...base, status: "EXPIRED", expiredAt: debitEntry.createdAt };
  }
  return { ...base, status: "REVERSED", reversedAt: debitEntry.createdAt };
}
