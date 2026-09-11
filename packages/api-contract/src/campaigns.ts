import { z } from "zod";

export const CreateCampaignSchema = z.object({
  merchantId: z.string().uuid(),
  experienceId: z.string().uuid(),
  title: z.string().min(1, "Título é obrigatório."),
  timezone: z.string().min(1).optional(),
  scheduledStartAt: z.coerce.date().optional(),
  scheduledEndAt: z.coerce.date().optional(),
});
export type CreateCampaignBody = z.infer<typeof CreateCampaignSchema>;

export const UpdateCampaignDraftSchema = z.object({
  title: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  scheduledStartAt: z.coerce.date().nullable().optional(),
  scheduledEndAt: z.coerce.date().nullable().optional(),
});
export type UpdateCampaignDraftBody = z.infer<typeof UpdateCampaignDraftSchema>;

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "ENDED",
  "CANCELLED",
] as const;

export const TransitionCampaignSchema = z.object({
  status: z.enum(CAMPAIGN_STATUSES),
  cancellationReason: z.string().min(1).optional(),
});
export type TransitionCampaignBody = z.infer<typeof TransitionCampaignSchema>;
