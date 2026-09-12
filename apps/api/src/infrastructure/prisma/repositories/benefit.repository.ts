import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { BenefitAlreadyClosedError } from "@passasorte/domain";
import type {
  AppendDebitEntryInput,
  AppendGrantEntryInput,
  BenefitAccountRepository,
  BenefitLedgerRepository,
  BenefitRedemptionRepository,
  CreateBenefitRedemptionInput,
} from "@passasorte/application";
import type {
  BenefitAccount,
  BenefitLedgerEntry,
  BenefitLedgerEntryType,
  BenefitRedemption,
} from "@passasorte/domain";
import type {
  BenefitAccount as PrismaBenefitAccount,
  BenefitLedgerEntry as PrismaBenefitLedgerEntry,
  BenefitRedemption as PrismaBenefitRedemption,
} from "@prisma/client";
import { PrismaService } from "../prisma.service.js";

function toDomainAccount(row: PrismaBenefitAccount): BenefitAccount {
  return { id: row.id, userId: row.userId, createdAt: row.createdAt };
}

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

function toDomainRedemption(row: PrismaBenefitRedemption): BenefitRedemption {
  return {
    id: row.id,
    accountId: row.accountId,
    benefitId: row.benefitId,
    amountMinorUnits: row.amountMinorUnits,
    redeemedAt: row.redeemedAt,
  };
}

/** FR-055 Benefit Ledger: one account per user, created lazily on first grant/lookup. */
@Injectable()
export class PrismaBenefitAccountRepository implements BenefitAccountRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findOrCreateByUserId(userId: string): Promise<BenefitAccount> {
    const existing = await this.prisma.benefitAccount.findUnique({ where: { userId } });
    if (existing) {
      return toDomainAccount(existing);
    }
    try {
      const created = await this.prisma.benefitAccount.create({ data: { userId } });
      return toDomainAccount(created);
    } catch (error) {
      // Two concurrent first-grants for the same user: the loser re-reads
      // the winner's row instead of failing (userId is @unique).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const row = await this.prisma.benefitAccount.findUnique({ where: { userId } });
        if (row) return toDomainAccount(row);
      }
      throw error;
    }
  }
}

/**
 * BR-039: every write here is an append (create), never an update/delete.
 * `appendDebitEntry` relies on `grant_entry_id`'s unique constraint (see
 * the Phase 7 migration) to guarantee at most one debit per grant even
 * under a concurrent redeem/expire race — the same pattern as
 * PrismaIdempotencyRepository's P2002 handling.
 */
@Injectable()
export class PrismaBenefitLedgerRepository implements BenefitLedgerRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async appendGrantEntry(input: AppendGrantEntryInput): Promise<BenefitLedgerEntry> {
    const row = await this.prisma.benefitLedgerEntry.create({
      data: {
        accountId: input.accountId,
        userId: input.userId,
        type: "GRANT",
        amountMinorUnits: input.amountMinorUnits,
        reason: input.reason,
        sourceRef: input.sourceRef,
        expiresAt: input.expiresAt,
      },
    });
    return toDomainLedgerEntry(row);
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

  async findGrantEntryById(id: string): Promise<BenefitLedgerEntry | null> {
    const row = await this.prisma.benefitLedgerEntry.findUnique({ where: { id } });
    return row && row.type === "GRANT" ? toDomainLedgerEntry(row) : null;
  }

  async findDebitEntryForGrant(grantEntryId: string): Promise<BenefitLedgerEntry | null> {
    const row = await this.prisma.benefitLedgerEntry.findUnique({ where: { grantEntryId } });
    return row ? toDomainLedgerEntry(row) : null;
  }

  async listByAccountId(accountId: string): Promise<readonly BenefitLedgerEntry[]> {
    const rows = await this.prisma.benefitLedgerEntry.findMany({
      where: { accountId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDomainLedgerEntry);
  }

  async listExpirableGrantEntries(now: Date): Promise<readonly BenefitLedgerEntry[]> {
    const rows = await this.prisma.benefitLedgerEntry.findMany({
      where: {
        type: "GRANT",
        expiresAt: { lte: now },
        debitEntry: { is: null },
      },
    });
    return rows.map(toDomainLedgerEntry);
  }
}

/** FR-057/FR-058: audit trail of completed redemptions, separate from the ledger's REDEMPTION entry. */
@Injectable()
export class PrismaBenefitRedemptionRepository implements BenefitRedemptionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateBenefitRedemptionInput): Promise<BenefitRedemption> {
    const row = await this.prisma.benefitRedemption.create({
      data: {
        accountId: input.accountId,
        benefitId: input.benefitId,
        amountMinorUnits: input.amountMinorUnits,
      },
    });
    return toDomainRedemption(row);
  }
}
