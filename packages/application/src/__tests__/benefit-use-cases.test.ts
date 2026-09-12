/* eslint-disable @typescript-eslint/require-await -- in-memory test fakes intentionally implement async interfaces synchronously */
import { describe, expect, it } from "vitest";
import type { BenefitAccount, BenefitLedgerEntry, BenefitRedemption } from "@passasorte/domain";
import { GrantBenefitUseCase } from "../use-cases/benefit/grant-benefit.use-case.js";
import { ListMyBenefitsUseCase } from "../use-cases/benefit/list-my-benefits.use-case.js";
import { RedeemBenefitUseCase } from "../use-cases/benefit/redeem-benefit.use-case.js";
import { ExpireBenefitsUseCase } from "../use-cases/benefit/expire-benefits.use-case.js";
import type {
  AppendDebitEntryInput,
  AppendGrantEntryInput,
  BenefitAccountRepository,
  BenefitLedgerRepository,
  BenefitRedemptionRepository,
  CreateBenefitRedemptionInput,
} from "../ports/benefit-repository.port.js";
import type { IdempotencyPort } from "../ports/idempotency.port.js";
import type { OutboxPort, PublishOutboxEventInput } from "../ports/outbox.port.js";
import { AuthorizationError, ConflictError, NotFoundError } from "../errors.js";

class InMemoryBenefitAccountRepository implements BenefitAccountRepository {
  private nextId = 1;
  private readonly byUserId = new Map<string, BenefitAccount>();

  async findOrCreateByUserId(userId: string): Promise<BenefitAccount> {
    const existing = this.byUserId.get(userId);
    if (existing) return existing;
    const account: BenefitAccount = {
      id: `account-${this.nextId++}`,
      userId,
      createdAt: new Date(),
    };
    this.byUserId.set(userId, account);
    return account;
  }
}

class InMemoryBenefitLedgerRepository implements BenefitLedgerRepository {
  private nextId = 1;
  readonly entries: BenefitLedgerEntry[] = [];

  async appendGrantEntry(input: AppendGrantEntryInput): Promise<BenefitLedgerEntry> {
    const entry: BenefitLedgerEntry = {
      id: `entry-${this.nextId++}`,
      accountId: input.accountId,
      userId: input.userId,
      type: "GRANT",
      amountMinorUnits: input.amountMinorUnits,
      reason: input.reason,
      sourceRef: input.sourceRef,
      expiresAt: input.expiresAt,
      grantEntryId: null,
      createdAt: new Date(),
    };
    this.entries.push(entry);
    return entry;
  }

  async appendDebitEntry(input: AppendDebitEntryInput): Promise<BenefitLedgerEntry> {
    if (this.entries.some((e) => e.grantEntryId === input.grantEntryId)) {
      throw new Error(
        `O benefício "${input.grantEntryId}" já foi resgatado, expirado ou revertido.`,
      );
    }
    const entry: BenefitLedgerEntry = {
      id: `entry-${this.nextId++}`,
      accountId: input.accountId,
      userId: input.userId,
      type: input.type,
      amountMinorUnits: input.amountMinorUnits,
      reason: null,
      sourceRef: null,
      expiresAt: null,
      grantEntryId: input.grantEntryId,
      createdAt: new Date(),
    };
    this.entries.push(entry);
    return entry;
  }

  async findGrantEntryById(id: string): Promise<BenefitLedgerEntry | null> {
    return this.entries.find((e) => e.id === id && e.type === "GRANT") ?? null;
  }

  async findDebitEntryForGrant(grantEntryId: string): Promise<BenefitLedgerEntry | null> {
    return this.entries.find((e) => e.grantEntryId === grantEntryId) ?? null;
  }

  async listByAccountId(accountId: string): Promise<readonly BenefitLedgerEntry[]> {
    return this.entries.filter((e) => e.accountId === accountId);
  }

  async listExpirableGrantEntries(now: Date): Promise<readonly BenefitLedgerEntry[]> {
    return this.entries.filter(
      (e) =>
        e.type === "GRANT" &&
        e.expiresAt !== null &&
        e.expiresAt.getTime() <= now.getTime() &&
        !this.entries.some((debit) => debit.grantEntryId === e.id),
    );
  }
}

class InMemoryBenefitRedemptionRepository implements BenefitRedemptionRepository {
  private nextId = 1;
  readonly redemptions: BenefitRedemption[] = [];

  async create(input: CreateBenefitRedemptionInput): Promise<BenefitRedemption> {
    const redemption: BenefitRedemption = {
      id: `redemption-${this.nextId++}`,
      accountId: input.accountId,
      benefitId: input.benefitId,
      amountMinorUnits: input.amountMinorUnits,
      redeemedAt: new Date(),
    };
    this.redemptions.push(redemption);
    return redemption;
  }
}

class InMemoryIdempotencyPort implements IdempotencyPort {
  private readonly seen = new Set<string>();

  async record(key: string): Promise<boolean> {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}

class InMemoryOutbox implements OutboxPort {
  events: PublishOutboxEventInput[] = [];
  async publish(input: PublishOutboxEventInput) {
    this.events.push(input);
  }
}

function setupHarness() {
  return {
    accounts: new InMemoryBenefitAccountRepository(),
    ledger: new InMemoryBenefitLedgerRepository(),
    redemptions: new InMemoryBenefitRedemptionRepository(),
    idempotency: new InMemoryIdempotencyPort(),
    outbox: new InMemoryOutbox(),
  };
}

describe("GrantBenefitUseCase (FR-054)", () => {
  it("grants an immediately-AVAILABLE benefit and records a GRANT ledger entry", async () => {
    const { accounts, ledger, outbox } = setupHarness();
    const benefit = await new GrantBenefitUseCase(accounts, ledger, outbox).execute({
      userId: "user-1",
      amountMinorUnits: 1_000,
      reason: "Campanha de lançamento",
    });

    expect(benefit.status).toBe("AVAILABLE");
    expect(benefit.amountMinorUnits).toBe(1_000);
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0]?.type).toBe("GRANT");
    expect(outbox.events).toHaveLength(1);
    expect(outbox.events[0]?.eventType).toBe("benefit.granted");
  });

