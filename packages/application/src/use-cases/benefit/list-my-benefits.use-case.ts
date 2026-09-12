import { deriveBenefitFromLedger, sumLedgerBalance, type Benefit } from "@passasorte/domain";
import type {
  BenefitAccountRepository,
  BenefitLedgerRepository,
} from "../../ports/benefit-repository.port.js";

export interface ListMyBenefitsCommand {
  userId: string;
}

export interface ListMyBenefitsResult {
  balanceMinorUnits: number;
  benefits: readonly Benefit[];
}

/** FR-055 Benefit Ledger + CLAUDE.md #16 `GET /api/v1/me/benefits`. */
export class ListMyBenefitsUseCase {
  constructor(
    private readonly accounts: BenefitAccountRepository,
    private readonly ledger: BenefitLedgerRepository,
  ) {}

  async execute(command: ListMyBenefitsCommand): Promise<ListMyBenefitsResult> {
    const account = await this.accounts.findOrCreateByUserId(command.userId);
    const entries = await this.ledger.listByAccountId(account.id);
    const balanceMinorUnits = sumLedgerBalance(entries);

    const debitsByGrantId = new Map(
      entries
        .filter((entry) => entry.grantEntryId !== null)
        .map((entry) => [entry.grantEntryId as string, entry]),
    );

    const benefits = entries
      .filter((entry) => entry.type === "GRANT")
      .map((grantEntry) =>
        deriveBenefitFromLedger(grantEntry, debitsByGrantId.get(grantEntry.id) ?? null),
      )
      .sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime());

    return { balanceMinorUnits, benefits };
  }
}
