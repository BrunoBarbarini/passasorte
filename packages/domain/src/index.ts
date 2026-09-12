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
 * these must never be treated as shipped product rules.
 *
 * Phase 3 scope: Rooms, position holds, participation, eligibility and
 * movement allocation. Eligibility rules and hold TTL are likewise TBD
 * (CLAUDE.md #58/#56) — only the pluggable/configurable seams are
 * exported here, never concrete defaults. Payments/Benefits land in
 * later phases (CLAUDE.md #53).
 *
 * Phase 5 scope: Scheduled Game Operations — per-room operations pacing
 * (room-operations-config.js) and in-app Notification/NotificationPreference
 * records. Movement/Sorte/winner/final-submission rules remain the SAME
 * pluggable seams from Phases 2/3 (nothing about them is decided here);
 * Phase 5 only adds what is needed to actually RUN those seams against
 * persisted state and record who was notified.
 *
 * Phase 7 scope: Benefits (BenefitAccount/BenefitLedgerEntry/
 * BenefitRedemption). BR-039: a "Benefit" is a read model derived from
 * its GRANT ledger entry, never its own mutable row. What earns a
 * benefit, how much, and when it expires stay exactly as undecided as
 * CLAUDE.md #58 declares (benefit percentage/expiration/funding) — only
 * the grant/ledger/redemption mechanism is exported here.
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
export * from "./game/room-operations-config.js";
export * from "./game/randomness-commitment.js";
export * from "./game/game-config.js";
export * from "./game/winner-selection.js";
export * from "./game/game-engine.js";
export * from "./game/game-simulator.js";
export * from "./room/room-state-machine.js";
export * from "./room/room.entity.js";
export * from "./room/position-hold.entity.js";
export * from "./participation/participation-state-machine.js";
export * from "./participation/participation.entity.js";
export * from "./participation/eligibility.js";
export * from "./participation/participation-package.js";
export * from "./participation/movement-allocation.entity.js";
export * from "./participation/movement-command-submission.js";
export * from "./notification/notification.entity.js";
export * from "./benefit/benefit-state-machine.js";
export * from "./benefit/benefit-account.entity.js";
export * from "./benefit/benefit-ledger-entry.entity.js";
export * from "./benefit/benefit.entity.js";
export * from "./benefit/benefit-redemption.entity.js";
