import {
  assertCampaignTransition,
  snapshotExperience,
  type Campaign,
  type CampaignStatus,
} from "@passasorte/domain";
import type { AuditLogPort } from "../../ports/audit-log.port.js";
import type { CampaignRepository } from "../../ports/campaign-repository.port.js";
import type { ExperienceRepository } from "../../ports/experience-repository.port.js";
import type { OutboxPort } from "../../ports/outbox.port.js";
import { NotFoundError, ValidationError } from "../../errors.js";

export interface TransitionCampaignCommand {
  campaignId: string;
  targetStatus: CampaignStatus;
  actorUserId: string;
  /** Required when targetStatus is CANCELLED (FR-017). */
  cancellationReason?: string;
  now?: Date;
}

const AUDIT_ACTION_BY_STATUS: Record<CampaignStatus, string> = {
  DRAFT: "campaign.draft_updated",
  IN_REVIEW: "campaign.submitted_for_review",
  APPROVED: "campaign.approved",
  SCHEDULED: "campaign.scheduled",
  PUBLISHED: "campaign.published",
  ENDED: "campaign.ended",
  CANCELLED: "campaign.cancelled",
};

/**
 * FR-015 Campaign Approval, FR-016 Campaign Publication, FR-017 Campaign
 * Cancellation, and the ENDED transition. Validates the move is legal per
 * the state machine (CLAUDE.md #7); on PUBLISHED it freezes the
 * Experience snapshot (BR-002) so later Experience edits never change an
 * already-published campaign. What specifically *qualifies* a campaign
 * for approval beyond "it is currently IN_REVIEW" is CLAUDE.md #56
 * (Product - HIGH, final-lock/approval criteria) territory and is not
 * invented here.
 */
export class TransitionCampaignUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly experienceRepository: ExperienceRepository,
    private readonly auditLog: AuditLogPort,
    private readonly outbox: OutboxPort,
  ) {}

  async execute(command: TransitionCampaignCommand): Promise<Campaign> {
    const existing = await this.campaignRepository.findById(command.campaignId);
    if (!existing) {
      throw new NotFoundError("Campaign", command.campaignId);
    }

    assertCampaignTransition(existing.status, command.targetStatus);

    if (command.targetStatus === "CANCELLED" && !command.cancellationReason?.trim()) {
      throw new ValidationError("É necessário informar o motivo do cancelamento.", {
        field: "cancellationReason",
      });
    }

    const now = command.now ?? new Date();

    let experienceSnapshot = existing.experienceSnapshot;
    if (command.targetStatus === "PUBLISHED") {
      const experience = await this.experienceRepository.findById(existing.experienceId);
      if (!experience) {
        throw new NotFoundError("Experience", existing.experienceId);
      }
      experienceSnapshot = snapshotExperience(experience, now);
    }

    const campaign = await this.campaignRepository.transition(command.campaignId, {
      status: command.targetStatus,
      experienceSnapshot,
      cancellationReason:
        command.targetStatus === "CANCELLED" ? (command.cancellationReason ?? null) : null,
      at: now,
    });

    await this.auditLog.record({
      actorUserId: command.actorUserId,
      action: AUDIT_ACTION_BY_STATUS[command.targetStatus],
      entityType: "Campaign",
      entityId: campaign.id,
      metadata:
        command.targetStatus === "CANCELLED" ? { reason: command.cancellationReason } : undefined,
    });

    await this.outbox.publish({
      aggregateType: "Campaign",
      aggregateId: campaign.id,
      eventType: AUDIT_ACTION_BY_STATUS[command.targetStatus],
      payload: { campaignId: campaign.id, status: command.targetStatus },
    });

    return campaign;
  }
}
