import { z } from "zod";

export const CreateParticipationSchema = z.object({
  packageId: z.string().min(1),
  positions: z.array(z.number().int().nonnegative()).min(1),
});
export type CreateParticipationBody = z.infer<typeof CreateParticipationSchema>;

export const MOVEMENT_DIRECTIONS = ["LEFT", "RIGHT"] as const;

export const SubmitMovementSchema = z.object({
  positionIndex: z.number().int().nonnegative(),
  direction: z.enum(MOVEMENT_DIRECTIONS),
  sequence: z.number().int().nonnegative(),
});
export type SubmitMovementBody = z.infer<typeof SubmitMovementSchema>;
