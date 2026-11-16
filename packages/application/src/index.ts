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
export * from "./ports/room-repository.port.js";
export * from "./ports/position-hold-repository.port.js";
export * from "./ports/participation-repository.port.js";
export * from "./ports/idempotency.port.js";
export * from "./ports/game-run-repository.port.js";
export * from "./ports/notification-repository.port.js";
export * from "./ports/notification-provider.port.js";
export * from "./ports/benefit-repository.port.js";
export * from "./ports/analytics.port.js";
export * from "./ports/round-action-repository.port.js";
export * from "./ports/engine-v2-room.port.js";
export * from "./ports/position-selection.port.js";
export * from "./ports/participant-game-state.port.js";

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

export * from "./use-cases/room/hold-positions.use-case.js";
export * from "./use-cases/room/create-room.use-case.js";
export * from "./use-cases/room/set-position-selection-config.use-case.js";
export * from "./use-cases/room/validate-position-selection-config.js";
export * from "./use-cases/room/open-room.use-case.js";
export * from "./use-cases/room/lock-room-entries.use-case.js";
export * from "./use-cases/room/start-room.use-case.js";

export * from "./use-cases/participation/create-participation.use-case.js";
export * from "./use-cases/participation/confirm-participation.use-case.js";
export * from "./use-cases/participation/submit-movement-command.use-case.js";
export * from "./use-cases/participation/submit-round-action.use-case.js";
export * from "./use-cases/game/start-room-v2.use-case.js";
export * from "./use-cases/game/start-position-selection.use-case.js";
export * from "./use-cases/game/pick-positions.use-case.js";
export * from "./use-cases/game/get-participant-game-state.use-case.js";
export * from "./use-cases/game/auto-allocate-expired-picks.use-case.js";
export * from "./use-cases/game/notify-position-selection-turns.use-case.js";
export {
  buildSelectionState,
  currentPickDeadline,
  currentPickWindow,
} from "./use-cases/game/position-selection.shared.js";
export * from "./use-cases/participation/set-auto-action.use-case.js";
export * from "./use-cases/game/resolve-round-v2.use-case.js";
export * from "./use-cases/participation/submit-final-movement-command.use-case.js";

export * from "./use-cases/game/expire-position-holds.use-case.js";
export * from "./use-cases/game/advance-room-operations.use-case.js";

export * from "./use-cases/notification/list-notifications.use-case.js";
export * from "./use-cases/notification/mark-notification-read.use-case.js";
export * from "./use-cases/notification/set-notification-preference.use-case.js";
export * from "./use-cases/notification/dispatch-outbox-events.use-case.js";

export * from "./use-cases/benefit/grant-benefit.use-case.js";
export * from "./use-cases/benefit/list-my-benefits.use-case.js";
export * from "./use-cases/benefit/redeem-benefit.use-case.js";
export * from "./use-cases/benefit/expire-benefits.use-case.js";
