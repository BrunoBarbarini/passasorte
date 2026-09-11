/**
 * @passasorte/domain
 *
 * Pure business rules for PassaSorte's bounded contexts (Identity, Partner,
 * Catalog, Campaign, Game, Participation, Commerce, Benefits, Fulfillment,
 * Compliance, ...). CLAUDE.md #11/#46: this package must never import
 * Prisma, HTTP, cloud SDKs or any provider SDK - it is framework-agnostic
 * by construction so the Game Engine and other core rules stay pure and
 * independently testable (CLAUDE.md NFR-017).
 *
 * Deliberately empty in Phase 0 (Foundation). Entities, value objects and
 * the GameEngine interface land in Phase 1-2 per CLAUDE.md #53.
 */
export {};
