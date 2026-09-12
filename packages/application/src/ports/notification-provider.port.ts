import type { NotificationChannel } from "@passasorte/domain";

export interface NotificationDispatchInput {
  readonly userId: string;
  readonly title: string;
  readonly body: string;
  readonly data?: Record<string, unknown>;
}

/**
 * CLAUDE.md #3.12: "External providers for push, email and future
 * WhatsApp/SMS" are explicitly undecided. This port defines the seam a
 * real provider (FCM/APNs, an email ESP, ...) would implement; adapters
 * are intentionally NOT registered for PUSH/EMAIL yet (see apps/api's
 * notification-provider-registry.ts, following the same
 * empty-pluggable-registry pattern already used for eligibility rules)
 * — only IN_APP notifications (NotificationRepository) are real today.
 */
export interface NotificationProvider {
  readonly channel: Exclude<NotificationChannel, "IN_APP">;
  send(input: NotificationDispatchInput): Promise<void>;
}
