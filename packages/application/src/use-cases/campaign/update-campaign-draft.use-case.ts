import { isCampaignEditable, type Campaign } from "@passasorte/domain";
import type { AuditLogPort } from "../../ports/audit-log.port.js";
import type { CampaignRepository, UpdateCampaignDraftInput } from "../../ports/campaign-repository.port.js";
import { DomainError, NotFoundError, ValidationError } from "../../errors.js";

export interface UpdateCampaignDraftCommand extends UpdateCampaignDraftInput {
  campaignId: string;
  actorUserId: string;
}

/** FR-014 Campaign Configuration: only while the campaign is DRAFT. */
export class UpdateCampaignDraftUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly auditLog: AuditLogPort,
  ) {}

  async execute(command: UpdateCampaignDraftCommand): Promise<Campaign> {
    const existing = await this.campaignRepository.findById(command.campaignId);
    if (!existing) {
      throw new NotFoundError("Campaign", command.campaignId);
    }
    if (!isCampaignEditable(existing)) {
      throw new DomainError(
        "Só é possível editar uma campanha enquanto ela está em rascunho (DRAFT).",
      );
    }
    if (command.title !== undefined && !command.title.trim()) {
      throw new ValidationError("Título não pode ficar em branco.", { field: "title" });
    }

    const start = command.scheduledStartAt ?? existing.scheduledStartAt;
    const end = command.scheduledEndAt ?? existing.scheduledEndAt;
    if (start && end && start >= end) {
      throw new ValidationError("A data de início deve ser anterior à data de término.", {
        field: "scheduledEndAt",
      });
    }

    const campaign = await this.campaignRepository.updateDraft(command.campaignId, {
      title: command.title?.trim(),
      timezone: command.timezone,
      scheduledStartAt: command.scheduledStartAt,
      scheduledEndAt: command.scheduledEndAt,
    });

    await this.auditLog.record({
      actorUserId: command.actorUserId,
      action: "campaign.draft_updated",
      entityType: "Campaign",
      entityId: campaign.id,
    });

    return campaign;
  }
}
