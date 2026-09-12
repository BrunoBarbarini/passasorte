import type {
  BenefitAccount,
  BenefitLedgerEntry,
  BenefitLedgerEntryType,
  BenefitRedemption,
} from "@passasorte/domain";

export interface BenefitAccountRepository {
  findOrCreateByUserId(userId: string): Promise<BenefitAccount>;
}

export interface AppendGrantEntryInput {
  accountId: string;
  userId: string;
  amountMinorUnits: number;
  reason: string;
  sourceRef: string | null;
  expiresAt: Date | null;
}

export interface AppendDebitEntryInput {
  accountId: string;
  userId: string;
  type: Exclude<BenefitLedgerEntryType, "GRANT">;
  /** Must be negative — the caller (use case), not the adapter, computes it. */
  amountMinorUnits: number;
  grantEntryId: string;
}

/**
 * BR-039: this port is the ONLY way to mutate benefit state — every
 * write is an append (never an update/delete). `appendDebitEntry`'s
 * adapter must enforce at most one debit entry per `grantEntryId` (e.g.
 * a unique constraint) and throw `BenefitAlreadyClosedError` on a
 * violation, mirroring `lockFinalMovementPlan`'s
 * `FinalMovementPlanAlreadyLockedError` "atomic claim" pattern elsewhere
 * in this codebase (same reason: two concurrent callers — a redemption
 * and the expiry job — must never both win).
 */
export interface BenefitLedgerRepository {
  appendGrantEntry(input: AppendGrantEntryInput): Promise<BenefitLedgerEntry>;
  appendDebitEntry(input: AppendDebitEntryInput): Promise<BenefitLedgerEntry>;
  findGrantEntryById(id: string): Promise<BenefitLedgerEntry | null>;
  findDebitEntryForGrant(grantEntryId: string): Promise<BenefitLedgerEntry | null>;
  listByAccountId(accountId: string): Promise<readonly BenefitLedgerEntry[]>;
  /** GRANT entries with `expiresAt <= now` that have no debit entry yet — background job `expire_benefits` (CLAUDE.md #28). */
  listExpirableGrantEntries(now: Date): Promise<readonly BenefitLedgerEntry[]>;
}

export interface CreateBenefitRedemptionInput {
  accountId: string;
  benefitId: string;
  amountMinorUnits: number;
}

export interface BenefitRedemptionRepository {
  create(input: CreateBenefitRedemptionInput): Promise<BenefitRedemption>;
}
