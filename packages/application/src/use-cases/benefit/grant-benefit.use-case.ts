import {
  assertValidBenefitAmount,
  deriveBenefitFromLedger,
  type Benefit,
} from "@passasorte/domain";
import type {
  BenefitAccountRepository,
  BenefitLedgerRepository,
} from "../../ports/benefit-repository.port.js";
import type { OutboxPort } from "../../ports/outbox.port.js";

export interface GrantBenefitCommand {
  userId: string;
  amountMinorUnits: number;
  reason: string;
  sourceRef?: string | null;
  expiresAt?: Date | null;
}

/**
 * FR-054 Promotional Benefit Grant. Deliberately has no automatic
 * trigger (e.g. "grant N units on winning") — CLAUDE.md never specifies
 * what promotion earns a benefit, how much, or when it expires (#58:
 * benefit funding/percentage/expiration are TBD) — so this is only
 * reachable via an authorized OPERATOR/ADMIN/FINANCE action (see
 * apps/api's BenefitsController RBAC) that supplies every one of those
 * values explicitly. Same "mechanism real, business values never
 * invented" split already used for eligibility rules and notification
 * providers elsewhere in this codebase.
 */
export class GrantBenefitUseCase {
  constructor(
    private readonly accounts: BenefitAccountRepository,
    private readonly ledger: BenefitLedgerRepository,
    private readonly outbox: OutboxPort,
  ) {}

  async execute(command: GrantBenefitCommand): Promise<Benefit> {
    assertValidBenefitAmount(command.amountMinorUnits);

    const account = await this.accounts.findOrCreateByUserId(command.userId);
    const grantEntry = await this.ledger.appendGrantEntry({
      accountId: account.id,
      userId: command.userId,
      amountMinorUnits: command.amountMinorUnits,
      reason: command.reason,
      sourceRef: command.sourceRef ?? null,
      expiresAt: command.expiresAt ?? null,
    });

    await this.outbox.publish({
      aggregateType: "BenefitAccount",
      aggregateId: account.id,
      eventType: "benefit.granted",
      payload: {
        userId: command.userId,
        benefitId: grantEntry.id,
        amountMinorUnits: grantEntry.amountMinorUnits,
        reason: grantEntry.reason,
      },
    });

    return deriveBenefitFromLedger(grantEntry, null);
  }
}
