import type { Experience } from "@passasorte/domain";
import type { ExperienceRepository, UpdateExperienceInput } from "../../ports/experience-repository.port.js";
import type { AuditLogPort } from "../../ports/audit-log.port.js";
import { NotFoundError, ValidationError } from "../../errors.js";

export interface UpdateExperienceCommand extends UpdateExperienceInput {
  experienceId: string;
  actorUserId: string;
}

/** FR-012 Experience Management: update. */
export class UpdateExperienceUseCase {
  constructor(
    private readonly experienceRepository: ExperienceRepository,
    private readonly auditLog: AuditLogPort,
  ) {}

  async execute(command: UpdateExperienceCommand): Promise<Experience> {
    const existing = await this.experienceRepository.findById(command.experienceId);
    if (!existing) {
      throw new NotFoundError("Experience", command.experienceId);
    }
    if (command.title !== undefined && !command.title.trim()) {
      throw new ValidationError("Título não pode ficar em branco.", { field: "title" });
    }
    if (command.description !== undefined && !command.description.trim()) {
      throw new ValidationError("Descrição não pode ficar em branco.", { field: "description" });
    }

    const experience = await this.experienceRepository.update(command.experienceId, {
      title: command.title?.trim(),
      description: command.description?.trim(),
      status: command.status,
    });

    await this.auditLog.record({
      actorUserId: command.actorUserId,
      action: "experience.updated",
      entityType: "Experience",
      entityId: experience.id,
    });

    return experience;
  }
}
