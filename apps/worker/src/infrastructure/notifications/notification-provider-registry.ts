import type { NotificationProvider } from "@passasorte/application";

/**
 * Mirrors apps/api/src/infrastructure/notifications/notification-provider-registry.ts
 * — CLAUDE.md #3.12: push/email provider is undecided, so this registry
 * stays empty until one is chosen.
 */
export function resolveNotificationProviders(): readonly NotificationProvider[] {
  return [];
}
