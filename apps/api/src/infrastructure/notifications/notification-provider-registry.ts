import type { NotificationProvider } from "@passasorte/application";

/**
 * CLAUDE.md #3.12: "External providers for push, email and future
 * WhatsApp/SMS" are explicitly undecided. Same pattern as
 * eligibility-rule-registry.ts: an intentionally empty registry
 * documenting the extension point, never a guessed concrete adapter.
 * Wiring a real FCM/APNs or email-ESP provider here is a decision for
 * whoever picks the provider — not something to invent in this phase.
 */
export function resolveNotificationProviders(): readonly NotificationProvider[] {
  return [];
}
