/**
 * @passasorte/domain
 *
 * Pure business rules for PassaSorte's bounded contexts. CLAUDE.md
 * #11/#46: this package must never import Prisma, HTTP, cloud SDKs or any
 * provider SDK.
 *
 * Phase 1 scope: Identity (roles), Partner (Merchant), Catalog
 * (Experience) and Campaign (state machine). Game/Payments/Benefits land
 * in later phases (CLAUDE.md #53).
 */
export * from "./identity/role.js";
export * from "./identity/user.entity.js";
export * from "./partner/merchant.entity.js";
export * from "./catalog/experience.entity.js";
export * from "./campaign/campaign.entity.js";
export * from "./campaign/campaign-state-machine.js";
