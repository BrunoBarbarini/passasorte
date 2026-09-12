import { deriveBenefitFromLedger, type Benefit } from "@passasorte/domain";
import type { BenefitLedgerRepository } from "../../ports/benefit-repository.port.js";
import type { OutboxPort } from "../../ports/outbox.port.js";

export interface ExpireBenefitsCommand {
  now?: Date;
}

export interface ExpireBenefitsResult {
  expired: readonly Benefit[];
}

/**
 * FR-056 Benefit Expiration — background job `expire_benefits`
 * (CLAUDE.md #28). The expiration MOMENT is caller-supplied per grant
 * (`expiresAt`, CLAUDE.md #58 forbids inventing a default duration);
 * this use case only sweeps whatever grants have already reached that
 * moment and have not been redeemed/reversed first. A grant that a
 * concurrent redemption closes out in the same window loses the race at
 * the ledger's unique-constraint level (`BenefitAlreadyClosedError`) and
 * is simply skipped here rather than treated as a failure.
 */
export class ExpireBenefitsUseCase {
  constructor(
    private readonly ledger: BenefitLedgerRepository,
    private readonly outbox: OutboxPort,
  ) {}

  async execute(command: ExpireBenefitsCommand = {}): Promise<ExpireBenefitsResult> {
    const now = command.now ?? new Date();
    const grantEntries = await this.ledger.listExpirableGrantEntries(now);
    const expired: Benefit[] = [];

    for (const grantEntry of grantEntries) {
      try {
        const debitEntry = await this.ledger.appendDebitEntry({
          accountId: grantEntry.accountId,
          userId: grantEntry.userId,
          type: "EXPIRATION",
          amountMinorUnits: -grantEntry.amountMinorUnits,
          grantEntryId: grantEntry.id,
        });

        await this.outbox.publish({
          aggregateType: "BenefitAccount",
          aggregateId: grantEntry.accountId,
          eventType: "benefit.expired",
          payload: {
            userId: grantEntry.userId,
            benefitId: grantEntry.id,
            amountMinorUnits: grantEntry.amountMinorUnits,
          },
        });

        expired.push(deriveBenefitFromLedger(grantEntry, debitEntry));
      } catch {
        // BenefitAlreadyClosedError: a redemption/reversal won the race first — not a failure.
      }
    }

    return { expired };
  }
}
