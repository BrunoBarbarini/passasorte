import { Body, Controller, Get, Headers, Inject, Post, UseGuards } from "@nestjs/common";
import { CreateBenefitRedemptionSchema, GrantBenefitSchema } from "@passasorte/api-contract";
import {
  DomainError,
  GrantBenefitUseCase,
  ListMyBenefitsUseCase,
  RedeemBenefitUseCase,
  ValidationError,
  type BenefitAccountRepository,
  type BenefitLedgerRepository,
  type BenefitRedemptionRepository,
  type IdempotencyPort,
  type ListMyBenefitsResult,
  type OutboxPort,
} from "@passasorte/application";
import type { AuthenticatedUser, Benefit } from "@passasorte/domain";
import type { FeatureFlags } from "@passasorte/config";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import { Roles } from "../../common/auth/roles.decorator.js";
import { RolesGuard } from "../../common/auth/roles.guard.js";
import {
  BENEFIT_ACCOUNT_REPOSITORY,
  BENEFIT_LEDGER_REPOSITORY,
  BENEFIT_REDEMPTION_REPOSITORY,
  FEATURE_FLAGS,
  IDEMPOTENCY_PORT,
  OUTBOX_PORT,
} from "../../common/tokens.js";
import { parseWithSchema } from "../../common/validation/parse-with-schema.js";

/**
 * FR-054..FR-058 (TASK-057 Benefit Ledger, TASK-058 Benefit Redemption).
 * Granting is an OPERATOR/ADMIN/FINANCE backoffice action (no automatic
 * trigger exists — see GrantBenefitUseCase); listing/redeeming are
 * participant-scoped (always the caller's own account, via CurrentUser).
 * Redemption is additionally gated by ENABLE_BENEFIT_REDEMPTION
 * (CLAUDE.md #22/#1.9: benefits are a LEGAL GATE, default off until
 * formally approved) — granting itself is NOT gated by that flag, since
 * accruing an internal ledger credit carries none of the legal risk that
 * actually redeeming/using it does.
 */
@Controller()
@UseGuards(AuthGuard)
export class BenefitsController {
  constructor(
    @Inject(BENEFIT_ACCOUNT_REPOSITORY) private readonly accounts: BenefitAccountRepository,
    @Inject(BENEFIT_LEDGER_REPOSITORY) private readonly ledger: BenefitLedgerRepository,
    @Inject(BENEFIT_REDEMPTION_REPOSITORY)
    private readonly redemptions: BenefitRedemptionRepository,
    @Inject(IDEMPOTENCY_PORT) private readonly idempotency: IdempotencyPort,
    @Inject(OUTBOX_PORT) private readonly outbox: OutboxPort,
    @Inject(FEATURE_FLAGS) private readonly featureFlags: FeatureFlags,
  ) {}

  @Get("me/benefits")
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<ListMyBenefitsResult> {
    return new ListMyBenefitsUseCase(this.accounts, this.ledger).execute({
      userId: user.user.id,
    });
  }

  @Post("benefit-grants")
  @UseGuards(RolesGuard)
  @Roles("OPERATOR", "ADMIN", "FINANCE")
  grant(@Body() body: unknown): Promise<Benefit> {
    const input = parseWithSchema(GrantBenefitSchema, body);
    return new GrantBenefitUseCase(this.accounts, this.ledger, this.outbox).execute({
      userId: input.userId,
      amountMinorUnits: input.amountMinorUnits,
      reason: input.reason,
      sourceRef: input.sourceRef ?? null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });
  }

  @Post("benefit-redemptions")
  async redeem(
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Benefit> {
    if (!this.featureFlags.ENABLE_BENEFIT_REDEMPTION) {
      throw new DomainError(
        "O resgate de benefícios ainda não está disponível nesta operação (aguardando aprovação legal/comercial — ENABLE_BENEFIT_REDEMPTION).",
      );
    }
    if (!idempotencyKey) {
      throw new ValidationError("O cabeçalho Idempotency-Key é obrigatório.", {
        field: "Idempotency-Key",
      });
    }
    const input = parseWithSchema(CreateBenefitRedemptionSchema, body);
    return new RedeemBenefitUseCase(
      this.ledger,
      this.redemptions,
      this.idempotency,
      this.outbox,
    ).execute({
      benefitId: input.benefitId,
      userId: user.user.id,
      idempotencyKey,
    });
  }
}
