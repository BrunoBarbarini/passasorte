import { z } from "zod";

export const CreateExperienceSchema = z.object({
  merchantId: z.string().uuid(),
  title: z.string().min(1, "Título é obrigatório."),
  description: z.string().min(1, "Descrição é obrigatória."),
});
export type CreateExperienceBody = z.infer<typeof CreateExperienceSchema>;

export const UpdateExperienceSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
});
export type UpdateExperienceBody = z.infer<typeof UpdateExperienceSchema>;
