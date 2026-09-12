/**
 * FR-057 Benefit Redemption + FR-058 Redemption Replay Protection. One
 * row per completed redemption — an audit record distinct from the
 * ledger's REDEMPTION entry (which is what actually moves the balance);
 * this exists so the ERD's `benefit_redemptions` relation has somewhere
 * to live and a redemption can be looked up by benefit without scanning
 * the whole ledger. Replay protection itself reuses the existing
 * IdempotencyPort/Idempotency-Key mechanism (FR-038/BR-037) rather than
 * inventing a new single-use token concept — see RedeemBenefitUseCase.
 */
export interface BenefitRedemption {
  readonly id: string;
  readonly accountId: string;
  /** The GRANT ledger entry's id (== Benefit.id). */
  readonly benefitId: string;
  readonly amountMinorUnits: number;
  readonly redeemedAt: Date;
}
