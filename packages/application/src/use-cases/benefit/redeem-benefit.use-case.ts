import { deriveBenefitFromLedger, isBenefitExpired, type Benefit } from "@passasorte/domain";
import type {
  BenefitLedgerRepository,
  BenefitRedemptionRepository,
} from "../../ports/benefit-repository.port.js";
import type { IdempotencyPort } from "../../ports/idempotency.port.js";
import type { OutboxPort } from "../../ports/outbox.port.js";
import { AuthorizationError, ConflictError, NotFoundError } from "../../errors.js";

export interface RedeemBenefitCommand {
  benefitId: string;
  userId: string;
  /** Caller-supplied key so a retried/duplicated request is a no-op (FR-058, same shape as FR-038). */
  idempotencyKey: string;
  now?: Date;
}

/**
 * FR-057 Benefit Redemption + FR-058 Redemption Replay Protection.
 * Reuses the same IdempotencyPort/Idempotency-Key mechanism as FR-038
 * movement submission (BR-037: financial commands share one idempotency
 * shape) — no separate single-use token concept is invented.
 *
 * CLAUDE.md #4.14 "Verify balance, eligibility, merchant, expiration and
 * single-use token, then atomically redeem": balance (via the state
 * machine) and expiration are enforced here. "Merchant"/extra
 * "eligibility" for redemption are NOT modeled — CLAUDE.md never
 * specifies which merchant(s) a benefit redeems at or what additional
 * eligibility would apply (#58) — so only ownership, availability and
 * expiration are checked; a merchant-scoped redemption flow is future
 * scope once that TBD is resolved, not something to guess at here.
 */
export class RedeemBenefitUseCase {
  constructor(
    private readonly ledger: BenefitLedgerRepository,
    private readonly redemptions: BenefitRedemptionRepository,
    private readonly idempotency: IdempotencyPort,
    private readonly outbox: OutboxPort,
  ) {}

  async execute(command: RedeemBenefitCommand): Promise<Benefit> {
    const now = command.now ?? new Date();

    const grantEntry = await this.ledger.findGrantEntryById(command.benefitId);
    if (!grantEntry) {
      throw new NotFoundError("Benefit", command.benefitId);
    }
    if (grantEntry.userId !== command.userId) {
      throw new AuthorizationError();
    }

    const existingDebit = await this.ledger.findDebitEntryForGrant(grantEntry.id);
    const current = deriveBenefitFromLedger(grantEntry, existingDebit);

    // A plain (non-domain-assert) check, deliberately: unlike a room/
    // participation transition, a benefit can legitimately be re-checked
    // after it was ALREADY closed out by this same call on a retry (the
    // idempotency guard below is what makes that retry safe) — so this
    // needs to surface as a normal 409 Conflict, not an
    // InvalidBenefitTransitionError bubbling up as a raw 500.
    if (current.status !== "AVAILABLE") {
      throw new ConflictError(
        `Este benefício não está disponível para resgate (status atual: ${current.status}).`,
      );
    }
    if (isBenefitExpired(current, now)) {
      throw new ConflictError("Este benefício expirou e não pode mais ser resgatado.");
    }

    const isFirstSubmission = await this.idempotency.record(command.idempotencyKey);
    if (!isFirstSubmission) {
      throw new ConflictError("Este resgate já foi processado anteriormente.");
    }

    const debitEntry = await this.ledger.appendDebitEntry({
      accountId: grantEntry.accountId,
      userId: grantEntry.userId,
      type: "REDEMPTION",
      amountMinorUnits: -grantEntry.amountMinorUnits,
      grantEntryId: grantEntry.id,
    });

    await this.redemptions.create({
      accountId: grantEntry.accountId,
      benefitId: grantEntry.id,
      amountMinorUnits: grantEntry.amountMinorUnits,
    });

    await this.outbox.publish({
      aggregateType: "BenefitAccount",
      aggregateId: grantEntry.accountId,
      eventType: "benefit.redeemed",
      payload: {
        userId: grantEntry.userId,
        benefitId: grantEntry.id,
        amountMinorUnits: grantEntry.amountMinorUnits,
      },
    });

    return deriveBenefitFromLedger(grantEntry, debitEntry);
  }
}
