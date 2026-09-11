import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CreateExperienceSchema, UpdateExperienceSchema } from "@passasorte/api-contract";
import {
  CreateExperienceUseCase,
  UpdateExperienceUseCase,
  type AuditLogPort,
  type ExperienceRepository,
  type MerchantRepository,
} from "@passasorte/application";
import type { AuthenticatedUser, Experience } from "@passasorte/domain";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import { Roles } from "../../common/auth/roles.decorator.js";
import { RolesGuard } from "../../common/auth/roles.guard.js";
import { AUDIT_LOG_PORT, EXPERIENCE_REPOSITORY, MERCHANT_REPOSITORY } from "../../common/tokens.js";
import { parseWithSchema } from "../../common/validation/parse-with-schema.js";

/** FR-012 Experience Management. Backoffice-only. */
@Controller("experiences")
@UseGuards(AuthGuard, RolesGuard)
export class ExperiencesController {
  private readonly createExperience: CreateExperienceUseCase;
  private readonly updateExperience: UpdateExperienceUseCase;

  constructor(
    @Inject(EXPERIENCE_REPOSITORY) private readonly experienceRepository: ExperienceRepository,
    @Inject(MERCHANT_REPOSITORY) merchantRepository: MerchantRepository,
    @Inject(AUDIT_LOG_PORT) auditLog: AuditLogPort,
  ) {
    this.createExperience = new CreateExperienceUseCase(
      experienceRepository,
      merchantRepository,
      auditLog,
    );
    this.updateExperience = new UpdateExperienceUseCase(experienceRepository, auditLog);
  }

  @Post()
  @Roles("OPERATOR", "ADMIN", "MERCHANT_OPERATOR")
  create(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser): Promise<Experience> {
    const input = parseWithSchema(CreateExperienceSchema, body);
    return this.createExperience.execute({ ...input, actorUserId: user.user.id });
  }

  @Get(":id")
  @Roles("OPERATOR", "ADMIN", "MERCHANT_OPERATOR")
  findById(@Param("id") id: string): Promise<Experience | null> {
    return this.experienceRepository.findById(id);
  }

  @Patch(":id")
  @Roles("OPERATOR", "ADMIN", "MERCHANT_OPERATOR")
  update(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Experience> {
    const input = parseWithSchema(UpdateExperienceSchema, body);
    return this.updateExperience.execute({
      ...input,
      experienceId: id,
      actorUserId: user.user.id,
    });
  }
}
