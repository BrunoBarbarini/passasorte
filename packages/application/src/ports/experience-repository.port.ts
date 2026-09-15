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
  /** Backoffice-only read: every experience of one merchant, newest first. */
  listByMerchant(merchantId: string): Promise<Experience[]>;
  findById(id: string): Promise<Experience | null>;
  create(input: CreateExperienceInput): Promise<Experience>;
  update(id: string, input: UpdateExperienceInput): Promise<Experience>;
}
