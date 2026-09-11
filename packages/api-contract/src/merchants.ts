import { z } from "zod";

export const CreateMerchantSchema = z.object({
  legalName: z.string().min(1, "Razão social é obrigatória."),
  displayName: z.string().min(1, "Nome de exibição é obrigatório."),
});
export type CreateMerchantBody = z.infer<typeof CreateMerchantSchema>;

export const UpdateMerchantSchema = z.object({
  legalName: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
});
export type UpdateMerchantBody = z.infer<typeof UpdateMerchantSchema>;

export const SetMerchantStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
export type SetMerchantStatusBody = z.infer<typeof SetMerchantStatusSchema>;

export const AddMerchantLocationSchema = z.object({
  label: z.string().min(1, "Rótulo é obrigatório."),
  addressLine1: z.string().min(1, "Endereço é obrigatório."),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "Cidade é obrigatória."),
  state: z.string().min(1, "Estado é obrigatório."),
  postalCode: z.string().min(1, "CEP é obrigatório."),
  country: z.string().optional(),
});
export type AddMerchantLocationBody = z.infer<typeof AddMerchantLocationSchema>;