  it("rejects a non-positive amount without touching the ledger (CLAUDE.md #58)", async () => {
    const { accounts, ledger, outbox } = setupHarness();
    await expect(
      new GrantBenefitUseCase(accounts, ledger, outbox).execute({
        userId: "user-1",
        amountMinorUnits: 0,
        reason: "inválido",
      }),
    ).rejects.toThrow();
    expect(ledger.entries).toHaveLength(0);
  });
});

describe("ListMyBenefitsUseCase (FR-055, BR-039)", () => {
  it("derives the balance as the sum of the account's ledger entries", async () => {
    const { accounts, ledger, redemptions, idempotency, outbox } = setupHarness();
    const grantUseCase = new GrantBenefitUseCase(accounts, ledger, outbox);
    const benefit = await grantUseCase.execute({
      userId: "user-1",
      amountMinorUnits: 1_000,
      reason: "Bônus A",
    });
    await grantUseCase.execute({ userId: "user-1", amountMinorUnits: 500, reason: "Bônus B" });

    await new RedeemBenefitUseCase(ledger, redemptions, idempotency, outbox).execute({
      benefitId: benefit.id,
      userId: "user-1",
      idempotencyKey: "redeem-1",
    });

    const result = await new ListMyBenefitsUseCase(accounts, ledger).execute({ userId: "user-1" });
    expect(result.balanceMinorUnits).toBe(500);
    expect(result.benefits).toHaveLength(2);
    expect(result.benefits.find((b) => b.id === benefit.id)?.status).toBe("REDEEMED");
  });
});

describe("RedeemBenefitUseCase (FR-057/FR-058)", () => {
  it("redeems an available benefit exactly once, replaying the same key as a no-op error", async () => {
    const { accounts, ledger, redemptions, idempotency, outbox } = setupHarness();
    const benefit = await new GrantBenefitUseCase(accounts, ledger, outbox).execute({
      userId: "user-1",
      amountMinorUnits: 200,
      reason: "Bônus",
    });

    const useCase = new RedeemBenefitUseCase(ledger, redemptions, idempotency, outbox);
    const redeemed = await useCase.execute({
      benefitId: benefit.id,
      userId: "user-1",
      idempotencyKey: "key-1",
    });
    expect(redeemed.status).toBe("REDEEMED");
    expect(redemptions.redemptions).toHaveLength(1);

    await expect(
      useCase.execute({ benefitId: benefit.id, userId: "user-1", idempotencyKey: "key-1" }),
    ).rejects.toThrow(ConflictError);
  });

  it("rejects redeeming someone else's benefit", async () => {
    const { accounts, ledger, redemptions, idempotency, outbox } = setupHarness();
    const benefit = await new GrantBenefitUseCase(accounts, ledger, outbox).execute({
      userId: "user-1",
      amountMinorUnits: 200,
      reason: "Bônus",
    });

    await expect(
      new RedeemBenefitUseCase(ledger, redemptions, idempotency, outbox).execute({
        benefitId: benefit.id,
        userId: "user-2",
        idempotencyKey: "key-2",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects redeeming an already-expired benefit", async () => {
    const { accounts, ledger, redemptions, idempotency, outbox } = setupHarness();
    const benefit = await new GrantBenefitUseCase(accounts, ledger, outbox).execute({
      userId: "user-1",
      amountMinorUnits: 200,
      reason: "Bônus com validade",
      expiresAt: new Date("2026-01-01T00:00:00Z"),
    });

    await expect(
      new RedeemBenefitUseCase(ledger, redemptions, idempotency, outbox).execute({
        benefitId: benefit.id,
        userId: "user-1",
        idempotencyKey: "key-3",
        now: new Date("2026-02-01T00:00:00Z"),
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("rejects redeeming an unknown benefit", async () => {
    const { ledger, redemptions, idempotency, outbox } = setupHarness();
    await expect(
      new RedeemBenefitUseCase(ledger, redemptions, idempotency, outbox).execute({
        benefitId: "does-not-exist",
        userId: "user-1",
        idempotencyKey: "key-4",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("ExpireBenefitsUseCase (FR-056, background job expire_benefits)", () => {
  it("expires only grants past their own expiresAt, leaving others untouched", async () => {
    const { accounts, ledger, outbox } = setupHarness();
    const grantUseCase = new GrantBenefitUseCase(accounts, ledger, outbox);
    const expiring = await grantUseCase.execute({
      userId: "user-1",
      amountMinorUnits: 300,
      reason: "Expira",
      expiresAt: new Date("2026-01-01T00:00:00Z"),
    });
    const neverExpires = await grantUseCase.execute({
      userId: "user-1",
      amountMinorUnits: 300,
      reason: "Não expira",
    });

    const result = await new ExpireBenefitsUseCase(ledger, outbox).execute({
      now: new Date("2026-02-01T00:00:00Z"),
    });

    expect(result.expired.map((b) => b.id)).toEqual([expiring.id]);
    expect(ledger.entries.find((e) => e.grantEntryId === neverExpires.id)).toBeUndefined();
  });
});
