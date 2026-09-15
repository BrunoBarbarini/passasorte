import { Inject, Injectable } from "@nestjs/common";
import type { Experience } from "@passasorte/domain";
import type {
  CreateExperienceInput,
  ExperienceRepository,
  UpdateExperienceInput,
} from "@passasorte/application";
import { PrismaService } from "../prisma.service.js";
import type { Experience as PrismaExperience } from "@prisma/client";

function toDomainExperience(row: PrismaExperience): Experience {
  return {
    id: row.id,
    merchantId: row.merchantId,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaExperienceRepository implements ExperienceRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listByMerchant(merchantId: string): Promise<Experience[]> {
    const rows = await this.prisma.experience.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomainExperience);
  }

  async findById(id: string): Promise<Experience | null> {
    const row = await this.prisma.experience.findUnique({ where: { id } });
    return row ? toDomainExperience(row) : null;
  }

  async create(input: CreateExperienceInput): Promise<Experience> {
    const row = await this.prisma.experience.create({ data: input });
    return toDomainExperience(row);
  }

  async update(id: string, input: UpdateExperienceInput): Promise<Experience> {
    const row = await this.prisma.experience.update({ where: { id }, data: input });
    return toDomainExperience(row);
  }
}
