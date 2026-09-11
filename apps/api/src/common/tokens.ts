/**
 * DI tokens for @passasorte/application ports. TypeScript interfaces
 * don't exist at runtime, so Nest needs a token (not the type) to bind
 * each port to its concrete adapter - see infrastructure.module.ts.
 */
export const AUTH_PORT = Symbol("AuthPort");
export const USER_REPOSITORY = Symbol("UserRepository");
export const MERCHANT_REPOSITORY = Symbol("MerchantRepository");
export const EXPERIENCE_REPOSITORY = Symbol("ExperienceRepository");
export const CAMPAIGN_REPOSITORY = Symbol("CampaignRepository");
export const AUDIT_LOG_PORT = Symbol("AuditLogPort");
export const OUTBOX_PORT = Symbol("OutboxPort");
export const ROOM_REPOSITORY = Symbol("RoomRepository");
export const POSITION_HOLD_REPOSITORY = Symbol("PositionHoldRepository");
export const PARTICIPATION_REPOSITORY = Symbol("ParticipationRepository");
export const IDEMPOTENCY_PORT = Symbol("IdempotencyPort");
