/**
 * @passasorte/application
 *
 * Use cases orchestrating @passasorte/domain against ports (repositories,
 * gateways). No concrete infrastructure (Prisma, Supabase SDK, HTTP, ...)
 * is imported here — adapters implementing these ports live in apps/api.
 */
export * from "./errors.js";

export * from "./ports/auth.port.js";
export * from "./ports/user-repository.port.js";
export * from "./ports/merchant-repository.port.js";
export * from "./ports/experience-repository.port.js";
export * from "./ports/campaign-repository.port.js";
export * from "./ports/audit-log.port.js";
export * from "./ports/outbox.port.js";

export * from "./use-cases/identity/authenticate-request.use-case.js";

export * from "./use-cases/partner/create-merchant.use-case.js";
export * from "./use-cases/partner/update-merchant.use-case.js";
export * from "./use-cases/partner/set-merchant-status.use-case.js";
export * from "./use-cases/partner/add-merchant-location.use-case.js";

export * from "./use-cases/catalog/create-experience.use-case.js";
export * from "./use-cases/catalog/update-experience.use-case.js";

export * from "./use-cases/campaign/create-campaign.use-case.js";
export * from "./use-cases/campaign/update-campaign-draft.use-case.js";
export * from "./use-cases/campaign/transition-campaign.use-case.js";
export * from "./use-cases/campaign/list-public-campaigns.use-case.js";
