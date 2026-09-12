/**
 * TASK-045 Product Analytics SDK (CLAUDE.md #20). Ports/adapters, like
 * every other external system (CLAUDE.md #15 "Use ports/adapters for
 * payment, identity, notifications and analytics"): this package only
 * knows the shape of an event and how to hand it to *some* provider —
 * never which provider (PostHog is CLAUDE.md #13's ASSUMPTION, not yet a
 * confirmed decision) - see @passasorte/analytics for the concrete
 * adapter.
 *
 * The full catalog below is CLAUDE.md #20's exact event list, copied
 * verbatim so a call site cannot invent an event name that doesn't exist
 * there. Only a subset is actually emitted as of Phase 8 (see
 * dispatch-outbox-events.use-case.ts's OUTBOX_EVENT_TYPE_TO_ANALYTICS_EVENT) -
 * every event that corresponds to a real, already-implemented backend
 * mutation. Screen/view-only events (app_opened, campaign_viewed,
 * live_game_viewed, ...) and every payment event are NOT wired yet:
 * the former would require a client-side analytics SDK decision this
 * phase does not make (CLAUDE.md never specifies one), and the latter
 * has no use case to emit from until Phase 6 (LEGAL GATE) exists. Both
 * are real remaining TBDs, not oversights - do not backfill them by
 * guessing at a client SDK.
 */
export const ANALYTICS_EVENT_NAMES = [
  "app_opened",
  "campaign_list_viewed",
  "campaign_viewed",
  "campaign_shared",
  "signup_started",
  "signup_completed",
  "login_completed",
  "participation_started",
  "room_selected",
  "position_selection_started",
  "position_selected",
  "position_deselected",
  "position_hold_created",
  "position_hold_failed",
  "checkout_started",
  "payment_succeeded",
  "payment_failed",
  "participation_confirmed",
  "live_game_viewed",
  "temperature_viewed",
  "movement_submitted",
  "movement_accepted",
  "movement_rejected",
  "final_plan_started",
  "final_plan_submitted",
  "game_result_viewed",
  "prize_won",
  "fulfillment_started",
  "fulfillment_completed",
  "benefit_granted",
  "benefit_viewed",
  "benefit_redemption_started",
  "benefit_redeemed",
  "notification_opened",
  "support_case_created",
  "account_deletion_requested",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return (ANALYTICS_EVENT_NAMES as readonly string[]).includes(value);
}

/**
 * CLAUDE.md #20: "Never send passwords, tokens, card data or unnecessary
 * PII to analytics." This is a defense-in-depth denylist applied to every
 * event's properties right before it reaches a provider (see
 * redactSensitiveProperties below) - callers should still never pass
 * these in the first place.
 */
const FORBIDDEN_PROPERTY_KEY_PATTERN = /password|token|secret|card(number)?|cvv|ssn|cpf/i;

/**
 * Strips any property whose key looks like a credential/PII field
 * (case-insensitively) before an event is handed to a provider. Applied
 * once, centrally, so every emission path (use cases publishing to the
 * outbox, the outbox dispatcher forwarding to AnalyticsPort) is covered
 * without every call site having to remember to do it itself.
 */
export function redactSensitiveProperties(
  properties: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!properties) return {};
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (FORBIDDEN_PROPERTY_KEY_PATTERN.test(key)) continue;
    redacted[key] = value;
  }
  return redacted;
}

export interface TrackAnalyticsEventInput {
  event: AnalyticsEventName;
  /** Supabase user id when known, otherwise a stable anonymous/aggregate id. */
  distinctId: string;
  properties?: Record<string, unknown>;
}

export interface AnalyticsPort {
  track(input: TrackAnalyticsEventInput): Promise<void>;
}

/** Safe default so injecting an AnalyticsPort is opt-in everywhere - matches the notification-provider empty-registry pattern. */
export const NOOP_ANALYTICS_PORT: AnalyticsPort = {
  async track() {
    /* no-op */
  },
};
