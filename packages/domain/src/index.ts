/**
 * @passasorte/domain
 *
 * Pure business rules for PassaSorte's bounded contexts. CLAUDE.md
 * #11/#46: this package must never import Prisma, HTTP, cloud SDKs or any
 * provider SDK.
 *
 * Phase 1 scope: Identity (roles), Partner (Merchant), Catalog
 * (Experience) and Campaign (state machine).
 *
 * Phase 2 scope: Game domain simulator (ADR-011 pure engine interface).
 * Movement effect, Sorte progression and winner selection are TBD
 * business rules (CLAUDE.md #58); only pluggable strategy interfaces
 * plus explicitly-labeled SIMULATION_ONLY_* placeholders are exported —
 * these must never be treated as shipped product rules. Payments/Benefits
 * land in later phases (CLAUDE.md #53).
 */
export * from "./identity/role.js";
export * from "./identity/user.entity.js";
export * from "./partner/merchant.entity.js";
export * from "./catalog/experience.entity.js";
export * from "./campaign/campaign.entity.js";
export * from "./campaign/campaign-state-machine.js";
export * from "./game/board.js";
export * from "./game/sorte.js";
export * from "./game/sorte-progression.js";
export * from "./game/temperature.js";
export * from "./game/movement.js";
export * from "./game/final-lock.js";
export * from "./game/randomness-commitment.js";
export * from "./game/game-config.js";
export * from "./game/winner-selection.js";
export * from "./game/game-engine.js";
export * from "./game/game-simulator.js";
