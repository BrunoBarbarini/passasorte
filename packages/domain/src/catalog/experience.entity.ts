/**
 * FR-012 Experience Management. A Campaign freezes (snapshots) the
 * Experience at publication time (BR-002) — see campaign/campaign.entity.ts
 * `snapshotExperience`. Editing an Experience after that never changes an
 * already-published campaign.
 */
export type ExperienceStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface Experience {
  id: string;
  merchantId: string;
  title: string;
  description: string;
  status: ExperienceStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Immutable snapshot shape frozen into Campaign.experienceSnapshot. */
export interface ExperienceSnapshot {
  experienceId: string;
  title: string;
  description: string;
  snapshotTakenAt: string;
}

export function snapshotExperience(experience: Experience, at: Date): ExperienceSnapshot {
  return {
    experienceId: experience.id,
    title: experience.title,
    description: experience.description,
    snapshotTakenAt: at.toISOString(),
  };
}

/** Only a non-archived experience may be attached to a new campaign. */
export function canAttachToNewCampaign(experience: Experience): boolean {
  return experience.status !== "ARCHIVED";
}
