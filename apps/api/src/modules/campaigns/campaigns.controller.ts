import { Body, Controller, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  CreateCampaignSchema,
  TransitionCampaignSchema,
  UpdateCampaignDraftSchema,
} from "@passasorte/api-contract";
import {
  CreateCampaignUseCase,
  TransitionCampaignUseCase,
  UpdateCampaignDraftUseCase,
  type AuditLogPort,
  type CampaignRepository,
  type ExperienceRepository,
  type MerchantRepository,
  type OutboxPort,
} from "@passasorte/application";
import type { AuthenticatedUser, Campaign, PilotPolicy } from "@passasorte/domain";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import { Roles } from "../../common/auth/roles.decorator.js";
import { RolesGuard } from "../../common/auth/roles.guard.js";
import {
  AUDIT_LOG_PORT,
  CAMPAIGN_REPOSITORY,
  EXPERIENCE_REPOSITORY,
  MERCHANT_REPOSITORY,
  OUTBOX_PORT,
  PILOT_POLICY,
} from "../../common/tokens.js";
import { parseWithSchema } from "../../common/validation/parse-with-schema.js";

/**
 * FR-013/FR-014 Campaign Creation + Configuration, FR-015 Approval,
 * FR-016 Publication, FR-017 Cancellation. Backoffice-only - the public
 * read surface (FR-007 Campaign Catalog) lives in CatalogController.
 */
@Controller("campaigns")
@UseGuards(AuthGuard, RolesGuard)
export class CampaignsController {
  private readonly createCampaign: CreateCampaignUseCase;
  private readonly updateCampaignDraft: UpdateCampaignDraftUseCase;
  private readonly transitionCampaign: TransitionCampaignUseCase;

  constructor(
    @Inject(CAMPAIGN_REPOSITORY) campaignRepository: CampaignRepository,
    @Inject(MERCHANT_REPOSITORY) merchantRepository: MerchantRepository,
    @Inject(EXPERIENCE_REPOSITORY) experienceRepository: ExperienceRepository,
    @Inject(AUDIT_LOG_PORT) auditLog: AuditLogPort,
    @Inject(OUTBOX_PORT) outbox: OutboxPort,
    @Inject(PILOT_POLICY) pilotPolicy: PilotPolicy,
  ) {
    this.createCampaign = new CreateCampaignUseCase(
      campaignRepository,
      merchantRepository,
      experienceRepository,
      auditLog,
    );
    this.updateCampaignDraft = new UpdateCampaignDraftUseCase(campaignRepository, auditLog);
    this.transitionCampaign = new TransitionCampaignUseCase(
      campaignRepository,
      experienceRepository,
      auditLog,
      outbox,
      pilotPolicy,
    );
  }

  @Post()
  @Roles("OPERATOR", "ADMIN", "MERCHANT_OPERATOR")
  create(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser): Promise<Campaign> {
    const input = parseWithSchema(CreateCampaignSchema, body);
    return this.createCampaign.execute({ ...input, actorUserId: user.user.id });
  }

  @Patch(":id")
  @Roles("OPERATOR", "ADMIN", "MERCHANT_OPERATOR")
  updateDraft(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Campaign> {
    const input = parseWithSchema(UpdateCampaignDraftSchema, body);
    return this.updateCampaignDraft.execute({
      ...input,
      campaignId: id,
      actorUserId: user.user.id,
    });
  }

  @Post(":id/transitions")
  @Roles("OPERATOR", "ADMIN")
  transition(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Campaign> {
    const input = parseWithSchema(TransitionCampaignSchema, body);
    return this.transitionCampaign.execute({
      campaignId: id,
      targetStatus: input.status,
      cancellationReason: input.cancellationReason,
      actorUserId: user.user.id,
    });
  }
}
