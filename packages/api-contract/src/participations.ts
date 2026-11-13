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

const MovementCommandInputSchema = z.object({
  positionIndex: z.number().int().nonnegative(),
  direction: z.enum(MOVEMENT_DIRECTIONS),
  sequence: z.number().int().nonnegative(),
});

/** TASK-030 Final Movement Plan (FR-039/BR-028): locked exactly once per participation. */
export const SubmitFinalMovementSchema = z.object({
  commands: z.array(MovementCommandInputSchema),
  atSequence: z.number().int().nonnegative(),
});
export type SubmitFinalMovementBody = z.infer<typeof SubmitFinalMovementSchema>;

/** DECISION-16 / T-33: one action per participant per round window; sending again replaces it. */
export const ROUND_ACTION_KINDS = ["LEFT", "RIGHT", "STAY"] as const;

export const SubmitRoundActionSchema = z.object({
  kind: z.enum(ROUND_ACTION_KINDS),
  credits: z.number().int().min(1),
});
export type SubmitRoundActionBody = z.infer<typeof SubmitRoundActionSchema>;
