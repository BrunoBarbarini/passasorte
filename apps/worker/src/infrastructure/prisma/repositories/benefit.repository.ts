/**
 * Mirrors apps/api/src/infrastructure/prisma/repositories/benefit.repository.ts.
 * The worker only ever calls listExpirableGrantEntries/appendDebitEntry
 * (via ExpireBenefitsUseCase) — every other method exists only to
 * satisfy BenefitLedgerRepository and is never reached.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { BenefitAlreadyClosedError } from "@passasorte/domain";
import type { AppendDebitEntryInput, BenefitLedgerRepository } from "@passasorte/application";
import type { BenefitLedgerEntry as PrismaBenefitLedgerEntry } from "@prisma/client";
import type { BenefitLedgerEntry, BenefitLedgerEntryType } from "@passasorte/domain";

function toDomainLedgerEntry(row: PrismaBenefitLedgerEntry): BenefitLedgerEntry {
  return {
    id: row.id,
    accountId: row.accountId,
    userId: row.userId,
    type: row.type as BenefitLedgerEntryType,
    amountMinorUnits: row.amountMinorUnits,
    reason: row.reason,
    sourceRef: row.sourceRef,
    expiresAt: row.expiresAt,
    grantEntryId: row.grantEntryId,
    createdAt: row.createdAt,
  };
}

export class PrismaBenefitLedgerRepository implements BenefitLedgerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  appendGrantEntry(): Promise<BenefitLedgerEntry> {
    throw new Error("PrismaBenefitLedgerRepository.appendGrantEntry não é usado pelo worker.");
  }

  async appendDebitEntry(input: AppendDebitEntryInput): Promise<BenefitLedgerEntry> {
    try {
      const row = await this.prisma.benefitLedgerEntry.create({
        data: {
          accountId: input.accountId,
          userId: input.userId,
          type: input.type,
          amountMinorUnits: input.amountMinorUnits,
          grantEntryId: input.grantEntryId,
        },
      });
      return toDomainLedgerEntry(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BenefitAlreadyClosedError(input.grantEntryId);
      }
      throw error;
    }
  }

  findGrantEntryById(): Promise<BenefitLedgerEntry | null> {
    throw new Error("PrismaBenefitLedgerRepository.findGrantEntryById não é usado pelo worker.");
  }

  findDebitEntryForGrant(): Promise<BenefitLedgerEntry | null> {
    throw new Error(
      "PrismaBenefitLedgerRepository.findDebitEntryForGrant não é usado pelo worker.",
    );
  }

  listByAccountId(): Promise<readonly BenefitLedgerEntry[]> {
    throw new Error("PrismaBenefitLedgerRepository.listByAccountId não é usado pelo worker.");
  }

  async listExpirableGrantEntries(now: Date): Promise<readonly BenefitLedgerEntry[]> {
    const rows = await this.prisma.benefitLedgerEntry.findMany({
      where: { type: "GRANT", expiresAt: { lte: now }, debitEntry: { is: null } },
    });
    return rows.map(toDomainLedgerEntry);
  }
}
