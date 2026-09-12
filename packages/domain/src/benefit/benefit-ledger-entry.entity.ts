export type BenefitLedgerEntryType = "GRANT" | "REDEMPTION" | "EXPIRATION" | "REVERSAL";

/**
 * BR-039: the append-only, immutable ledger IS the balance/benefit
 * source of truth — there is no separate mutable "Benefit" row (see
 * benefit.entity.ts's `deriveBenefitFromLedger`). A GRANT entry both
 * credits the account AND carries the grant's own metadata
 * (reason/sourceRef/expiresAt, all caller-supplied — CLAUDE.md #58
 * forbids a hardcoded benefit percentage/expiration/funding default). A
 * debit entry (REDEMPTION/EXPIRATION/REVERSAL) references the GRANT
 * entry it closes out via `grantEntryId` and carries the matching
 * negative amount, so a plain sum over an account's entries always
 * equals its current balance.
 */
export interface BenefitLedgerEntry {
  readonly id: string;
  readonly accountId: string;
  readonly userId: string;
  readonly type: BenefitLedgerEntryType;
  /** Positive on a GRANT entry, negative on every debit entry. */
  readonly amountMinorUnits: number;
  /** Only present on a GRANT entry — null on every debit entry. */
  readonly reason: string | null;
  /** Only present on a GRANT entry — null on every debit entry. */
  readonly sourceRef: string | null;
  /** Only present on a GRANT entry — null on every debit entry. */
  readonly expiresAt: Date | null;
  /** Only present on a debit entry: which GRANT entry it closes out. */
  readonly grantEntryId: string | null;
  readonly createdAt: Date;
}

export function sumLedgerBalance(entries: readonly BenefitLedgerEntry[]): number {
  return entries.reduce((total, entry) => total + entry.amountMinorUnits, 0);
}

export class BenefitAlreadyClosedError extends Error {
  constructor(grantEntryId: string) {
    super(`O benefício "${grantEntryId}" já foi resgatado, expirado ou revertido.`);
    this.name = "BenefitAlreadyClosedError";
  }
}
