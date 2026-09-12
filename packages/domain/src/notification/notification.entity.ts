/**
 * Notification (FR-059..FR-062, CLAUDE.md #29 Notifications architecture:
 * "Domain Event -> Transactional Outbox -> Queue -> Notification Worker
 * -> Provider"). MVP channels are in-app, push and email (CLAUDE.md #29);
 * WHICH external provider sends push/email is explicitly undecided
 * (CLAUDE.md #3.12) — this module only models the notification record
 * and preference itself, which is real/decided regardless of provider;
 * see @passasorte/application's NotificationProvider port for the
 * pluggable, currently-empty provider seam.
 */
export type NotificationChannel = "IN_APP" | "PUSH" | "EMAIL";

export interface Notification {
  readonly id: string;
  readonly userId: string;
  /** e.g. "room.completed", "participation.won" — the outbox eventType that produced it. */
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, unknown>> | null;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

/** FR-062: per-user, per-channel opt-in/out. Defaults to enabled when no row exists (see NotificationRepository). */
export interface NotificationPreference {
  readonly userId: string;
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
}
