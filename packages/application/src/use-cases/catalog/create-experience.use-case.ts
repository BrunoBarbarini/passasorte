import type { Experience } from "@passasorte/domain";
import type { CreateExperienceInput, ExperienceRepository } from "../../ports/experience-repository.port.js";
import type { MerchantRepository } from "../../ports/merchant-repository.port.js";
import type { AuditLogPort } from "../../ports/audit-log.port.js";
import { NotFoundError, ValidationError } from "../../errors.js";

export interface CreateExperienceCommand extends CreateExperienceInput {
  actorUserId: string;
}

/** FR-012 Experience Management: create. */
export class CreateExperienceUseCase {
  constructor(
    private readonly experienceRepository: ExperienceRepository,
    private readonly merchantRepository: MerchantRepository,
    private readonly auditLog: AuditLogPort,
  ) {}

  async execute(command: CreateExperienceCommand): Promise<Experience> {
    const merchant = await this.merchantRepository.findById(command.merchantId);
    if (!merchant) {
      throw new NotFoundError("Merchant", command.merchantId);
    }
    if (!command.title.trim()) {
      throw new ValidationError("Título é obrigatório.", { field: "title" });
    }
    if (!command.description.trim()) {
      throw new ValidationError("Descrição é obrigatória.", { field: "description" });
    }

    const experience = await this.experienceRepository.create({
      merchantId: command.merchantId,
      title: command.title.trim(),
      description: command.description.trim(),
    });

    await this.auditLog.record({
      actorUserId: command.actorUserId,
      action: "experience.created",
      entityType: "Experience",
      entityId: experience.id,
    });

    return experience;
  }
}
