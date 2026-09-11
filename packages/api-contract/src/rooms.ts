import { z } from "zod";

const BoardConfigSchema = z.object({ size: z.number().int().positive() });
const SorteZoneSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});
const TemperatureBandSchema = z.object({
  name: z.string().min(1),
  maxNormalizedDistance: z.number().min(0).max(1),
});
const FinalLockConfigSchema = z.object({
  finalPhaseStartSequence: z.number().int().nonnegative(),
});

export const GameConfigSnapshotSchema = z.object({
  engineVersion: z.string().min(1),
  board: BoardConfigSchema,
  initialSorteZone: SorteZoneSchema,
  temperatureBands: z.array(TemperatureBandSchema).min(1),
  movementAllowancePerParticipation: z.number().int().nonnegative(),
  finalLock: FinalLockConfigSchema,
});

/**
 * Wire shape of a participation package (FR-029): eligibility rules
 * travel as ids referencing a server-side registry
 * (apps/api/src/infrastructure/eligibility/eligibility-rule-registry.ts),
 * never as code/functions over the wire — CLAUDE.md #58 leaves concrete
 * eligibility rules TBD, so the registry is currently empty and any id
 * is just a forward-compatible reference.
 */
export const ParticipationPackageInputSchema = z.object({
  id: z.string().min(1),
  positionCount: z.number().int().positive(),
  movementAllowance: z.number().int().nonnegative(),
  eligibilityRuleIds: z.array(z.string().min(1)).default([]),
  priceMinorUnits: z.number().int().nonnegative().optional(),
});

export const CreateRoomSchema = z.object({
  capacity: z.number().int().positive(),
  gameConfig: GameConfigSnapshotSchema,
  holdTtlMs: z.number().int().positive(),
  participationPackages: z.array(ParticipationPackageInputSchema).min(1),
});
export type CreateRoomBody = z.infer<typeof CreateRoomSchema>;

export const HoldPositionsSchema = z.object({
  positions: z.array(z.number().int().nonnegative()).min(1),
});
export type HoldPositionsBody = z.infer<typeof HoldPositionsSchema>;
