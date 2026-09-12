import { z } from "zod";

/**
 * FR-054 Promotional Benefit Grant (OPERATOR/ADMIN/FINANCE only, see
 * BenefitsController RBAC). Amount/expiration are always caller-supplied
 * — CLAUDE.md #58 forbids a hardcoded benefit percentage/expiration
 * default, so this schema has none.
 */
export const GrantBenefitSchema = z.object({
  userId: z.string().min(1),
  amountMinorUnits: z.number().int().positive(),
  reason: z.string().min(1),
  sourceRef: z.string().min(1).optional(),
  /** ISO 8601 timestamp; omit for "never expires" (the granter's explicit choice). */
  expiresAt: z.string().datetime().optional(),
});
export type GrantBenefitBody = z.infer<typeof GrantBenefitSchema>;

/** FR-057 Benefit Redemption. Replay protection is the Idempotency-Key header (FR-058), not a field here. */
export const CreateBenefitRedemptionSchema = z.object({
  benefitId: z.string().min(1),
});
export type CreateBenefitRedemptionBody = z.infer<typeof CreateBenefitRedemptionSchema>;
