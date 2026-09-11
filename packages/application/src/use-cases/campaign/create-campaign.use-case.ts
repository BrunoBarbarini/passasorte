import { canAttachToNewCampaign, canSponsorNewCampaign, type Campaign } from "@passasorte/domain";
import type { AuditLogPort } from "../../ports/audit-log.port.js";
import type { CampaignRepository, CreateCampaignInput } from "../../ports/campaign-repository.port.js";
import type { ExperienceRepository } from "../../ports/experience-repository.port.js";
import type { MerchantRepository } from "../../ports/merchant-repository.port.js";
import { DomainError, NotFoundError, ValidationError } from "../../errors.js";

export interface CreateCampaignCommand extends CreateCampaignInput {
  actorUserId: string;
}

/** FR-013 Campaign Creation + FR-014 Campaign Configuration (initial). */
export class CreateCampaignUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly merchantRepository: MerchantRepository,
    private readonly experienceRepository: ExperienceRepository,
    private readonly auditLog: AuditLogPort,
  ) {}

  async execute(command: CreateCampaignCommand): Promise<Campaign> {
    if (!command.title.trim()) {
      throw new ValidationError("Título é obrigatório.", { field: "title" });
    }
    if (
      command.scheduledStartAt &&
      command.scheduledEndAt &&
      command.scheduledStartAt >= command.scheduledEndAt
    ) {
      throw new ValidationError("A data de início deve ser anterior à data de término.", {
        field: "scheduledEndAt",
      });
    }

    const merchant = await this.merchantRepository.findById(command.merchantId);
    if (!merchant) {
      throw new NotFoundError("Merchant", command.merchantId);
    }
    if (!canSponsorNewCampaign(merchant)) {
      throw new DomainError("Apenas merchants ativos podem patrocinar novas campanhas.");
    }

    const experience = await this.experienceRepository.findById(command.experienceId);
    if (!experience) {
      throw new NotFoundError("Experience", command.experienceId);
    }
    if (experience.merchantId !== command.merchantId) {
      throw new ValidationError("A experiência informada não pertence a este merchant.", {
        field: "experienceId",
      });
    }
    if (!canAttachToNewCampaign(experience)) {
      throw new DomainError("Uma experiência arquivada não pode ser usada em uma nova campanha.");
    }

    const campaign = await this.campaignRepository.create({
      merchantId: command.merchantId,
      experienceId: command.experienceId,
      title: command.title.trim(),
      timezone: command.timezone,
      scheduledStartAt: command.scheduledStartAt ?? null,
      scheduledEndAt: command.scheduledEndAt ?? null,
    });

    await this.auditLog.record({
      actorUserId: command.actorUserId,
      action: "campaign.created",
      entityType: "Campaign",
      entityId: campaign.id,
    });

    return campaign;
  }
}
