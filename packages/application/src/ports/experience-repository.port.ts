import type { Experience, ExperienceStatus } from "@passasorte/domain";

export interface CreateExperienceInput {
  merchantId: string;
  title: string;
  description: string;
}

export interface UpdateExperienceInput {
  title?: string;
  description?: string;
  status?: ExperienceStatus;
}

export interface ExperienceRepository {
  findById(id: string): Promise<Experience | null>;
  create(input: CreateExperienceInput): Promise<Experience>;
  update(id: string, input: UpdateExperienceInput): Promise<Experience>;
}
