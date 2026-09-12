/**
 * FR-055 Benefit Ledger. One account per user (1:1), created lazily on
 * first grant/lookup — it carries no balance of its own (BR-039: the
 * ledger is the only source of truth), just the identity anchor every
 * BenefitLedgerEntry references.
 */
export interface BenefitAccount {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: Date;
}
