/**
 * @passasorte/application
 *
 * Application/use-case layer: orchestrates @passasorte/domain against
 * ports (repositories, gateways) without depending on any concrete
 * infrastructure adapter. Concrete adapters (Prisma, payment providers,
 * notification providers, ...) are wired in apps/api and apps/worker.
 *
 * Deliberately empty in Phase 0 (Foundation); use cases are added starting
 * Phase 1 per CLAUDE.md #53.
 */
export {};
